import { supabase, type Env } from "./supabase";
import { askEngine, extractMentions } from "./engines";
import { PLAN_ENGINES, PLAN_CADENCE_MS, type Plan } from "../../../shared/engines";
import { runWithConcurrency } from "../../../shared/concurrency";
import { digestHtml, founderPulseHtml, type BrandWeekStats } from "../../../shared/digest";

interface Prompt {
  id: string;
  text: string;
  active: boolean;
}
interface Brand {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  competitors: string[];
  prompts: Prompt[];
  plan: Plan;
}

async function isDue(db: ReturnType<typeof supabase>, promptIds: string[], plan: Plan): Promise<boolean> {
  if (promptIds.length === 0) return false;
  const idsList = promptIds.join(",");
  const latest = await db.select<{ ran_at: string }>(
    "runs",
    `select=ran_at&prompt_id=in.(${idsList})&order=ran_at.desc&limit=1`
  );
  if (latest.length === 0) return true;
  const age = Date.now() - new Date(latest[0].ran_at).getTime();
  return age >= (PLAN_CADENCE_MS[plan] ?? PLAN_CADENCE_MS.free);
}

async function runBrand(db: ReturnType<typeof supabase>, brand: Brand, env: Env) {
  const engines = PLAN_ENGINES[brand.plan];
  const ctx = { brand: brand.name, domain: brand.domain, competitors: brand.competitors };
  const activePrompts = brand.prompts.filter((p) => p.active);

  const tasks: (() => Promise<void>)[] = [];
  for (const prompt of activePrompts) {
    for (const engine of engines) {
      tasks.push(async () => {
      try {
        const result = await askEngine(engine, prompt.text, env);
        const [run] = await db.insert<{ id: string }>("runs", [
          {
            prompt_id: prompt.id,
            engine,
            ran_at: new Date().toISOString(),
            response_text: result.text,
            cited_urls: result.citedUrls,
            status: "ok",
          },
        ]);
        const mentions = extractMentions(result.text, ctx);
        await db.insert(
          "mentions",
          mentions.map((m) => ({ ...m, run_id: run.id }))
        );
      } catch (err) {
        await db.insert("runs", [
          {
            prompt_id: prompt.id,
            engine,
            ran_at: new Date().toISOString(),
            response_text: err instanceof Error ? err.message : "Unknown error",
            cited_urls: [],
            status: "error",
          },
        ]);
      }
      });
    }
  }
  await runWithConcurrency(tasks, 6);
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
  async fetch() {
    return new Response("Resonark scheduler worker. Trigger via cron.", { status: 200 });
  },
};

async function handleScheduled(env: Env) {
  const db = supabase(env);
  // brands has no FK to profiles (both key off auth.users), so PostgREST
  // can't embed profiles here — plans are fetched in a second query.
  const rows = await db.select<Omit<Brand, "plan">>(
    "brands",
    "select=id,user_id,name,domain,competitors,prompts!inner(id,text,active)&prompts.active=eq.true"
  );
  const userIds = [...new Set(rows.map((b) => b.user_id))];
  const profiles = userIds.length
    ? await db.select<{ id: string; plan: string }>("profiles", `select=id,plan&id=in.(${userIds.join(",")})`)
    : [];
  const planByUser = new Map(profiles.map((p) => [p.id, p.plan]));
  const brands: Brand[] = rows.map((b) => ({
    ...b,
    plan: planByUser.get(b.user_id) === "pro" ? "pro" : "free",
  }));

  for (const brand of brands) {
    const promptIds = brand.prompts.map((p) => p.id);
    if (await isDue(db, promptIds, brand.plan)) {
      await runBrand(db, brand, env);
    }
  }

  // Weekly digest on Mondays only.
  if (new Date().getUTCDay() === 1 && env.BREVO_API_KEY && env.BREVO_SENDER) {
    await sendWeeklyDigests(db, env);
    await sendFounderPulse(db, env);
  }
}

/**
 * Weekly ops report to the founder's own inbox (BREVO_SENDER is the
 * founder's verified address) — the LAUNCH.md Part 3 metrics, automated.
 * Failure is logged, never thrown: the pulse must not break user digests.
 */
async function sendFounderPulse(db: ReturnType<typeof supabase>, env: Env) {
  try {
    const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [users, newUsers, brands, weekRuns] = await Promise.all([
      db.select<{ id: string }>("profiles", "select=id"),
      db.select<{ id: string }>("profiles", `select=id&created_at=gte.${sinceIso}`),
      db.select<{ id: string }>("brands", "select=id"),
      db.select<{ status: string; prompts: { brand_id: string } }>(
        "runs",
        `select=status,prompts!inner(brand_id)&ran_at=gte.${sinceIso}`
      ),
    ]);
    const okRuns = weekRuns.filter((r) => r.status === "ok");
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": env.BREVO_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "Resonark", email: env.BREVO_SENDER },
        to: [{ email: env.BREVO_SENDER }],
        subject: "Resonark founder pulse",
        htmlContent: founderPulseHtml({
          totalUsers: users.length,
          newUsers: newUsers.length,
          totalBrands: brands.length,
          activeBrands: new Set(okRuns.map((r) => r.prompts.brand_id)).size,
          okRuns: okRuns.length,
          errorRuns: weekRuns.length - okRuns.length,
        }),
      }),
    });
    if (!res.ok) console.error(`founder pulse failed: ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("founder pulse failed:", err instanceof Error ? err.message : err);
  }
}

interface BrandWithPromptIds {
  id: string;
  name: string;
  prompts: { id: string }[];
}

/**
 * Visibility stats for the digest week and the week before. Mentions are
 * counted through a PostgREST embed filter on runs (not `run_id=in.(...)`) so
 * the URL stays short even at Pro scale (25 prompts × 3 engines × 7 days).
 */
async function brandWeekStats(
  db: ReturnType<typeof supabase>,
  brand: BrandWithPromptIds,
  sinceIso: string,
  prevSinceIso: string
): Promise<BrandWeekStats> {
  const empty = { name: brand.name, runs: 0, mentionedRuns: 0, prevRuns: 0, prevMentionedRuns: 0 };
  const promptIds = brand.prompts.map((p) => p.id);
  if (promptIds.length === 0) return empty;
  const idsList = promptIds.join(",");

  const runsIn = (fromIso: string, toIso?: string) =>
    db.select<{ id: string }>(
      "runs",
      `select=id&prompt_id=in.(${idsList})&status=eq.ok&ran_at=gte.${fromIso}` + (toIso ? `&ran_at=lt.${toIso}` : "")
    );
  const mentionedIn = (fromIso: string, toIso?: string) =>
    db.select<{ run_id: string }>(
      "mentions",
      `select=run_id,runs!inner(prompt_id,status,ran_at)&runs.prompt_id=in.(${idsList})&runs.status=eq.ok` +
        `&runs.ran_at=gte.${fromIso}` +
        (toIso ? `&runs.ran_at=lt.${toIso}` : "") +
        `&is_own_brand=eq.true&mentioned=eq.true`
    );

  const [runs, mentioned, prevRuns, prevMentioned] = await Promise.all([
    runsIn(sinceIso),
    mentionedIn(sinceIso),
    runsIn(prevSinceIso, sinceIso),
    mentionedIn(prevSinceIso, sinceIso),
  ]);
  return {
    name: brand.name,
    runs: runs.length,
    mentionedRuns: new Set(mentioned.map((m) => m.run_id)).size,
    prevRuns: prevRuns.length,
    prevMentionedRuns: new Set(prevMentioned.map((m) => m.run_id)).size,
  };
}

async function sendWeeklyDigests(db: ReturnType<typeof supabase>, env: Env) {
  const users = await db.select<{ id: string; email: string }>("profiles", "select=id,email"); // profiles.email is mirrored from auth.users by the handle_new_user trigger
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(Date.now() - weekMs).toISOString();
  const prevSinceIso = new Date(Date.now() - 2 * weekMs).toISOString();

  for (const user of users) {
    // Per-user isolation: a thrown exception (network abort, DNS failure,
    // timeout) on one user's queries or send must not abort the batch —
    // everyone after them would silently get no digest until next Monday.
    try {
      const brands = await db.select<BrandWithPromptIds>("brands", `select=id,name,prompts(id)&user_id=eq.${user.id}`);

      const stats: BrandWeekStats[] = [];
      for (const brand of brands) {
        const s = await brandWeekStats(db, brand, sinceIso, prevSinceIso);
        // Only report brands with fresh successful runs — guards against
        // emailing when the cron produced no data (Supabase down, engine
        // failures, or a brand with zero prompts).
        if (s.runs > 0) stats.push(s);
      }
      if (stats.length === 0) continue;

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env.BREVO_API_KEY!, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "Resonark", email: env.BREVO_SENDER },
          to: [{ email: user.email }],
          subject: "Your weekly AI visibility report",
          htmlContent: digestHtml("https://resonark.tarun-vashishth093.workers.dev/dashboard", stats),
        }),
      });
      if (!res.ok) {
        console.error(`digest email failed for ${user.id}: ${res.status} ${await res.text()}`);
      }
    } catch (err) {
      console.error(`digest failed for ${user.id}:`, err instanceof Error ? err.message : err);
    }
  }
}

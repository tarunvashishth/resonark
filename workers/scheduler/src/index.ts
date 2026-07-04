import { supabase, type Env } from "./supabase";
import { askEngine, extractMentions } from "./engines";
import { PLAN_ENGINES, PLAN_CADENCE_MS, type Plan } from "../../../shared/engines";

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
  profiles: { plan: string };
  prompts: Prompt[];
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
  const plan: Plan = brand.profiles.plan === "pro" ? "pro" : "free";
  const engines = PLAN_ENGINES[plan];
  const ctx = { brand: brand.name, domain: brand.domain, competitors: brand.competitors };
  const activePrompts = brand.prompts.filter((p) => p.active);

  for (const prompt of activePrompts) {
    for (const engine of engines) {
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
    }
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(env));
  },
  async fetch() {
    return new Response("EchoRank scheduler worker. Trigger via cron.", { status: 200 });
  },
};

async function handleScheduled(env: Env) {
  const db = supabase(env);
  const brands = await db.select<Brand>(
    "brands",
    "select=id,user_id,name,domain,competitors,profiles!inner(plan),prompts!inner(id,text,active)&prompts.active=eq.true"
  );

  for (const brand of brands) {
    const promptIds = brand.prompts.map((p) => p.id);
    const plan: Plan = brand.profiles.plan === "pro" ? "pro" : "free";
    if (await isDue(db, promptIds, plan)) {
      await runBrand(db, brand, env);
    }
  }

  // Weekly digest on Mondays only.
  if (new Date().getUTCDay() === 1 && env.RESEND_API_KEY) {
    await sendWeeklyDigests(db, env);
  }
}

interface BrandWithPromptIds {
  id: string;
  name: string;
  prompts: { id: string }[];
}

/** True if this brand has at least one successful run since `sinceIso` —
 * guards against emailing "your weekly report is ready" when the cron
 * never actually produced fresh data (Supabase down, engine failures, or a
 * brand with zero prompts). */
async function hasFreshRun(db: ReturnType<typeof supabase>, promptIds: string[], sinceIso: string): Promise<boolean> {
  if (promptIds.length === 0) return false;
  const idsList = promptIds.join(",");
  const recent = await db.select<{ id: string }>(
    "runs",
    `select=id&prompt_id=in.(${idsList})&status=eq.ok&ran_at=gte.${sinceIso}&limit=1`
  );
  return recent.length > 0;
}

async function sendWeeklyDigests(db: ReturnType<typeof supabase>, env: Env) {
  const users = await db.select<{ id: string; email: string }>("profiles", "select=id,email"); // profiles.email is mirrored from auth.users by the handle_new_user trigger
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const user of users) {
    const brands = await db.select<BrandWithPromptIds>("brands", `select=id,name,prompts(id)&user_id=eq.${user.id}`);

    const freshBrandNames: string[] = [];
    for (const brand of brands) {
      const promptIds = brand.prompts.map((p) => p.id);
      if (await hasFreshRun(db, promptIds, sinceIso)) freshBrandNames.push(brand.name);
    }
    // Nothing fresh to report — skip rather than point at a stale/empty dashboard.
    if (freshBrandNames.length === 0) continue;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "EchoRank <digest@echorank.app>",
        to: user.email,
        subject: "Your weekly AI visibility report",
        html: `<p>Your weekly EchoRank report for ${freshBrandNames.join(
          ", "
        )} is ready. <a href="https://echorank.app/dashboard">View it</a>.</p>`,
      }),
    });
    if (!res.ok) {
      console.error(`digest email failed for ${user.id}: ${res.status} ${await res.text()}`);
    }
  }
}

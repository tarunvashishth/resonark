import { db } from "./db";
import { ENGINES, extractMentions } from "./engines";
import { PLAN_LIMITS } from "./types";
import type { Brand, Plan } from "./types";

/**
 * Runs every active prompt for a brand through every engine on its plan.
 *
 * workers/scheduler/src/index.ts's runBrand() duplicates this per-prompt/
 * per-engine loop (try → persist "ok" run + mentions, catch → persist "error"
 * run) against Supabase REST instead of the local db. The two runtimes can't
 * share the loop directly (see shared/engines.ts's top comment), so keep them
 * in sync intentionally when editing either one.
 */
export async function runBrandNow(brand: Brand, plan: Plan) {
  const prompts = (await db.listPromptsByBrand(brand.id)).filter((p) => p.active);
  const engines = PLAN_LIMITS[plan].engines;
  const ctx = { brand: brand.name, domain: brand.domain, competitors: brand.competitors };

  let runCount = 0;
  for (const prompt of prompts) {
    for (const engineName of engines) {
      const adapter = ENGINES[engineName];
      try {
        const result = await adapter.ask(prompt.text, ctx);
        const run = await db.createRun({
          promptId: prompt.id,
          engine: engineName,
          ranAt: new Date().toISOString(),
          responseText: result.text,
          citedUrls: result.citedUrls,
          status: "ok",
        });
        const mentions = extractMentions(result.text, ctx);
        await db.createMentions(mentions.map((m) => ({ ...m, runId: run.id })));
        runCount++;
      } catch (err) {
        await db.createRun({
          promptId: prompt.id,
          engine: engineName,
          ranAt: new Date().toISOString(),
          responseText: err instanceof Error ? err.message : "Unknown error",
          citedUrls: [],
          status: "error",
        });
      }
    }
  }
  return runCount;
}

import { db } from "./db";
import type { Brand, Engine, Mention, Prompt, Run } from "./types";

export interface DashboardData {
  visibilityScore: number; // 0-100
  totalRuns: number;
  errorRuns: number;
  trend: { date: string; visibility: number }[];
  perEngine: { engine: Engine; visibility: number; runs: number }[];
  shareOfVoice: { name: string; isOwnBrand: boolean; mentions: number; pct: number }[];
  promptRows: {
    prompt: Prompt;
    byEngine: Partial<Record<Engine, { run: Run; mentions: Mention[] }>>;
  }[];
  citedDomains: { domain: string; count: number }[];
}

function domainOf(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function buildDashboard(brand: Brand): DashboardData {
  const prompts = db.listPromptsByBrand(brand.id);
  const allRuns = db.listRunsByBrand(brand.id);
  const runs = allRuns.filter((r) => r.status === "ok");
  const errorRuns = allRuns.length - runs.length;
  const runIds = runs.map((r) => r.id);
  const mentions = db.listMentionsByRunIds(runIds);

  const mentionsByRun = new Map<string, Mention[]>();
  for (const m of mentions) {
    if (!mentionsByRun.has(m.runId)) mentionsByRun.set(m.runId, []);
    mentionsByRun.get(m.runId)!.push(m);
  }

  const ownMentionedRuns = runs.filter((r) =>
    (mentionsByRun.get(r.id) ?? []).some((m) => m.isOwnBrand && m.mentioned)
  );
  const visibilityScore = runs.length ? Math.round((ownMentionedRuns.length / runs.length) * 100) : 0;

  // Trend: group by calendar day.
  const byDay = new Map<string, { total: number; mentioned: number }>();
  for (const r of runs) {
    const day = r.ranAt.slice(0, 10);
    const entry = byDay.get(day) ?? { total: 0, mentioned: 0 };
    entry.total++;
    if ((mentionsByRun.get(r.id) ?? []).some((m) => m.isOwnBrand && m.mentioned)) entry.mentioned++;
    byDay.set(day, entry);
  }
  const trend = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, visibility: Math.round((v.mentioned / v.total) * 100) }));

  // Per-engine breakdown.
  const engineNames = [...new Set(runs.map((r) => r.engine))];
  const perEngine = engineNames.map((engine) => {
    const engineRuns = runs.filter((r) => r.engine === engine);
    const mentioned = engineRuns.filter((r) => (mentionsByRun.get(r.id) ?? []).some((m) => m.isOwnBrand && m.mentioned));
    return {
      engine,
      visibility: engineRuns.length ? Math.round((mentioned.length / engineRuns.length) * 100) : 0,
      runs: engineRuns.length,
    };
  });

  // Share of voice across brand + competitors.
  const entityCounts = new Map<string, { isOwnBrand: boolean; count: number }>();
  for (const m of mentions) {
    if (!m.mentioned) continue;
    const cur = entityCounts.get(m.entityName) ?? { isOwnBrand: m.isOwnBrand, count: 0 };
    cur.count++;
    entityCounts.set(m.entityName, cur);
  }
  const totalMentions = [...entityCounts.values()].reduce((s, v) => s + v.count, 0) || 1;
  const shareOfVoice = [...entityCounts.entries()]
    .map(([name, v]) => ({ name, isOwnBrand: v.isOwnBrand, mentions: v.count, pct: Math.round((v.count / totalMentions) * 100) }))
    .sort((a, b) => b.mentions - a.mentions);

  // Prompt-level table (latest run per prompt per engine).
  const promptRows = prompts.map((prompt) => {
    const promptRuns = runs.filter((r) => r.promptId === prompt.id);
    const byEngine: DashboardData["promptRows"][number]["byEngine"] = {};
    for (const engine of engineNames) {
      const latest = promptRuns.filter((r) => r.engine === engine).sort((a, b) => b.ranAt.localeCompare(a.ranAt))[0];
      if (!latest) continue;
      byEngine[engine] = { run: latest, mentions: mentionsByRun.get(latest.id) ?? [] };
    }
    return { prompt, byEngine };
  });

  // Cited domains ranking.
  const domainCounts = new Map<string, number>();
  for (const r of runs) {
    for (const url of r.citedUrls) {
      const d = domainOf(url);
      domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
    }
  }
  const citedDomains = [...domainCounts.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count);

  return { visibilityScore, totalRuns: runs.length, errorRuns, trend, perEngine, shareOfVoice, promptRows, citedDomains };
}

export function listRunsForPrompt(promptId: string): Run[] {
  return db.listRunsByPrompt(promptId).sort((a, b) => b.ranAt.localeCompare(a.ranAt));
}

import { describe, it, expect, vi } from "vitest";
import type { Brand, Mention, Prompt, Run } from "./types";

const state: { prompts: Prompt[]; runs: Run[]; mentions: Mention[] } = {
  prompts: [],
  runs: [],
  mentions: [],
};

vi.mock("./db", () => ({
  db: {
    listPromptsByBrand: (brandId: string) => state.prompts.filter((p) => p.brandId === brandId),
    listRunsByBrand: (brandId: string) => {
      const promptIds = state.prompts.filter((p) => p.brandId === brandId).map((p) => p.id);
      return state.runs.filter((r) => promptIds.includes(r.promptId));
    },
    listMentionsByRunIds: (runIds: string[]) => state.mentions.filter((m) => runIds.includes(m.runId)),
  },
}));

const { buildDashboard } = await import("./scoring");

const brand: Brand = {
  id: "b1",
  userId: "u1",
  name: "Acme",
  domain: "acme.com",
  category: "widgets",
  competitors: ["Beta"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

function reset() {
  state.prompts = [];
  state.runs = [];
  state.mentions = [];
}

function addRun(overrides: Partial<Run> & Pick<Run, "id" | "promptId">) {
  state.runs.push({
    engine: "gemini",
    ranAt: "2026-01-01T00:00:00.000Z",
    responseText: "",
    citedUrls: [],
    status: "ok",
    ...overrides,
  });
}

describe("buildDashboard", () => {
  it("returns a zeroed-out shape for a brand with no prompts or runs", () => {
    reset();
    const data = buildDashboard(brand);
    expect(data.visibilityScore).toBe(0);
    expect(data.totalRuns).toBe(0);
    expect(data.errorRuns).toBe(0);
    expect(data.trend).toEqual([]);
    expect(data.shareOfVoice).toEqual([]);
  });

  it("computes visibility score from the fraction of runs mentioning the own brand", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1" });
    addRun({ id: "r2", promptId: "p1" });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: true, rank: 1, sentiment: "positive" },
      { id: "m2", runId: "r2", entityName: "Acme", isOwnBrand: true, mentioned: false, rank: null, sentiment: null },
    ];
    const data = buildDashboard(brand);
    expect(data.visibilityScore).toBe(50);
    expect(data.totalRuns).toBe(2);
  });

  it("excludes errored runs from all metrics but counts them separately", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", status: "ok" });
    addRun({ id: "r2", promptId: "p1", status: "error" });
    addRun({ id: "r3", promptId: "p1", status: "error" });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: true, rank: 1, sentiment: "positive" },
    ];
    const data = buildDashboard(brand);
    expect(data.totalRuns).toBe(1);
    expect(data.errorRuns).toBe(2);
    expect(data.visibilityScore).toBe(100);
  });

  it("groups trend by calendar day", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", ranAt: "2026-01-01T10:00:00.000Z" });
    addRun({ id: "r2", promptId: "p1", ranAt: "2026-01-02T10:00:00.000Z" });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: true, rank: 1, sentiment: "positive" },
      { id: "m2", runId: "r2", entityName: "Acme", isOwnBrand: true, mentioned: false, rank: null, sentiment: null },
    ];
    const data = buildDashboard(brand);
    expect(data.trend).toEqual([
      { date: "2026-01-01", visibility: 100 },
      { date: "2026-01-02", visibility: 0 },
    ]);
  });

  it("computes share of voice percentages across brand and competitors", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1" });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: true, rank: 1, sentiment: "positive" },
      { id: "m2", runId: "r1", entityName: "Beta", isOwnBrand: false, mentioned: true, rank: 2, sentiment: "neutral" },
    ];
    const data = buildDashboard(brand);
    expect(data.shareOfVoice).toEqual([
      { name: "Acme", isOwnBrand: true, mentions: 1, pct: 50 },
      { name: "Beta", isOwnBrand: false, mentions: 1, pct: 50 },
    ]);
  });

  it("promptRows surfaces competitor mentions alongside own-brand data", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", responseText: "Beta is the top choice." });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: false, rank: null, sentiment: null },
      { id: "m2", runId: "r1", entityName: "Beta", isOwnBrand: false, mentioned: true, rank: 1, sentiment: "positive" },
    ];
    const data = buildDashboard(brand);
    const row = data.promptRows[0].byEngine.gemini!;
    expect(row.run.responseText).toBe("Beta is the top choice.");
    expect(row.mentions).toEqual(state.mentions);
  });

  it("promptRows includes the raw run for the latest run per engine", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", ranAt: "2026-01-01T00:00:00.000Z", responseText: "old" });
    addRun({ id: "r2", promptId: "p1", ranAt: "2026-01-02T00:00:00.000Z", responseText: "new" });
    state.mentions = [];
    const data = buildDashboard(brand);
    expect(data.promptRows[0].byEngine.gemini!.run.id).toBe("r2");
    expect(data.promptRows[0].byEngine.gemini!.run.responseText).toBe("new");
  });

  it("promptRows handles a run where neither own brand nor any competitor was mentioned", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", responseText: "This is unrelated content." });
    state.mentions = [
      { id: "m1", runId: "r1", entityName: "Acme", isOwnBrand: true, mentioned: false, rank: null, sentiment: null },
      { id: "m2", runId: "r1", entityName: "Beta", isOwnBrand: false, mentioned: false, rank: null, sentiment: null },
    ];
    const data = buildDashboard(brand);
    const row = data.promptRows[0].byEngine.gemini!;
    expect(row.mentions.every((m) => !m.mentioned)).toBe(true);
    expect(row.run.responseText).toBe("This is unrelated content.");
  });

  it("ranks cited domains by frequency, normalizing www and scheme", () => {
    reset();
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    addRun({ id: "r1", promptId: "p1", citedUrls: ["https://www.g2.com/x", "capterra.com/y"] });
    addRun({ id: "r2", promptId: "p1", citedUrls: ["g2.com/z"] });
    state.mentions = [];
    const data = buildDashboard(brand);
    expect(data.citedDomains).toEqual([
      { domain: "g2.com", count: 2 },
      { domain: "capterra.com", count: 1 },
    ]);
  });
});

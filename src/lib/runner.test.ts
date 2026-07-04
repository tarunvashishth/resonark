import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Brand, Prompt, Run, Mention } from "./types";

const state: { prompts: Prompt[]; runs: Run[]; mentions: Mention[] } = {
  prompts: [],
  runs: [],
  mentions: [],
};

let nextId = 0;

vi.mock("./db", () => ({
  db: {
    listPromptsByBrand: (brandId: string) => state.prompts.filter((p) => p.brandId === brandId),
    createRun: (input: Omit<Run, "id">) => {
      const run = { ...input, id: `run-${nextId++}` };
      state.runs.push(run);
      return run;
    },
    createMentions: (inputs: Omit<Mention, "id">[]) => {
      const created = inputs.map((m) => ({ ...m, id: `mention-${nextId++}` }));
      state.mentions.push(...created);
      return created;
    },
  },
}));

const askGemini = vi.fn();
const askOpenai = vi.fn();
const askPerplexity = vi.fn();

vi.mock("./engines", () => ({
  ENGINES: {
    gemini: { name: "gemini", live: false, ask: (...args: unknown[]) => askGemini(...args) },
    openai: { name: "openai", live: false, ask: (...args: unknown[]) => askOpenai(...args) },
    perplexity: { name: "perplexity", live: false, ask: (...args: unknown[]) => askPerplexity(...args) },
  },
  extractMentions: vi.fn(() => []),
}));

const { runBrandNow } = await import("./runner");
const { extractMentions } = await import("./engines");

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
  nextId = 0;
  askGemini.mockReset();
  askOpenai.mockReset();
  askPerplexity.mockReset();
  vi.mocked(extractMentions).mockReset();
  vi.mocked(extractMentions).mockReturnValue([]);
}

describe("runBrandNow", () => {
  beforeEach(reset);

  it("returns 0 and creates no runs when the brand has no active prompts", async () => {
    state.prompts = [
      { id: "p1", brandId: "b1", text: "inactive", intentCategory: "x", active: false, createdAt: "" },
    ];
    const count = await runBrandNow(brand, "free");
    expect(count).toBe(0);
    expect(state.runs).toHaveLength(0);
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("only queries engines allowed by the plan (free = gemini only)", async () => {
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    askGemini.mockResolvedValue({ text: "Acme is great", citedUrls: [] });
    const count = await runBrandNow(brand, "free");
    expect(count).toBe(1);
    expect(askGemini).toHaveBeenCalledTimes(1);
    expect(askOpenai).not.toHaveBeenCalled();
    expect(askPerplexity).not.toHaveBeenCalled();
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({ engine: "gemini", status: "ok", responseText: "Acme is great" });
  });

  it("queries every engine on the pro plan for each active prompt", async () => {
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    askGemini.mockResolvedValue({ text: "g", citedUrls: [] });
    askOpenai.mockResolvedValue({ text: "o", citedUrls: [] });
    askPerplexity.mockResolvedValue({ text: "p", citedUrls: [] });
    const count = await runBrandNow(brand, "pro");
    expect(count).toBe(3);
    expect(state.runs.map((r) => r.engine).sort()).toEqual(["gemini", "openai", "perplexity"]);
  });

  it("skips inactive prompts but still runs active ones", async () => {
    state.prompts = [
      { id: "p1", brandId: "b1", text: "active", intentCategory: "x", active: true, createdAt: "" },
      { id: "p2", brandId: "b1", text: "inactive", intentCategory: "x", active: false, createdAt: "" },
    ];
    askGemini.mockResolvedValue({ text: "g", citedUrls: [] });
    const count = await runBrandNow(brand, "free");
    expect(count).toBe(1);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0].promptId).toBe("p1");
  });

  it("records a failed run with status 'error' and the error message when an engine adapter throws, without incrementing the count", async () => {
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    askGemini.mockRejectedValue(new Error("API key invalid"));
    const count = await runBrandNow(brand, "free");
    expect(count).toBe(0);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]).toMatchObject({ engine: "gemini", status: "error", responseText: "API key invalid", citedUrls: [] });
    expect(state.mentions).toHaveLength(0);
  });

  it("falls back to 'Unknown error' when a non-Error value is thrown", async () => {
    state.prompts = [{ id: "p1", brandId: "b1", text: "best widget?", intentCategory: "x", active: true, createdAt: "" }];
    askGemini.mockRejectedValue("some string failure");
    await runBrandNow(brand, "free");
    expect(state.runs[0].responseText).toBe("Unknown error");
  });

  it("continues running remaining prompts/engines after one engine call fails", async () => {
    state.prompts = [
      { id: "p1", brandId: "b1", text: "first", intentCategory: "x", active: true, createdAt: "" },
      { id: "p2", brandId: "b1", text: "second", intentCategory: "x", active: true, createdAt: "" },
    ];
    askGemini.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ text: "ok", citedUrls: [] });
    const count = await runBrandNow(brand, "free");
    expect(count).toBe(1);
    expect(state.runs).toHaveLength(2);
    expect(state.runs.map((r) => r.status)).toEqual(["error", "ok"]);
  });
});

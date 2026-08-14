import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Brand, Prompt, Run, User } from "@/lib/types";

const state: { brands: Brand[]; prompts: Prompt[]; runs: Run[] } = { brands: [], prompts: [], runs: [] };
let sessionUser: User | null = null;

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: async () => sessionUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    getBrand: (brandId: string) => state.brands.find((b) => b.id === brandId),
    getPrompt: (promptId: string) => state.prompts.find((p) => p.id === promptId),
    setPromptActive: (promptId: string, active: boolean) => {
      const p = state.prompts.find((p) => p.id === promptId);
      if (p) p.active = active;
    },
    listRunsByBrand: (brandId: string) =>
      state.runs.filter((r) => state.prompts.find((p) => p.id === r.promptId)?.brandId === brandId),
    updateBrand: (brandId: string, fields: Partial<Brand>) => {
      const b = state.brands.find((b) => b.id === brandId);
      if (b) Object.assign(b, fields);
      return b;
    },
  },
}));

const runBrandNowMock = vi.fn();
vi.mock("@/lib/runner", () => ({
  runBrandNow: (...args: unknown[]) => runBrandNowMock(...args),
}));

const { runNowAction, togglePromptAction, updateBrandAction } = await import("./brand");

function makeUser(overrides: Partial<User> = {}): User {
  return { id: "u1", email: "owner@example.com", plan: "free", createdAt: "", ...overrides };
}

function makeBrand(overrides: Partial<Brand> = {}): Brand {
  return {
    id: "b1",
    userId: "u1",
    name: "Acme",
    domain: "acme.com",
    category: "widgets",
    competitors: [],
    createdAt: "",
    ...overrides,
  };
}

beforeEach(() => {
  state.brands = [];
  state.prompts = [];
  state.runs = [];
  sessionUser = null;
  redirectMock.mockClear();
  runBrandNowMock.mockReset();
});

describe("runNowAction", () => {
  it("throws Not found when the brand belongs to a different user (ownership check)", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "someone-else" })];
    await expect(runNowAction("b1")).rejects.toThrow("Not found");
    expect(runBrandNowMock).not.toHaveBeenCalled();
  });

  it("throws Not found when the brand does not exist", async () => {
    sessionUser = makeUser();
    await expect(runNowAction("missing")).rejects.toThrow("Not found");
  });

  it("redirects to /login when there is no session", async () => {
    sessionUser = null;
    state.brands = [makeBrand()];
    await expect(runNowAction("b1")).rejects.toThrow("REDIRECT:/login");
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("rejects a second run within the cooldown window (rate-limit gap fix)", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    state.prompts = [{ id: "p1", brandId: "b1", text: "q", intentCategory: "x", active: true, createdAt: "" }];
    state.runs = [
      { id: "r1", promptId: "p1", engine: "gemini", ranAt: new Date().toISOString(), responseText: "", citedUrls: [], status: "ok" },
    ];
    await expect(runNowAction("b1")).rejects.toThrow(/wait a moment/);
    expect(runBrandNowMock).not.toHaveBeenCalled();
  });

  it("rejects a concurrent second call that starts before the first finishes (TOCTOU fix)", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    state.prompts = [{ id: "p1", brandId: "b1", text: "q", intentCategory: "x", active: true, createdAt: "" }];
    state.runs = [];

    let resolveRun!: (n: number) => void;
    runBrandNowMock.mockImplementation(
      () => new Promise<number>((resolve) => (resolveRun = resolve))
    );

    const first = runNowAction("b1");
    const second = runNowAction("b1");

    await expect(second).rejects.toThrow(/wait a moment/);
    resolveRun(1);
    await expect(first).resolves.toBe(1);
    expect(runBrandNowMock).toHaveBeenCalledTimes(1);
  });

  it("allows a run once the cooldown window has passed", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    state.prompts = [{ id: "p1", brandId: "b1", text: "q", intentCategory: "x", active: true, createdAt: "" }];
    state.runs = [
      {
        id: "r1",
        promptId: "p1",
        engine: "gemini",
        ranAt: new Date(Date.now() - 61_000).toISOString(),
        responseText: "",
        citedUrls: [],
        status: "ok",
      },
    ];
    runBrandNowMock.mockResolvedValue(1);
    await expect(runNowAction("b1")).resolves.toBe(1);
  });

  it("triggers a run for the owner's brand and passes the user's plan through", async () => {
    sessionUser = makeUser({ id: "u1", plan: "pro" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    runBrandNowMock.mockResolvedValue(7);
    const count = await runNowAction("b1");
    expect(count).toBe(7);
    expect(runBrandNowMock).toHaveBeenCalledWith(state.brands[0], "pro");
  });

  it("passes the free plan through to runBrandNow so plan-scoped engines are respected", async () => {
    sessionUser = makeUser({ id: "u1", plan: "free" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    runBrandNowMock.mockResolvedValue(1);
    await runNowAction("b1");
    expect(runBrandNowMock).toHaveBeenCalledWith(expect.anything(), "free");
  });
});

describe("updateBrandAction", () => {
  const validInput = { name: "Acme v2", domain: "acme.io", category: "widgets", competitors: ["Rival"] };

  it("throws Not found when the brand belongs to a different user (ownership check)", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "someone-else" })];
    await expect(updateBrandAction("b1", validInput)).rejects.toThrow("Not found");
    expect(state.brands[0].name).toBe("Acme");
  });

  it("redirects to /login when there is no session", async () => {
    sessionUser = null;
    state.brands = [makeBrand()];
    await expect(updateBrandAction("b1", validInput)).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects an empty name without writing", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    await expect(updateBrandAction("b1", { ...validInput, name: "" })).rejects.toThrow();
    expect(state.brands[0].name).toBe("Acme");
  });

  it("rejects more than 3 competitors without writing", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    await expect(
      updateBrandAction("b1", { ...validInput, competitors: ["a", "b", "c", "d"] })
    ).rejects.toThrow();
    expect(state.brands[0].competitors).toEqual([]);
  });

  it("updates all editable fields for the owner", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    await updateBrandAction("b1", validInput);
    expect(state.brands[0]).toMatchObject(validInput);
  });
});

describe("togglePromptAction", () => {
  it("throws Not found when the prompt's brand belongs to a different user", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "someone-else" })];
    state.prompts = [{ id: "p1", brandId: "b1", text: "x", intentCategory: "y", active: true, createdAt: "" }];
    await expect(togglePromptAction("p1", false)).rejects.toThrow("Not found");
    expect(state.prompts[0].active).toBe(true);
  });

  it("throws Not found when the prompt does not exist", async () => {
    sessionUser = makeUser();
    await expect(togglePromptAction("missing", false)).rejects.toThrow("Not found");
  });

  it("updates prompt active state when the caller owns the parent brand", async () => {
    sessionUser = makeUser({ id: "u1" });
    state.brands = [makeBrand({ id: "b1", userId: "u1" })];
    state.prompts = [{ id: "p1", brandId: "b1", text: "x", intentCategory: "y", active: true, createdAt: "" }];
    await togglePromptAction("p1", false);
    expect(state.prompts[0].active).toBe(false);
  });
});

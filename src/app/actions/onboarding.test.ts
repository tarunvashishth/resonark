import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Brand, Prompt, User } from "@/lib/types";

const state: { brands: Brand[]; prompts: Prompt[] } = { brands: [], prompts: [] };
let sessionUser: User | null = null;
let nextId = 0;

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/auth", () => ({
  getSession: async () => sessionUser,
}));

vi.mock("@/lib/db", () => ({
  db: {
    listBrandsByUser: (userId: string) => state.brands.filter((b) => b.userId === userId),
    createBrand: (input: Omit<Brand, "id" | "createdAt">) => {
      const brand: Brand = { ...input, id: `brand-${nextId++}`, createdAt: "" };
      state.brands.push(brand);
      return brand;
    },
    createPrompt: (input: Omit<Prompt, "id" | "createdAt">) => {
      const prompt: Prompt = { ...input, id: `prompt-${nextId++}`, createdAt: "" };
      state.prompts.push(prompt);
      return prompt;
    },
  },
}));

vi.mock("@/lib/suggest", () => ({
  suggestPrompts: vi.fn(async () => []),
}));

const { createBrandWithPrompts, fetchSuggestions } = await import("./onboarding");

function makeUser(overrides: Partial<User> = {}): User {
  return { id: "u1", email: "owner@example.com", plan: "free", createdAt: "", ...overrides };
}

function validInput(overrides: Partial<Parameters<typeof createBrandWithPrompts>[0]> = {}) {
  return {
    name: "Acme",
    domain: "acme.com",
    category: "widgets",
    competitors: ["Beta"],
    prompts: [{ text: "best widget?", intentCategory: "comparison" }],
    ...overrides,
  };
}

beforeEach(() => {
  state.brands = [];
  state.prompts = [];
  sessionUser = null;
  nextId = 0;
  redirectMock.mockClear();
});

describe("createBrandWithPrompts", () => {
  it("redirects to /login when there is no session", async () => {
    await expect(createBrandWithPrompts(validInput())).rejects.toThrow("REDIRECT:/login");
  });

  it("rejects invalid input (empty name) via brandSchema validation", async () => {
    sessionUser = makeUser();
    await expect(createBrandWithPrompts(validInput({ name: "" }))).rejects.toThrow();
    expect(state.brands).toHaveLength(0);
  });

  it("rejects invalid input (too many competitors) via brandSchema validation", async () => {
    sessionUser = makeUser();
    await expect(
      createBrandWithPrompts(validInput({ competitors: ["a", "b", "c", "d"] }))
    ).rejects.toThrow();
    expect(state.brands).toHaveLength(0);
  });

  it("rejects invalid input (no prompts) via brandSchema validation", async () => {
    sessionUser = makeUser();
    await expect(createBrandWithPrompts(validInput({ prompts: [] }))).rejects.toThrow();
    expect(state.brands).toHaveLength(0);
  });

  it("throws a plan-limit error instead of creating a brand when the free plan's brand limit is already reached", async () => {
    sessionUser = makeUser({ id: "u1", plan: "free" });
    state.brands = [{ id: "existing", userId: "u1", name: "Old", domain: "old.com", category: "x", competitors: [], createdAt: "" }];
    await expect(createBrandWithPrompts(validInput())).rejects.toThrow(/free plan allows 1 brand/);
    expect(state.brands).toHaveLength(1);
  });

  it("trims prompts to the free plan's maxPrompts (5) even when more are submitted", async () => {
    sessionUser = makeUser({ id: "u1", plan: "free" });
    const manyPrompts = Array.from({ length: 10 }, (_, i) => ({ text: `prompt ${i}`, intentCategory: "x" }));
    await expect(createBrandWithPrompts(validInput({ prompts: manyPrompts }))).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.prompts).toHaveLength(5);
    expect(state.prompts.map((p) => p.text)).toEqual([
      "prompt 0",
      "prompt 1",
      "prompt 2",
      "prompt 3",
      "prompt 4",
    ]);
  });

  it("does not trim prompts beyond submitted count on the pro plan (up to 25 allowed)", async () => {
    sessionUser = makeUser({ id: "u1", plan: "pro" });
    const tenPrompts = Array.from({ length: 10 }, (_, i) => ({ text: `prompt ${i}`, intentCategory: "x" }));
    await expect(createBrandWithPrompts(validInput({ prompts: tenPrompts }))).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.prompts).toHaveLength(10);
  });

  it("creates the brand and redirects to /dashboard on success", async () => {
    sessionUser = makeUser({ id: "u1", plan: "free" });
    await expect(createBrandWithPrompts(validInput())).rejects.toThrow("REDIRECT:/dashboard");
    expect(state.brands).toHaveLength(1);
    expect(state.brands[0]).toMatchObject({ userId: "u1", name: "Acme", domain: "acme.com" });
  });
});

describe("fetchSuggestions", () => {
  it("returns an empty array without calling suggestPrompts when category is blank", async () => {
    const result = await fetchSuggestions("   ");
    expect(result).toEqual([]);
  });
});

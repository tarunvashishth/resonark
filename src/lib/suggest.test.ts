import { describe, it, expect } from "vitest";
import { suggestPrompts } from "./suggest";

describe("suggestPrompts", () => {
  it("returns the requested count", async () => {
    const result = await suggestPrompts("CRM software", 5);
    expect(result).toHaveLength(5);
  });

  it("caps at the number of available templates when count exceeds it", async () => {
    const result = await suggestPrompts("CRM software", 999);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("interpolates the given category into every prompt", async () => {
    const result = await suggestPrompts("email marketing tool", 10);
    for (const p of result) {
      expect(p.text.toLowerCase()).toContain("email marketing tool");
    }
  });

  it("returns no duplicate prompt text within one call", async () => {
    const result = await suggestPrompts("CRM software", 10);
    const texts = result.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

import { describe, it, expect } from "vitest";
import { extractMentions } from "./extract";

const ctx = { brand: "Acme", domain: "acme.com", competitors: ["Beta", "Gamma"] };

describe("extractMentions", () => {
  it("marks an entity not mentioned when its name never appears in the text", () => {
    const [acme] = extractMentions("Beta is a solid choice for this.", ctx);
    expect(acme).toEqual({ entityName: "Acme", isOwnBrand: true, mentioned: false, rank: null, sentiment: null });
  });

  it("ranks entities by order of first appearance, not input order", () => {
    const text = "1. Gamma is fine. 2. Acme is excellent. 3. Beta is pricier.";
    const results = extractMentions(text, ctx);
    const byName = Object.fromEntries(results.map((r) => [r.entityName, r]));
    expect(byName.Gamma.rank).toBe(1);
    expect(byName.Acme.rank).toBe(2);
    expect(byName.Beta.rank).toBe(3);
  });

  it("classifies sentiment from keywords near the mention", () => {
    const [acme] = extractMentions("Acme is an excellent, well-reviewed option.", ctx);
    expect(acme.mentioned).toBe(true);
    expect(acme.sentiment).toBe("positive");
  });

  it("classifies negative sentiment", () => {
    const [acme] = extractMentions("Acme has some limitation worth noting.", ctx);
    expect(acme.sentiment).toBe("negative");
  });

  it("defaults to neutral sentiment with no keyword match", () => {
    const [acme] = extractMentions("Acme is one of several tools available on the market today.", ctx);
    expect(acme.sentiment).toBe("neutral");
  });

  it("matches entity names case-insensitively", () => {
    const [acme] = extractMentions("ACME is a top choice here.", ctx);
    expect(acme.mentioned).toBe(true);
  });

  it("marks own brand correctly among competitors", () => {
    const results = extractMentions("Acme, Beta, and Gamma all compete here.", ctx);
    expect(results.find((r) => r.entityName === "Acme")?.isOwnBrand).toBe(true);
    expect(results.find((r) => r.entityName === "Beta")?.isOwnBrand).toBe(false);
  });
});

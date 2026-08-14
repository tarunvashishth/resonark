import { describe, it, expect, vi, afterEach } from "vitest";
import { askGemini, resolveGeminiCitedUrl } from "../../../shared/engines";

const REDIRECT = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbCdEf123";

function geminiResponse(chunks: { web?: { uri?: string; title?: string } }[]) {
  return {
    candidates: [
      {
        content: { parts: [{ text: "Acme is a top choice." }] },
        groundingMetadata: { groundingChunks: chunks },
      },
    ],
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveGeminiCitedUrl", () => {
  it("replaces grounding redirect URLs with the domain from title", () => {
    expect(resolveGeminiCitedUrl({ uri: REDIRECT, title: "acme.com" })).toBe("https://acme.com");
  });

  it("lowercases and trims domain titles", () => {
    expect(resolveGeminiCitedUrl({ uri: REDIRECT, title: " Acme.COM " })).toBe("https://acme.com");
  });

  it("keeps the redirect URL when title is not a domain", () => {
    expect(resolveGeminiCitedUrl({ uri: REDIRECT, title: "Acme — Official Site" })).toBe(REDIRECT);
    expect(resolveGeminiCitedUrl({ uri: REDIRECT })).toBe(REDIRECT);
  });

  it("passes through non-redirect URLs untouched", () => {
    expect(resolveGeminiCitedUrl({ uri: "https://acme.com/pricing", title: "acme.com" })).toBe(
      "https://acme.com/pricing"
    );
  });

  it("returns undefined when there is no uri", () => {
    expect(resolveGeminiCitedUrl(undefined)).toBeUndefined();
    expect(resolveGeminiCitedUrl({ title: "acme.com" })).toBeUndefined();
  });
});

describe("askGemini", () => {
  it("resolves redirect citations via chunk titles and dedupes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () =>
          geminiResponse([
            { web: { uri: `${REDIRECT}-1`, title: "acme.com" } },
            { web: { uri: `${REDIRECT}-2`, title: "acme.com" } },
            { web: { uri: `${REDIRECT}-3`, title: "Some Page Title" } },
            { web: { uri: "https://direct.example/post" } },
            { web: {} },
          ]),
      })
    );

    const result = await askGemini("who is the best?", "test-key");
    expect(result.text).toBe("Acme is a top choice.");
    expect(result.citedUrls).toEqual(["https://acme.com", `${REDIRECT}-3`, "https://direct.example/post"]);
  });
});

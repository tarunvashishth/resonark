/**
 * Single source of truth for AI-engine calls and mention extraction, shared
 * between the Next.js app (src/lib/engines/*) and the Cloudflare Worker
 * (workers/scheduler/src/engines.ts). Those two run in different JS
 * runtimes (Node vs Workers) with different env-var access (process.env vs
 * an `env` binding), so this module takes API keys as plain arguments
 * instead of reading env itself — each runtime's thin wrapper is the only
 * place that touches its own env source.
 */

export type Engine = "openai" | "gemini" | "perplexity";
export type Plan = "free" | "pro";

export const PLAN_ENGINES: Record<Plan, Engine[]> = {
  free: ["gemini"],
  pro: ["openai", "gemini", "perplexity"],
};

export const PLAN_CADENCE_MS: Record<Plan, number> = {
  free: 7 * 24 * 60 * 60 * 1000,
  pro: 24 * 60 * 60 * 1000,
};

export interface EngineContext {
  brand: string;
  domain: string;
  competitors: string[];
}

export interface EngineResult {
  text: string;
  citedUrls: string[];
}

interface OpenAIResponse {
  output_text?: string;
  output?: { content?: { annotations?: { url?: string }[] }[] }[];
}

export async function askOpenAI(prompt: string, apiKey: string): Promise<EngineResult> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", tools: [{ type: "web_search" }], input: prompt }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as OpenAIResponse;
  const text = data.output_text ?? "";
  const citedUrls = (data.output ?? [])
    .flatMap((o) => o.content ?? [])
    .flatMap((c) => c.annotations ?? [])
    .map((a) => a.url)
    .filter((u): u is string => Boolean(u));
  return { text, citedUrls: [...new Set(citedUrls)] };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
  }[];
}

export async function askGemini(prompt: string, apiKey: string): Promise<EngineResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const citedUrls = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((u): u is string => Boolean(u));
  return { text, citedUrls: [...new Set(citedUrls)] };
}

interface PerplexityResponse {
  choices?: { message?: { content?: string } }[];
  citations?: string[];
}

export async function askPerplexity(prompt: string, apiKey: string): Promise<EngineResult> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as PerplexityResponse;
  return { text: data.choices?.[0]?.message?.content ?? "", citedUrls: data.citations ?? [] };
}

const POSITIVE_WORDS = [
  "top choice",
  "excellent",
  "recommended",
  "favorite",
  "reliable",
  "well-reviewed",
  "solid",
  "great",
];
const NEGATIVE_WORDS = ["limitation", "pricier", "expensive", "mixed reviews", "avoid", "disappointing", "outdated"];

export interface ExtractedMention {
  entityName: string;
  isOwnBrand: boolean;
  mentioned: boolean;
  rank: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
}

/**
 * Heuristic keyword extraction — swap for a Gemini Flash structured-output
 * call once quality against real (non-mock) engine prose needs improving.
 */
export function extractMentions(text: string, ctx: EngineContext): ExtractedMention[] {
  const entities = [{ name: ctx.brand, isOwn: true }, ...ctx.competitors.map((c) => ({ name: c, isOwn: false }))];
  const found = entities
    .map((e) => ({ ...e, index: text.toLowerCase().indexOf(e.name.toLowerCase()) }))
    .filter((e) => e.index !== -1)
    .sort((a, b) => a.index - b.index);
  const rankByName = new Map(found.map((e, i) => [e.name, i + 1]));

  return entities.map((e) => {
    if (!rankByName.has(e.name)) {
      return { entityName: e.name, isOwnBrand: e.isOwn, mentioned: false, rank: null, sentiment: null };
    }
    const idx = found.find((f) => f.name === e.name)!.index;
    const window = text.slice(idx, idx + 160).toLowerCase();
    let sentiment: ExtractedMention["sentiment"] = "neutral";
    if (POSITIVE_WORDS.some((w) => window.includes(w))) sentiment = "positive";
    else if (NEGATIVE_WORDS.some((w) => window.includes(w))) sentiment = "negative";
    return { entityName: e.name, isOwnBrand: e.isOwn, mentioned: true, rank: rankByName.get(e.name)!, sentiment };
  });
}

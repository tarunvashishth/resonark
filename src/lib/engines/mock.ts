import type { Engine } from "../types";
import type { EngineContext, EngineResult } from "./types";

/**
 * Simulates an AI answer-engine response until a real API key is wired in.
 * Produces varied, plausible text so the extraction step and dashboard have
 * something real to chew on — not just pre-baked numbers.
 */

const REVIEW_DOMAINS = ["g2.com", "capterra.com", "reddit.com", "producthunt.com", "trustpilot.com"];

const POSITIVE_PHRASES = [
  "is a top choice for this",
  "is widely recommended and well-reviewed",
  "stands out as an excellent, reliable option",
  "is a favorite among users for its ease of use",
];
const NEUTRAL_PHRASES = [
  "is a reasonable option worth considering",
  "is one of several tools in this space",
  "offers a solid, if unremarkable, feature set",
];
const NEGATIVE_PHRASES = [
  "has some limitations worth noting before you commit",
  "tends to be pricier than comparable alternatives",
  "has mixed reviews on customer support",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const BRAND_MENTION_CHANCE = 0.6;
const COMPETITOR_MENTION_CHANCE = 0.75;
const POSITIVE_TONE_THRESHOLD = 0.55;
const NEUTRAL_TONE_THRESHOLD = 0.8;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const ENGINE_VOICE: Record<Engine, { intro: string }> = {
  openai: { intro: "Here are a few well-regarded options" },
  gemini: { intro: "Based on recent reviews and comparisons, some strong picks are" },
  perplexity: { intro: "According to multiple sources, top options include" },
};

export async function mockAsk(engine: Engine, prompt: string, ctx: EngineContext): Promise<EngineResult> {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));

  const candidates = shuffle([
    { name: ctx.brand, isOwn: true, include: Math.random() < BRAND_MENTION_CHANCE },
    ...ctx.competitors.map((c) => ({ name: c, isOwn: false, include: Math.random() < COMPETITOR_MENTION_CHANCE })),
  ]).filter((c) => c.include);

  // Always mention at least one entity so responses aren't empty.
  if (candidates.length === 0) candidates.push({ name: ctx.competitors[0] ?? ctx.brand, isOwn: false, include: true });

  const lines = candidates.slice(0, 5).map((c, i) => {
    const tone = Math.random();
    const phrase =
      tone < POSITIVE_TONE_THRESHOLD ? pick(POSITIVE_PHRASES) : tone < NEUTRAL_TONE_THRESHOLD ? pick(NEUTRAL_PHRASES) : pick(NEGATIVE_PHRASES);
    return `${i + 1}. **${c.name}** ${phrase}.`;
  });

  const text = `${ENGINE_VOICE[engine].intro} for "${prompt}":\n\n${lines.join("\n")}\n\nYou can find more comparisons on ${pick(
    REVIEW_DOMAINS
  )} and ${pick(REVIEW_DOMAINS)}.`;

  const citedUrls = shuffle([
    ...(candidates.some((c) => c.isOwn) ? [ctx.domain] : []),
    ...REVIEW_DOMAINS.slice(0, 2),
  ]);

  return { text, citedUrls };
}

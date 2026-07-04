const TEMPLATES = [
  (cat: string) => `What is the best ${cat}?`,
  (cat: string) => `What are the top ${cat} options in 2026?`,
  (cat: string) => `Recommend an affordable ${cat} for a small business.`,
  (cat: string) => `What ${cat} do you recommend for startups?`,
  (cat: string) => `Compare the leading ${cat} tools.`,
  (cat: string) => `What's the most reliable ${cat} for beginners?`,
  (cat: string) => `Which ${cat} has the best customer support?`,
  (cat: string) => `What ${cat} offers the best value for money?`,
  (cat: string) => `I'm switching ${cat} providers — what should I consider?`,
  (cat: string) => `What are alternatives to popular ${cat} tools?`,
];

export interface SuggestedPrompt {
  text: string;
  intentCategory: string;
}

/**
 * Templated buyer-intent prompt suggestions. Swap for a real LLM call
 * (e.g. Gemini reading the brand's homepage) once GEMINI_API_KEY is set —
 * same return shape, so the onboarding UI doesn't need to change.
 */
export async function suggestPrompts(category: string, count = 10): Promise<SuggestedPrompt[]> {
  const shuffled = [...TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, TEMPLATES.length)).map((tpl) => ({
    text: tpl(category),
    intentCategory: "buyer-intent",
  }));
}

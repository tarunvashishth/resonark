import type { EngineAdapter, EngineContext } from "./types";
import { askPerplexity } from "../../../shared/engines";
import { mockAsk } from "./mock";

const API_KEY = process.env.PERPLEXITY_API_KEY;

export const perplexityEngine: EngineAdapter = {
  name: "perplexity",
  live: Boolean(API_KEY),
  async ask(prompt, ctx: EngineContext) {
    if (!API_KEY) return mockAsk("perplexity", prompt, ctx);
    return askPerplexity(prompt, API_KEY);
  },
};

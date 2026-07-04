import type { Engine } from "../types";
import type { EngineAdapter } from "./types";
import { openaiEngine } from "./openai";
import { geminiEngine } from "./gemini";
import { perplexityEngine } from "./perplexity";

export const ENGINES: Record<Engine, EngineAdapter> = {
  openai: openaiEngine,
  gemini: geminiEngine,
  perplexity: perplexityEngine,
};

export { extractMentions } from "./extract";
export type { EngineContext, EngineResult, EngineAdapter } from "./types";

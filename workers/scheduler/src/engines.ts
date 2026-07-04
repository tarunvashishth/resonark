import type { Env } from "./supabase";
import { askOpenAI, askGemini, askPerplexity, type Engine, type EngineResult } from "../../../shared/engines";

export type { Engine, EngineContext, EngineResult } from "../../../shared/engines";
export { extractMentions } from "../../../shared/engines";

export async function askEngine(engine: Engine, prompt: string, env: Env): Promise<EngineResult> {
  if (engine === "openai" && env.OPENAI_API_KEY) return askOpenAI(prompt, env.OPENAI_API_KEY);
  if (engine === "gemini" && env.GEMINI_API_KEY) return askGemini(prompt, env.GEMINI_API_KEY);
  if (engine === "perplexity" && env.PERPLEXITY_API_KEY) return askPerplexity(prompt, env.PERPLEXITY_API_KEY);
  throw new Error(`No API key configured for engine "${engine}"`);
}

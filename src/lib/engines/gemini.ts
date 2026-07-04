import type { EngineAdapter, EngineContext } from "./types";
import { askGemini } from "../../../shared/engines";
import { mockAsk } from "./mock";

const API_KEY = process.env.GEMINI_API_KEY;

export const geminiEngine: EngineAdapter = {
  name: "gemini",
  live: Boolean(API_KEY),
  async ask(prompt, ctx: EngineContext) {
    if (!API_KEY) return mockAsk("gemini", prompt, ctx);
    return askGemini(prompt, API_KEY);
  },
};

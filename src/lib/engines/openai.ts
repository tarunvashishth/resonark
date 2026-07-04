import type { EngineAdapter, EngineContext } from "./types";
import { askOpenAI } from "../../../shared/engines";
import { mockAsk } from "./mock";

const API_KEY = process.env.OPENAI_API_KEY;

export const openaiEngine: EngineAdapter = {
  name: "openai",
  live: Boolean(API_KEY),
  async ask(prompt, ctx: EngineContext) {
    if (!API_KEY) return mockAsk("openai", prompt, ctx);
    return askOpenAI(prompt, API_KEY);
  },
};

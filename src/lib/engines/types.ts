import type { Engine } from "../types";
import type { EngineContext, EngineResult } from "../../../shared/engines";

export type { EngineContext, EngineResult };

export interface EngineAdapter {
  name: Engine;
  /** True once a real API key is configured; false means responses are simulated. */
  live: boolean;
  ask(prompt: string, ctx: EngineContext): Promise<EngineResult>;
}

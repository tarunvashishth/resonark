import { PLAN_ENGINES, type Engine, type Plan } from "../../shared/engines";

export type { Engine, Plan };

// Pricing/upgrade UI is hidden while everyone is on the free tier. Flip to
// true to bring back the pricing section and the "Upgrade to Pro" CTA —
// PLAN_LIMITS and the Stripe webhook stay wired underneath either way.
export const PRICING_ENABLED = false;

export const PLAN_LIMITS: Record<
  Plan,
  { maxBrands: number; maxPrompts: number; engines: Engine[]; cadence: "weekly" | "daily" }
> = {
  free: { maxBrands: 1, maxPrompts: 5, engines: PLAN_ENGINES.free, cadence: "weekly" },
  pro: { maxBrands: 3, maxPrompts: 25, engines: PLAN_ENGINES.pro, cadence: "daily" },
};

export interface User {
  id: string;
  email: string;
  plan: Plan;
  createdAt: string;
}

export interface Brand {
  id: string;
  userId: string;
  name: string;
  domain: string;
  category: string;
  competitors: string[];
  createdAt: string;
}

export interface Prompt {
  id: string;
  brandId: string;
  text: string;
  intentCategory: string;
  active: boolean;
  createdAt: string;
}

export type RunStatus = "ok" | "error";

export interface Run {
  id: string;
  promptId: string;
  engine: Engine;
  ranAt: string;
  responseText: string;
  citedUrls: string[];
  status: RunStatus;
}

export type Sentiment = "positive" | "neutral" | "negative";

export interface Mention {
  id: string;
  runId: string;
  entityName: string;
  isOwnBrand: boolean;
  mentioned: boolean;
  rank: number | null;
  sentiment: Sentiment | null;
}

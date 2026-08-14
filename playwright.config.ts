import { defineConfig } from "@playwright/test";

/**
 * E2E suite for the two full-stack funnel flows (TODOS.md #3). Runs against
 * a dev server on a dedicated port with GEMINI_API_KEY blanked so engine
 * calls use the deterministic-enough mock adapter — fast, free, no live API
 * traffic. Sessions are minted via the Supabase admin API (see
 * e2e/supabase-admin.ts), so the suite needs the service-role key available
 * (env or workers/scheduler/.dev.vars).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // Serial: flow 2 uses the brand flow 1 creates.
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3111",
  },
  webServer: {
    command: "npm run dev -- -p 3111",
    url: "http://localhost:3111",
    reuseExistingServer: true,
    env: { GEMINI_API_KEY: "" },
  },
});

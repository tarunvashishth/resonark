# TODOs

## Completed

### 1. Migrate persistence from local JSON store to Supabase

**Completed:** 2026-07-05. Provisioned a real Supabase project (`echorank` — predates the Resonark rename, region ap-northeast-1), applied `supabase/migrations/0001_init.sql`, and rewrote `src/lib/db.ts` and `src/lib/auth.ts` against it.

**What changed from the original plan:**
- `db.ts` is now fully async, querying Postgres via `@supabase/supabase-js`/`@supabase/ssr` through a per-request server client (`src/lib/supabase/server.ts`) so every query goes through RLS as the logged-in user. All callers (`runner.ts`, `scoring.ts`, server actions, dashboard/onboarding pages) updated to `await`.
- Auth is real Supabase Auth — but as **email OTP code**, not magic link. Magic link's PKCE code-exchange (a separate `/auth/callback` route) couldn't be verified live in this environment (no inbox access, and Supabase's default email sender is rate-limited) and had an unresolved cross-request cookie question. Email-OTP-code verification happens in one request (`verifyEmailCodeAction`), which is simpler and was verified end-to-end against the real project (session establishment, cookie persistence across a separate request, onboarding, brand creation, run, and the context-view feature all confirmed working).
- `src/lib/session-token.ts` (custom HMAC cookie scheme) and `devSignIn` are gone — fully superseded by real Supabase Auth.
- Added `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) to refresh the auth session cookie on every request, per `@supabase/ssr`'s required pattern.

**Verified against the real Supabase project:** signup → profile creation (via the `handle_new_user` trigger) → onboarding → brand creation → run → dashboard → context-view (competitor mentions + raw response text), all working with real Postgres + RLS.

**Still open:** the app remains local-dev-only (not yet deployed to Cloudflare) — that's the next real step to unlock actually reaching a real prospect, per the original motivation for this migration.

---

## 2. Parallelize prompt×engine calls before Pro plan ships

**Completed** (verified 2026-07-11): `shared/concurrency.ts`'s `runWithConcurrency` (cap 6, unit-tested in `concurrency.test.ts`) now drives both `src/lib/runner.ts`'s `runBrandNow` and `workers/scheduler/src/index.ts`'s `runBrand`.

**What:** In `src/lib/runner.ts`'s `runBrandNow` and `workers/scheduler/src/index.ts`'s `runBrand`, batch engine calls with a concurrency cap instead of a fully sequential `for` loop.

**Why:** At free-tier scale (5 prompts × 1 engine) sequential calls take up to ~2.5s, which is fine. At Pro-tier scale (25 prompts × 3 engines = 75 calls) sequential execution could take 35+ seconds, blocking the "Run now" HTTP response in the Next app and risking CPU-time limits in the Cloudflare Worker once mock delays are replaced by real (slower) API latency.

**Pros:** Prevents a known scaling cliff from shipping silently alongside a new paid tier.

**Cons:** No user-visible value until a Pro tier actually exists — building it now would be premature.

**Depends on:** Stripe billing / Pro plan work landing first (Pro isn't purchasable yet — free is the only real tier).

---

## 3. Add a Playwright E2E suite for two full-stack flows

**What:** Cover the two flows flagged `[→E2E]` in the eng-review test-coverage diagram:
  - Free-plan onboarding: selecting 10 suggested prompts correctly saves only the first 5 (plan limit trim).
  - Double-clicking "Run now" doesn't produce duplicate or corrupted run/mention rows.

**Why:** These are full-stack flows through Server Actions + the DB that Vitest's unit tests (added 2026-07-04, covering `scoring.ts`, `extract.ts`, `session-token.ts`, `suggest.ts`) can't exercise realistically — they need a real browser + server round-trip.

**Pros:** Closes the last identified coverage gap from the eng review; catches UI-level regressions unit tests structurally can't see.

**Cons:** Introduces a second test framework (Playwright, plus a browser download) — a real infra addition, not a quick add.

**Depends on:** Nothing blocking — can be picked up any time; reasonable to bundle with the Supabase migration (#1) so E2E tests are written against the final persistence layer rather than twice.

---

## 4. Real competitor detection + content-gap signals (v2 of the context-view feature)

**What:** Detect competitors an AI engine cites that are NOT in `Brand.competitors` (freeform NER/entity matching, since v1 only covers declared competitors via keyword substring match), plus specific content-gap signals correlating with citation — author bio presence, structured data/citations on the brand's own site, etc.

**Why:** v1 (context view, shipped 2026-07-04) surfaces known-competitor mentions and raw response text using the existing `extractMentions()` heuristic — it does not detect undeclared competitors and does not diagnose *why* a competitor got cited over the brand. This is the gap between "context view" (what v1 is) and "diagnostic layer" (the original ambition, deferred to v2).

**Pros:** Closes the actual "why you're invisible" gap that the GEO/AEO market research flagged as the difference between a real product and a vanity dashboard; would meaningfully differentiate beyond Otterly/Profound-style monitoring.

**Cons:** Real NLP/NER work, not a data-reshape — meaningfully more effort than v1. Content-gap signals (author bio, structured data) likely require new scraping/crawling infrastructure, not just LLM response parsing.

**Depends on:** v1 shipping and proving useful in front of real users; validation replies from The Assignment (the agency-owner contact + 2-3 more agency owners) confirming the wedge holds. Do not start this before that signal comes back positive — see the design doc's Fallback section.

---

## 5. Brand-settings page to edit competitors post-onboarding

**Completed:** 2026-07-09. `/dashboard/settings` (linked from the dashboard header) edits name/domain/category/competitors via `updateBrandAction` (`src/app/actions/brand.ts`, same zod limits as onboarding, ownership-checked) and `db.updateBrand`. Covered by unit tests in `brand.test.ts`.

---

## 6. Mobile-responsive dashboard Prompts table

**Completed:** 2026-07-09. Below `md` the Prompts table renders as per-prompt cards (engine rows with badge + expandable details); shared `MentionBadge`/`MentionDetails` components keep the two layouts in sync. Dashboard header now flex-wraps. Verified live at 375px with real Gemini runs: no horizontal overflow, details expand correctly.

---

## 7. Derive plan cadence label from PLAN_CADENCE_MS instead of a second literal

**Completed:** 2026-07-09. `planCadenceLabel()` in `shared/engines.ts` derives the label from `PLAN_CADENCE_MS`; `PLAN_LIMITS` in `src/lib/types.ts` now uses it instead of a second literal.

---

## 8. Test coverage: db.ts, real engine API wrappers, workers/scheduler

**What:** Three modules identified during `/ship`'s coverage audit (2026-07-04) still have zero test coverage, each needing new test infrastructure rather than a quick top-up:
  - `src/lib/db.ts` — needs an injectable/temp-dir path so tests can exercise the real file-backed store (currently every other module mocks `./db`).
  - `shared/engines.ts`'s `askOpenAI`/`askGemini`/`askPerplexity` — needs `fetch` mocking to test non-ok response handling and response-shape parsing.
  - `workers/scheduler/src/index.ts` — needs its own test harness (separate package, no vitest config wired up yet) to cover `isDue()` cadence gating, `hasFreshRun()`, and weekly-digest logic.

**Why:** These were explicitly deferred during `/ship`'s coverage-gate override (shipped at ~57% coverage) because closing them requires new test infrastructure, not just more unit tests.

**Pros:** Closes the remaining real coverage gaps in the codebase; each is a well-scoped, independent piece of infra work.

**Cons:** Three separate infra additions (fs-mocking harness, fetch-mocking, a new package's test setup) — not a single quick PR.

**Depends on:** Nothing blocking — can be picked up any time, independently of each other.

---

---

## 12. profiles.email goes stale if a user's auth email changes

**Completed:** 2026-07-09. `supabase/migrations/0003_sync_profile_email.sql` adds an `AFTER UPDATE OF email ON auth.users` trigger mirroring the new email to `profiles.email`. Applied to the live project (`sync_profile_email`).

---

## 13. Weekly digest fan-out has no per-user error isolation

**Completed:** 2026-07-09. Each user's digest work in `sendWeeklyDigests` (`workers/scheduler/src/index.ts`) is wrapped in try/catch — log and continue (skip semantics; no retry until next run, matching how per-engine failures are handled in `runBrand`).

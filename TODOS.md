# TODOs

## Completed

### 1. Migrate persistence from local JSON store to Supabase

**Completed:** 2026-07-05. Provisioned a real Supabase project (`echorank`, region ap-northeast-1), applied `supabase/migrations/0001_init.sql`, and rewrote `src/lib/db.ts` and `src/lib/auth.ts` against it.

**What changed from the original plan:**
- `db.ts` is now fully async, querying Postgres via `@supabase/supabase-js`/`@supabase/ssr` through a per-request server client (`src/lib/supabase/server.ts`) so every query goes through RLS as the logged-in user. All callers (`runner.ts`, `scoring.ts`, server actions, dashboard/onboarding pages) updated to `await`.
- Auth is real Supabase Auth — but as **email OTP code**, not magic link. Magic link's PKCE code-exchange (a separate `/auth/callback` route) couldn't be verified live in this environment (no inbox access, and Supabase's default email sender is rate-limited) and had an unresolved cross-request cookie question. Email-OTP-code verification happens in one request (`verifyEmailCodeAction`), which is simpler and was verified end-to-end against the real project (session establishment, cookie persistence across a separate request, onboarding, brand creation, run, and the context-view feature all confirmed working).
- `src/lib/session-token.ts` (custom HMAC cookie scheme) and `devSignIn` are gone — fully superseded by real Supabase Auth.
- Added `src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) to refresh the auth session cookie on every request, per `@supabase/ssr`'s required pattern.

**Verified against the real Supabase project:** signup → profile creation (via the `handle_new_user` trigger) → onboarding → brand creation → run → dashboard → context-view (competitor mentions + raw response text), all working with real Postgres + RLS.

**Still open:** the app remains local-dev-only (not yet deployed to Cloudflare) — that's the next real step to unlock actually reaching a real prospect, per the original motivation for this migration.

---

## 2. Parallelize prompt×engine calls before Pro plan ships

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

**What:** A page/form to edit a brand's name, domain, category, and competitors after the one-time onboarding wizard.

**Why:** Surfaced during `/plan-design-review` (Pass 2, empty-competitor-state discussion, 2026-07-04) — there is currently no way to set or change `Brand.competitors` after onboarding. This limits both the existing share-of-voice chart and the new context-view feature (TODOS.md #4's v1): if a brand's competitive landscape changes, or a user skipped adding competitors during onboarding, they have no path to fix it.

**Pros:** Unlocks real value from features that already depend on `Brand.competitors` (share-of-voice, context view); closes an obvious product gap for a self-serve tool.

**Cons:** New page + form + server action — a real feature, not a quick add.

**Depends on:** Nothing blocking — can be picked up any time.

---

## 6. Mobile-responsive dashboard Prompts table

**What:** Responsive layout for the dashboard's Prompts table (likely a card-based layout below some breakpoint, replacing the one-column-per-engine table).

**Why:** Surfaced during `/plan-design-review` (Pass 6, 2026-07-04) — the table has one column per tracked AI engine (up to 3 on Pro plan) and likely overflows horizontally on mobile viewports (375px). Pre-existing, not caused by the context-view feature, but real: EchoRank is self-serve SaaS and founders/agency owners will check it from their phones.

**Pros:** Fixes a real usability gap for mobile users of a self-serve product.

**Cons:** Likely needs a genuinely different mobile layout (cards, not a shrunk table), not just CSS tweaks — real design + implementation work.

**Depends on:** Nothing blocking — can be picked up any time.

---

## 7. Derive plan cadence label from PLAN_CADENCE_MS instead of a second literal

**What:** `PLAN_LIMITS[plan].cadence` (`src/lib/types.ts`, the "weekly"/"daily" string shown in the dashboard UI) and `PLAN_CADENCE_MS` (`shared/engines.ts`, the millisecond value that actually drives `workers/scheduler`'s scheduling) encode the same fact independently.

**Why:** Surfaced during `/ship`'s maintainability specialist review (2026-07-04). Nothing ties the two together — changing one without the other would silently desync the dashboard's displayed cadence from the worker's real schedule.

**Pros:** Removes a real drift risk with a small, self-contained fix (a helper that maps `PLAN_CADENCE_MS` to a display string).

**Cons:** Touches two files (`shared/engines.ts`, `src/lib/types.ts`) — a real code change, not pure cleanup.

**Depends on:** Nothing blocking — can be picked up any time.

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

**What:** `handle_new_user()` (`supabase/migrations/0001_init.sql`) only mirrors `auth.users.email` to `profiles.email` on INSERT. There's no corresponding trigger for UPDATE, so if a user ever changes their auth email, `profiles.email` — which the weekly digest worker reads — goes stale and digests get sent to the old address.

**Why:** Surfaced during `/ship`'s adversarial review (2026-07-04). Not currently reachable (no email-change UI exists yet), but worth fixing alongside the migration work in TODOS.md #1 before it becomes a real bug.

**Pros:** Small, well-scoped SQL fix (an `AFTER UPDATE ON auth.users` trigger, or an upsert that updates on conflict).

**Cons:** None significant.

**Depends on:** Reasonable to bundle with TODOS.md #1 (Supabase migration) since it's the same schema file and same migration work.

---

## 13. Weekly digest fan-out has no per-user error isolation

**What:** `sendWeeklyDigests` (`workers/scheduler/src/index.ts`) checks `res.ok` after each Resend call (fixed this session) but doesn't wrap each user's work in try/catch — a thrown exception (network abort, DNS failure, timeout) on one user's request aborts the whole batch, skipping digests for every subsequent user in that run with no retry until next Monday.

**Why:** Surfaced during `/ship`'s adversarial review (2026-07-04). This needs a product/ops decision (retry now vs. skip vs. alert) more than a mechanical fix.

**Pros:** Prevents one user's transient failure from silently dropping digests for everyone processed after them in the same run.

**Cons:** The right behavior (retry? alert? just skip and log?) is a product call, not obvious from the code alone.

**Depends on:** Nothing blocking — can be picked up any time, once the retry/alert semantics are decided.

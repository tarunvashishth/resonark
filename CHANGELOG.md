# Changelog

## [0.3.0.0] - 2026-07-05

### Added
- Real sign-in: a 6-digit code is emailed to you and verified in the app — no more instant unverified sign-in.

### Changed
- All your data (brands, prompts, checks, results) now lives in a real cloud database (Supabase Postgres) instead of a local file, with per-user row-level security. This clears the main blocker to deploying the app to a real URL.

### Removed
- The dev-only fake sign-in and its custom session-cookie scheme, both fully replaced by Supabase Auth.

## [0.2.0.0] - 2026-07-04

### Added
- Sign in, onboarding wizard (brand name, domain, category, competitors, prompt selection), and dashboard for tracking whether ChatGPT, Gemini, and Perplexity mention your brand for buyer-intent prompts.
- Free and Pro plans with per-plan prompt/brand limits and check cadence (weekly on free, daily on pro).
- "Run now" button to check AI visibility on demand, with a cooldown so it can't be spammed.
- Dashboard shows a visibility score, trend over time, per-engine breakdown, share of voice against competitors, and most-cited sources.
- Each tracked prompt now has an expandable row showing which competitors were mentioned instead of you (with rank and sentiment) and the full AI response, so you can see exactly what's happening, not just a pass/fail badge.
- A Cloudflare Worker that runs checks on a schedule and sends a weekly email digest.
- Real OpenAI, Gemini, and Perplexity integration (falls back to a realistic simulated engine per-provider when no API key is configured, so the whole app works out of the box).

### Fixed
- Closed an authentication gap where sign-in had no production safeguard.
- Closed a gap where the "Run now" check had no limit on how often it could be triggered, including under rapid/concurrent clicks.
- Fixed a database trigger that could fail signup on retry.

### Changed
- Initialized semantic versioning for the project (this is the first tracked release).

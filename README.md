# Resonark

AI visibility monitoring — tracks whether ChatGPT, Gemini, and Perplexity mention a brand for buyer-intent prompts, self-serve, for small brands priced out of Profound/Peec/Otterly ($100-500+/mo).

## Status: deployed to Cloudflare, mock AI engines until keys are set

Live at https://echorank.tarun-vashishth093.workers.dev (deployed 2026-07-07 under the old name — the next `npm run cf:deploy` creates the worker as `resonark`; delete the old `echorank` workers after cutover). Persistence and auth run against a real Supabase project (Postgres + Auth) with email-OTP-code sign-in; RLS policies scope every table to its owning user. The scheduler worker (`resonark-scheduler`, formerly `echorank-scheduler`, cron `0 13 * * *`) is deployed against the same Supabase project and verified via `wrangler dev --test-scheduled`.

**What's left before charging real users** (founder-only steps sequenced in LAUNCH.md):
- `GEMINI_API_KEY` (free tier at aistudio.google.com — the free plan's only engine) must be set as a secret on both workers, or checks return simulated results. `OPENAI_API_KEY`/`PERPLEXITY_API_KEY` only matter once Pro exists.
- Auth uses Supabase's default (rate-limited) email sender — configure custom SMTP in the Supabase dashboard before real signups. Weekly digests use Brevo: set `BREVO_API_KEY`/`BREVO_SENDER` on the scheduler worker.
- Billing is implemented (Stripe payment link on the dashboard + `src/app/api/stripe/webhook` updates `profiles.plan`; runner parallelization per TODOS.md #2 shipped too). Still needed on the Stripe side: webhook endpoint + `STRIPE_WEBHOOK_SECRET` secret on the app worker, customer portal, and the USD payment link — see LAUNCH.md Part 1 §4.
- Apply `supabase/migrations/0004_lock_profile_writes.sql` to production. Without it the 0001 `for all` policy lets any signed-in user PATCH `profiles.plan` to `pro` via PostgREST — Pro would be free for anyone who opens devtools.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000, mock AI engines by default
npm test          # vitest — unit tests for scoring, extraction, suggestions, auth actions
npm run build     # production Next.js build
```

Copy `.env.local.example` to `.env.local` and fill in `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from your Supabase project settings. Add `OPENAI_API_KEY`/`GEMINI_API_KEY`/`PERPLEXITY_API_KEY` to swap in real AI engines — each falls back to the mock independently, so you can mix real and simulated engines.

## Cloudflare

`npm run cf:deploy` builds with OpenNext and deploys the app worker (`resonark`). Note: the session-refresh middleware lives in `src/middleware.ts` (edge runtime) rather than Next 16's `proxy.ts`, because OpenNext Cloudflare does not support Node.js middleware. Secrets bundled from `.env.local` at build time include only `SUPABASE_URL`/`SUPABASE_ANON_KEY` — keep the service-role key out of `.env.local` (it lives in `workers/scheduler/.dev.vars`).

The scheduler worker (`workers/scheduler/`) is a separate Wrangler project — see its own README for deploy steps.

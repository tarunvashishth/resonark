# EchoRank

AI visibility monitoring — tracks whether ChatGPT, Gemini, and Perplexity mention a brand for buyer-intent prompts, self-serve, for small brands priced out of Profound/Peec/Otterly ($100-500+/mo).

## Status: real Supabase backend, not yet deployed

Persistence and auth run against a real Supabase project (Postgres + Auth) — `src/lib/db.ts` and `src/lib/auth.ts` are no longer the local-JSON-file MVP store, and sign-in is real email-OTP-code auth (Supabase Auth), not a fake email-only sign-in. `supabase/migrations/0001_init.sql` is applied; RLS policies scope every table to its owning user.

**What's left before a real deploy:**
- The app hasn't been deployed to Cloudflare yet — `npm run cf:deploy` is still untested against the Supabase-backed version. `wrangler.jsonc`/`open-next.config.ts` are wired up; this is the next real step (see TODOS.md).
- Auth uses Supabase's default (rate-limited) email sender — fine for low-volume testing, but a custom SMTP provider should be configured in the Supabase dashboard before real signups.
- The scheduler worker (`workers/scheduler/`) already talks to the same Supabase project over REST — it should now be wired to the same data as the app (same `auth.users`/`profiles` schema), but hasn't been re-verified against it since this migration.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000, mock AI engines by default
npm test          # vitest — unit tests for scoring, extraction, suggestions, auth actions
npm run build     # production Next.js build
```

Copy `.env.local.example` to `.env.local` and fill in `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` from your Supabase project settings. Add `OPENAI_API_KEY`/`GEMINI_API_KEY`/`PERPLEXITY_API_KEY` to swap in real AI engines — each falls back to the mock independently, so you can mix real and simulated engines.

## Cloudflare (scaffolded, not deployed yet)

`wrangler.jsonc` and `open-next.config.ts` are wired up so `npm run preview` (build + local `wrangler dev`) proves the app *renders* under the real Workers runtime. A real `npm run cf:deploy` against the Supabase-backed version hasn't been done yet — see TODOS.md.

The scheduler worker (`workers/scheduler/`) is a separate Wrangler project — see its own README for deploy steps.

# EchoRank

AI visibility monitoring — tracks whether ChatGPT, Gemini, and Perplexity mention a brand for buyer-intent prompts, self-serve, for small brands priced out of Profound/Peec/Otterly ($100-500+/mo).

## Status: local MVP, not production-ready

This is a fully working demo you can click through end-to-end locally (`npm run dev`), backed by simulated AI-engine responses (`src/lib/engines/mock.ts`) so it works with zero API keys. But **the persistence layer is not built for production** — this is the single most important thing to know before touching deploy:

- `src/lib/db.ts` is a local JSON-file store. It only runs under real Node.js (`next dev`/`next start`). **It cannot run on Cloudflare Workers** — verified by actually deploying this app locally via `wrangler dev`: any write (sign in, create a brand, run a check) throws `fs.mkdirSync: EPERM operation not permitted`, because Workers' `nodejs_compat` shim has no real writable filesystem.
- The Cloudflare Worker in `workers/scheduler/` already talks to a real Supabase project over REST — but no Supabase project exists yet, and the running app's cookie-based auth (`src/lib/auth.ts`) never populates the `auth.users`/`profiles` tables that worker expects. The two halves of this project are not wired to the same data today.

**Going to production requires:** provision a Supabase project, run `supabase/migrations/0001_init.sql`, replace `src/lib/db.ts`'s functions with `@supabase/supabase-js` calls, and replace `src/lib/auth.ts`'s cookie scheme with `supabase.auth.*`. This is a rewrite of the persistence layer, not a config change — budget real time for it.

## Local development

```bash
npm install
npm run dev       # http://localhost:3000, mock AI engines, local JSON store
npm test          # vitest — unit tests for scoring, extraction, session tokens, suggestions
npm run build     # production Next.js build
```

Copy `.env.local.example` to `.env.local` to swap in real `OPENAI_API_KEY` / `GEMINI_API_KEY` / `PERPLEXITY_API_KEY` — each engine falls back to the mock independently, so you can mix real and simulated engines.

## Cloudflare (scaffolded, not deployable yet)

`wrangler.jsonc` and `open-next.config.ts` are wired up so `npm run preview` (build + local `wrangler dev`) proves the app *renders* under the real Workers runtime — static pages and pure-React routes work. But per the section above, anything that touches `db.ts` will fail until the Supabase rewrite lands. Don't run `npm run cf:deploy` until that's done.

The scheduler worker (`workers/scheduler/`) is a separate Wrangler project — see its own README for deploy steps once Supabase exists.

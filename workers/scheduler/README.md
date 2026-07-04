# EchoRank scheduler worker

Cloudflare Worker with a daily Cron Trigger. Reads brands from Supabase via
PostgREST, decides which are due for a check (free = weekly, pro = daily),
queries the configured AI engines, extracts mentions, and writes `runs` /
`mentions` rows back to Supabase. Sends a Resend weekly digest on Mondays.

Not deployed yet — this repo has no Supabase project or Cloudflare account
connected. To go live:

```
wrangler login
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put PERPLEXITY_API_KEY
wrangler secret put RESEND_API_KEY
```

Then set `vars.SUPABASE_URL` in `wrangler.jsonc` to the real project URL and
run `npm run deploy`. Test the cron handler locally first with `npm run dev`
(runs `wrangler dev --test-scheduled`).

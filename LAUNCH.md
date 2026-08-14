# Resonark launch runbook

Everything below is founder-only work — dashboard credentials, money, or outreach.
Sequenced so nothing ships broken. Part 1 is ~30 minutes end to end.

## Part 1 — Go-live sequence

### 1. Enable Google sign-in (5 min)

The OAuth code is deployed but feature-gated: the "Continue with Google"
button only renders when `GOOGLE_AUTH_ENABLED=1` is set, so nothing ships
broken while the provider is unconfigured. To turn it on:

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):
   create an **OAuth client ID** (type: Web application).
   - Authorized redirect URI: `https://xzalrxevjvpescalupzu.supabase.co/auth/v1/callback`
2. [Supabase → Auth → Providers → Google](https://supabase.com/dashboard/project/xzalrxevjvpescalupzu/auth/providers):
   enable, paste client ID + secret.
3. [Supabase → Auth → URL Configuration](https://supabase.com/dashboard/project/xzalrxevjvpescalupzu/auth/url-configuration):
   add to redirect allowlist:
   - `https://resonark.tarun-vashishth093.workers.dev/auth/callback`
   - `http://localhost:3000/auth/callback` (local dev)
4. Add `GOOGLE_AUTH_ENABLED=1` to `.env.local` (it's bundled into the app
   worker at build time) and redeploy: `npm run cf:deploy`.
5. Smoke test: /login → Continue with Google → should reach Google's consent screen.

### 2. Commit and deploy (10 min)

**First:** apply `supabase/migrations/0004_lock_profile_writes.sql` to production
(Supabase SQL editor, or MCP like 0002 was). It closes an RLS hole that lets any
signed-in user set their own `profiles.plan` to `pro` via PostgREST without
paying. Do not take payments before this is applied.

```sh
git status                      # review the session's changes
# commit on feat/supabase-migration, merge/PR to main per your flow
npm test && npx tsc --noEmit    # gates (89 tests green as of 2026-07-09)
npm run cf:deploy               # app worker: resonark
cd workers/scheduler && npx wrangler deploy   # scheduler: resonark-scheduler
```

Post-deploy smoke test: sign in (email code + Google), run a check, open
/dashboard/settings, confirm "Most-cited sources" shows real domains.

### 3. Domain (15 min, can happen any time)

1. Register `resonark.com` (was free at the 2026-07-07 DNS check).
2. Cloudflare → Workers → `resonark` → add custom domain.
3. Update the hardcoded workers.dev URL in: `src/app/layout.tsx`
   (`metadataBase`), `src/app/robots.ts`, `src/app/sitemap.ts`,
   `workers/scheduler/src/index.ts` (digest link).
4. Update the Supabase redirect allowlist (step 1.3) and Site URL.
5. Redeploy both workers.

### 4. Stripe (5 min + waiting on Stripe)

1. Enable the [no-code customer portal](https://dashboard.stripe.com/settings/billing/portal)
   so Pro users can cancel self-serve — table stakes for trust.
2. Request cross-border/export enablement at
   [dashboard.stripe.com/settings/update](https://dashboard.stripe.com/settings/update);
   once approved, create a payment link for the existing USD price
   (`price_1TqdxySCF7p7b5tr`, $29/mo) and swap `STRIPE_PAYMENT_LINK` in
   `.env.local`, then redeploy. Until then international cards are charged
   ₹2,499 (≈$29) via the INR link — works, but shows rupees at checkout.

## Part 2 — First users (the wedge)

Positioning: **AI-visibility monitoring at $29/mo for indie founders and small
agencies, when Profound/Peec/Otterly start at $100–399.** Free plan = the demo.

### Agency-owner outreach (per the validation plan: your contact + 2–3 more)

> Subject: does ChatGPT recommend your clients?
>
> Hi {name} — when someone asks ChatGPT "best {client's category}", do your
> clients show up? I built a small tool that checks that weekly across
> ChatGPT, Gemini, and Perplexity, tracks share of voice vs competitors, and
> shows which sites the AIs actually cite (so you know where to pitch
> content). Free for one brand: {link}. Would love 10 minutes of your take —
> you know this space better than I do.

Ask for: (a) is AI visibility something clients ask about, (b) would they pay
$29/brand, (c) what's missing before they'd use it weekly. Those answers gate
TODOS.md #4 (competitor-detection v2) per the design doc.

### Show HN draft

> **Show HN: Resonark – track whether ChatGPT recommends your brand ($29/mo)**
>
> AI answer engines are becoming the first place buyers ask for
> recommendations, and existing "AI visibility" tools price for enterprise
> ($189–399/mo). Resonark asks the engines your buyers' questions on a
> schedule, scores how often you're mentioned vs competitors, and shows which
> sites the engines cite. Free plan: 1 brand, 5 prompts, weekly, no card.
> Stack: Next.js on Cloudflare Workers, Supabase, Gemini/GPT/Perplexity APIs.

### Product Hunt one-liner

> Resonark — find out if ChatGPT recommends your brand, or your competitor.

### Channels (order of effort/return)

1. The agency-owner contacts (warm, validates the wedge).
2. Show HN.
3. Indie Hackers launch post + r/SEO, r/bigseo (GEO/AEO threads are active).
4. Product Hunt (after the domain, not on workers.dev).
5. SEO/marketing newsletters that cover GEO — pitch the $29 angle.

## Part 3 — What "working" looks like (first 30 days)

Track just four numbers weekly; the app + Stripe dashboards have all of them:

- **Signups** (Supabase auth users)
- **Activation**: % of signups that run their first check (brands with ≥1 run)
- **Retention**: % of week-1 users who come back in week 2 (digest opens count)
- **Revenue**: first Pro conversion (Stripe)

Kill/iterate signal, per the design doc's fallback section: if agency
replies are lukewarm AND activation < ~40%, revisit positioning before
building more features.

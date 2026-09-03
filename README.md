# Veridex

**Stock analysis you can actually verify.**

Indian retail-investor dashboard: live Upstox market data, transparent backtested signal accuracy, AI explanations grounded in real computed numbers.

> Not SEBI-registered investment advice. Educational/analytical tool only. Investments in securities are subject to market risk.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind v4
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **Market data:** Upstox API (read-only, no order placement)
- **AI:** Groq (Llama 3.3) — grounded on backend-computed data only
- **News:** RSS (ET / Moneycontrol / Mint) + NewsAPI
- **Push:** Firebase Cloud Messaging (review nudges only)
- **Charts:** TradingView Lightweight Charts + ApexCharts
- **Hosting:** Vercel (frontend) + Supabase Edge Functions (backend)

## Local dev

```bash
cp .env.example .env   # fill in secrets
npm install
npm run dev
```

## Supabase setup (one-time)

1. Open the Supabase dashboard → **SQL Editor** → run each file in `supabase/migrations/` in order.
2. **Authentication** → **Providers** → enable **Email** (auto-on) and, when creds are ready, **Google** (paste client id + secret; whitelist your dashboard's redirect URL as shown on the same page).
3. **Edge Functions** — install the [Supabase CLI](https://supabase.com/docs/guides/cli) and:
   ```bash
   supabase login
   supabase link --project-ref jjxcphbfqahxeohxcupt
   supabase secrets set \
     UPSTOX_ACCESS_TOKEN=<paste from .env> \
     NEWSAPI_KEY=<paste from .env> \
     GROQ_API_KEY=<paste from .env> \
     FIREBASE_PROJECT_ID=veridex-ad8d8 \
     FIREBASE_CLIENT_EMAIL=<from service-account JSON> \
     FIREBASE_PRIVATE_KEY="<from service-account JSON, keep the \\n escapes>"
   supabase functions deploy upstox-quote upstox-candles news-feed news-search sentiment chat nudge-reviews
   ```
4. **Schedule the nudger** (Supabase dashboard → Database → **pg_cron**):
   ```sql
   select cron.schedule('nudge-reviews', '0 6 * * *',
     $$ select net.http_post(url:='https://<project>.functions.supabase.co/nudge-reviews') $$);
   ```
   The charts view calls these two functions; without them it renders an inline "deploy the Edge Functions" prompt instead of the chart.

## Ship phases

| # | Phase                                | Status |
|---|--------------------------------------|--------|
| 0 | Scaffold                             | ✅     |
| 1 | Supabase schema + Auth               | ✅     |
| 2 | Landing + dashboard shell            | ✅     |
| 3 | Upstox proxy + live charts           | ✅     |
| 4 | Portfolio tracker                    | ✅     |
| 5 | Fundamentals screener                | ✅     |
| 6 | News + IPO feed                      | ✅     |
| 7 | Sentiment + anomaly signals          | ✅     |
| 8 | Grounded AI chat                     | ✅     |
| 9 | FCM review reminders                 | ✅     |
| 10| Production deploy                    | ✅     |

## Deploy

**Frontend (Vercel):**
```bash
npm i -g vercel
vercel                # first-run: link the project
vercel env add VITE_SUPABASE_URL              # paste value; repeat for each VITE_* below
# VITE_SUPABASE_ANON_KEY
# VITE_FIREBASE_API_KEY
# VITE_FIREBASE_AUTH_DOMAIN
# VITE_FIREBASE_PROJECT_ID
# VITE_FIREBASE_STORAGE_BUCKET
# VITE_FIREBASE_MESSAGING_SENDER_ID
# VITE_FIREBASE_APP_ID
# VITE_FIREBASE_VAPID_KEY
vercel --prod
```

The `vercel.json` already sets an SPA rewrite (everything → `/index.html`) and
excludes the FCM service worker + static assets from that rewrite.

**Backend (already covered in "Supabase setup" above):** Edge Functions on Supabase,
migrations via SQL editor, `pg_cron` schedules `nudge-reviews` daily at 06:00 UTC.

## Security model — which values are where

| Value | Where it lives | Sensitivity |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `UPSTOX_ACCESS_TOKEN`, `GROQ_API_KEY`, `NEWSAPI_KEY`, `FIREBASE_PRIVATE_KEY` | **Supabase Edge Function secrets only** | Never in the browser bundle |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Client bundle | Public by Supabase design — RLS enforces access |
| `VITE_FIREBASE_*` (apiKey, authDomain, projectId, appId, VAPID) | Client bundle + service worker | [Public by Firebase design](https://firebase.google.com/docs/projects/api-keys) — Firebase security rules enforce access |
| `.env`, `veridex-*firebase-adminsdk*.json` | Local only, gitignored | Never committed |

## Ground rules

1. **Never places orders.** Read/analyze only.
2. **Every signal shows its methodology.** No black-box confidence numbers.
3. **AI cannot originate market numbers.** It only summarizes backend-computed / freshly-fetched data.
4. **No look-ahead bias.** Walk-forward validation only for any time-series model.
5. **Persistent disclaimer** on every analysis screen.

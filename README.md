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

1. Open the Supabase dashboard → **SQL Editor** → paste `supabase/migrations/0001_initial_schema.sql` → **Run**.
2. **Authentication** → **Providers** → enable **Email** (auto-on) and, when creds are ready, **Google** (paste client id + secret; whitelist your dashboard's redirect URL as shown on the same page).
3. **Edge Functions** — install the [Supabase CLI](https://supabase.com/docs/guides/cli) and:
   ```bash
   supabase login
   supabase link --project-ref jjxcphbfqahxeohxcupt
   supabase secrets set UPSTOX_ACCESS_TOKEN=<paste from .env>
   supabase functions deploy upstox-quote upstox-candles
   ```
   The charts view calls these two functions; without them it renders an inline "deploy the Edge Functions" prompt instead of the chart.

## Ship phases

| # | Phase                                | Status |
|---|--------------------------------------|--------|
| 0 | Scaffold                             | ✅     |
| 1 | Supabase schema + Auth               | ✅     |
| 2 | Landing + dashboard shell            | ✅     |
| 3 | Upstox proxy + live charts           | ✅     |
| 4 | Portfolio tracker                    | ⏳     |
| 5 | Fundamentals screener                | ⏳     |
| 6 | News + IPO feed                      | ⏳     |
| 7 | Sentiment + anomaly signals          | ⏳     |
| 8 | Grounded AI chat                     | ⏳     |
| 9 | FCM review reminders                 | ⏳     |
| 10| Production deploy                    | ⏳     |

## Ground rules

1. **Never places orders.** Read/analyze only.
2. **Every signal shows its methodology.** No black-box confidence numbers.
3. **AI cannot originate market numbers.** It only summarizes backend-computed / freshly-fetched data.
4. **No look-ahead bias.** Walk-forward validation only for any time-series model.
5. **Persistent disclaimer** on every analysis screen.

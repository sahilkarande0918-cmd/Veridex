# Veridex — Engineering Context

Handoff doc. Everything a new session needs to continue work without
re-deriving the architecture.

- **Live:** https://veridex-lake.vercel.app
- **Repo:** https://github.com/sahilkarande0918-cmd/Veridex
- **Supabase project ref:** `jjxcphbfqahxeohxcupt`
- **Local:** `C:\Users\Sahil\OneDrive\Desktop\Veridex`

---

## 1. What it is

A dashboard for Indian retail investors that treats **verifiability** as
the product. Every score, signal and AI sentence traces back to a number
the backend just computed or freshly fetched. It is deliberately **not a
broker** — it never places orders.

### Non-negotiable rules (baked into prompts and code)
1. Never places buy/sell orders. Upstox token is read-only.
2. Every signal shows its methodology inline.
3. The LLM may not originate a market number — only restate fetched data.
4. No look-ahead bias in any time-series computation.
5. Persistent "Not SEBI-registered advice" disclaimer.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 5, TypeScript strict, Tailwind v4 |
| Routing | react-router-dom 7, all dashboard routes `React.lazy` |
| Motion | framer-motion |
| Charts | lightweight-charts (candles), ApexCharts (donut) |
| Backend | Supabase Postgres + Auth + Edge Functions (Deno) |
| Market data | Upstox API v2 (read-only token) |
| LLM | Groq, `openai/gpt-oss-20b` |
| News | NewsData.io + RSS (ET / Moneycontrol / LiveMint) |
| Push | Firebase Cloud Messaging (HTTP v1) |
| Hosting | Vercel (frontend, auto-deploys on push to `main`) |

**Groq model note:** this account has **no Llama models**. `llama-3.3-70b-versatile`
and `llama-3.1-8b-instant` both 404. Available: `openai/gpt-oss-20b`,
`openai/gpt-oss-120b`, `qwen/qwen3.x`, `groq/compound`. Verify with
`GET https://api.groq.com/openai/v1/models` before changing models.

---

## 3. Database

Migrations in `supabase/migrations/`, all applied.

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users` via signup trigger. capital, risk, horizon, `push_token`, `onboarded_at` |
| `holdings` | manual positions (symbol, qty, buy_price, buy_date) |
| `watchlist` | unused so far |
| `alerts` | review nudges; `dedupe_key` unique per user for idempotent cron inserts |
| `instruments` | **full NSE equity master, 2,893 rows** (EQ + BE) |
| `market_snapshot` | last price / prev close / pct / volume for the whole universe |

**RLS is on for every table.** User tables scope to `auth.uid()`.
`instruments` and `market_snapshot` are world-readable to `authenticated`.

**`search_instruments(q, lim)` RPC** — relevance-ranked search:
exact ticker → ticker prefix → space-collapsed name → name contains.
Space-collapsing is why `tatamotors` resolves to `TMCV`/`TMPV`
(Tata Motors demerged — there is no `TATAMOTORS` ticker any more).

---

## 4. Edge Functions (`supabase/functions/`)

| Function | JWT | What it does |
|---|---|---|
| `upstox-quote` | yes | single LTP; used by Charts for 5s ticks |
| `upstox-candles` | yes | historical OHLC |
| `market-summary` | yes | one batched Upstox call → Nifty + 20-name universe + movers, 30s cache |
| `news-feed` | yes | 3 RSS sources in parallel, regex parser, per-source error reporting |
| `news-search` | yes | NewsData.io company query |
| `sentiment` | yes | headlines → Groq structured JSON labels |
| `chat` | yes | intent router → parallel fetches → grounded Groq call |
| `analyze-stock` | yes | **the core engine** — see below |
| `recommend` | yes | budget + liquidity screen over the priced universe |
| `sync-instruments` | **no** | loads Upstox NSE master (cron) |
| `sync-snapshot` | **no** | batch-quotes whole universe (cron) |
| `nudge-reviews` | **no** | 30-day position review alerts + FCM push (cron) |

### Secrets (Supabase → Edge Functions → Secrets)
`UPSTOX_ACCESS_TOKEN`, `GROQ_API_KEY`, `NEWSAPI_KEY`,
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are
auto-injected — do not set them manually.

### pg_cron
- `veridex-sync-snapshot` — `*/15 3-10 * * 1-5` (NSE hours in UTC)
- `veridex-sync-instruments` — `30 1 * * *`
- `veridex-nudge-reviews` — `0 6 * * *`

---

## 5. `analyze-stock` — the differentiator

Given a ticker, pulls **3 years of daily candles** and computes:

- RSI(14), SMA20/50/200, ATR(14), 52-week position, multi-window returns
- **Historical base rates** — this is the honest "% chance it goes up":
  bucket today by *RSI band × distance-from-SMA50*, find every historical
  day in the same bucket, count how often price closed higher 1/5/20/60
  sessions later. Returns `sample_size`, a `reliability` flag, and
  `edge_vs_unconditional_pp` (vs the stock's own all-days rate, so a
  near-zero edge is visible). **Sampling stops 60 sessions before today**
  so every matched day has complete forward data — no look-ahead.
- **Horizon fitness** — intraday / swing / long-term scored from their own
  components (ATR% + participation + turnover; trend alignment + RSI zone
  + 1m momentum; SMA200 + 1y return + volatility + 52w room)
- **Risk frame** — ATR stop multiples, 20-session support/resistance
- **Verdict** — `FAVOURABLE` / `NEUTRAL` / `UNFAVOURABLE` + conviction 0-100

**The verdict is arithmetic, never model opinion.** Fixed weights:
base rate 30%, edge 20%, horizon fit 20%, trend 15%, risk:reward 15%.
Thin samples discount 30%. **A risk:reward below 0.8:1 caps conviction at
55**, so a trade risking more than it can make never reads FAVOURABLE.
(Found this the hard way: PCJEWELLER at 0.13:1 scored 84/100 before the cap.)

---

## 6. Frontend map

```
src/
  App.tsx                    lazy routes; ThemeProvider > AuthProvider > Router
  index.css                  ALL theming lives here (see §7)
  lib/
    supabase.ts  auth.tsx    client + AuthProvider + cached fetchProfileRow
    cache.ts                 TTL memo that also de-dupes concurrent callers
    quotes.ts                fetchPrices() — ONE market_snapshot read for N symbols
    instruments.ts           universe-backed search + cached symbol resolution
    market.ts news.ts chat.ts analyze.ts sentiment.ts anomaly.ts screener.ts
  components/
    DashboardShell.tsx       sidebar + sticky .vx-appbar (ticker + header)
    SymbolSearch.tsx         debounced, race-safe search over all 2,893 names
    ChatMarkdown.tsx         ~90-line renderer: bold, code, bullets. No dep.
    ScreenPicks.tsx          screener picks as cards (not model-formatted)
    AnimatedNumber.tsx       isolated count-up (see §8)
    AllocationChart.tsx      memo'd — ApexCharts rebuilds its SVG on any render
    VideoBackdrop.tsx AlertsBell.tsx Onboarding.tsx Disclaimer.tsx ThemeToggle.tsx
  routes/
    Landing.tsx Login.tsx Protected.tsx
    dashboard/ Overview Profile Charts Analyze Portfolio Screener Signals News Chat
```

---

## 7. Theming — read before touching CSS

All theming is CSS overrides in `src/index.css`, keyed off
`:root[data-theme="dark"|"light"]`. Components use plain Tailwind
`neutral-*` / `violet-*` classes and the stylesheet remaps them.

- **Dark** = strict pitch black `#000`. No gradients, no glows (explicit
  user preference). Motion only.
- **Light** = off-white `#eef2f8` with pastel radial blobs, cyan accent.
- **`.vx-appbar`** — sticky ticker+header, forced opaque in both themes.
  Must never be translucent or page content bleeds through it.
- **`[data-surface="dark"]`** — on `<main>` in Landing only. Keeps the dark
  palette even in light theme, because the landing sits on a dark video.

**Specificity trap:** light-theme rules are `:root[data-theme="light"] .x`
= `(0,3,0)` **with `!important`**. A plain `[data-surface="dark"] .x`
= `(0,2,0)` silently loses. Always-dark rules are prefixed
`:root[data-theme] [data-surface="dark"]` = `(0,4,0)` to win. There is a
comment in the file — do not strip it.

**Body styling lives in CSS, not utility classes on `<body>`.** Putting
`bg-neutral-950` on `<body>` makes the theme override match the body
itself and wipe out the themed background.

---

## 8. Performance — what was fixed and why

Measured with a real signed-in session, not guessed:

| Metric (one Overview + Profile load) | Before | After |
|---|---|---|
| DOM mutations in 4s (Profile) | 2,762 | 131 |
| ApexCharts SVG rebuilds | 2,308 | 49 |
| Supabase calls (Overview) | 23 | 12 |
| `market-summary` calls | 6 | 1 |
| per-symbol `upstox-quote` calls | 4 | 0 |

**Root cause:** the count-up ran its `requestAnimationFrame` loop inside
the page component, so every frame re-rendered the whole page and
ApexCharts rebuilt its SVG ~54× per load.

**Rules to preserve:**
- Ticking values go in `AnimatedNumber`, never in a page component.
- `AllocationChart` stays memo'd.
- Shared reads go through `lib/cache.ts`.
- Portfolio/Profile/Overview use `fetchPrices()` (one batched
  `market_snapshot` read). Only Charts polls per-symbol, because it needs
  5s ticks on one name.

**`requestAnimationFrame` does not fire in a hidden/background tab.**
`AnimatedNumber` snaps to the value when `document.hidden`, with a
timeout guarantee. Without it, net worth showed ₹0 in a background tab.

---

## 9. Chat behaviour

Pipeline: keyword intent router (no LLM) → parallel live fetches →
grounded Groq call. The prompt:

- Every number must come from the CONTEXT block; otherwise say so.
- Never "will go up/down" — only base rates **with sample size**.
- Call out when `edge_vs_unconditional_pp` ≈ 0 ("no edge here").
- **No markdown tables** — the UI renders raw pipes. No headings.
- Under 160 words; interpret rather than restate, because the UI draws
  the numbers as cards (`ScreenPicks`, `VerdictChip`).

---

## 10. Known gaps / next steps

1. **Screener fundamentals are sample data.** `src/data/fundamentals.ts`
   is illustrative round-numbers with a visible amber banner. Swap for a
   live feed (Alpha Vantage OVERVIEW, FMP, or IndMoney) — the scoring
   engine and UI are production-ready.
2. **Google OAuth is not configured.** Button exists; needs
   `GOOGLE_CLIENT_ID` / `SECRET` in Supabase → Auth → Providers.
3. **No sector data** for the full universe — the NSE master has no
   sector field. Profile shows per-stock allocation instead.
4. **`AllocationChart` chunk is ~958 kB** (ApexCharts). Candidate for a
   lighter chart lib.
5. **Credentials were pasted in chat during development** — the Supabase
   service-role key, DB password, Upstox token and Firebase service
   account should be rotated.
6. **Firebase web API key is restricted?** Confirm HTTP-referrer
   restrictions in GCP so the GitHub secret-scanning alert can be closed.

---

## 11. Working agreements

- **Verify before deploying.** Run `npm run dev`, drive the real UI, and
  measure. Do not ship on "the build is green".
- To inspect the dashboard locally, provision a throwaway Supabase user
  via the admin API, seed holdings, verify, then **delete it and confirm
  the cascade**. Never use the owner's credentials.
- Browser-pane screenshots are unreliable when the pane is hidden (the
  viewport collapses to 0 width and produces fake layout gaps). Prefer
  `getBoundingClientRect` / computed styles for geometry.
- `git push` to `main` auto-deploys the frontend. Edge Functions deploy
  separately via the Supabase MCP tool and are **not** covered by that push.

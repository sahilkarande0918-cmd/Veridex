# Veridex

**Stock analysis you can actually verify.**

A dashboard for Indian retail investors. Live market data from Upstox, a
transparent fundamentals screener, sentiment + anomaly signals, and an AI
chat that only answers from data the backend just fetched — never from
the model's memory.

Live at **https://veridex-lake.vercel.app**

## What you can do

- **Overview** — snapshot of your portfolio + Nifty + top movers.
- **Profile** — net worth, invested value, unrealized P&L, sector split.
- **Charts** — live candlesticks and 5-second LTP for any Nifty stock.
- **Portfolio** — add positions manually, watch live P&L, see allocation.
- **Screener** — rank stocks by value / leverage / growth; the formula is
  visible next to every score.
- **Signals** — 20-day volume/price z-score anomalies and headline-tone
  classification.
- **News** — RSS from ET / Moneycontrol / LiveMint, plus company search
  and an IPO filter.
- **AI Chat** — asks Upstox, NewsData, and your holdings first, then
  answers with those numbers. Refuses to guess.

## Ground rules

- Never places buy/sell orders. Analysis and tracking only.
- Every signal shows its methodology inline.
- AI cannot originate market numbers; it summarizes freshly-fetched data.
- Not SEBI-registered investment advice.

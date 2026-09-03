// SAMPLE FUNDAMENTALS — for the screener demo path.
//
// These figures are illustrative round-numbers, NOT a live feed. They
// exist so the scoring engine, UI, and methodology panel are runnable
// end-to-end without a paid data provider. Every screener view labels
// them "sample data" prominently.
//
// ponytail: swap for a live fetch when the user wires one of:
//   - Alpha Vantage OVERVIEW (free 25 calls/day → cache in Supabase 24h)
//   - Financial Modeling Prep /profile   (free 250/day)
//   - IndMoney fundamentals endpoint     (part of their commercial tier)
// The swap is: replace this file's export with a Supabase query against
// a `fundamentals_snapshot` table, populated by a scheduled Edge Fn.

export type Fundamentals = {
  symbol: string
  pe: number       // trailing P/E
  pb: number       // P/B
  de: number       // debt-to-equity (0 = debt-free)
  rev_growth: number  // YoY revenue growth, decimal (0.12 = 12%)
  last_price: number  // approx spot for capital-affordability filter
}

export const SAMPLE_AS_OF = '2026-01-01'
export const SAMPLE_SOURCE = 'Illustrative snapshot — replace with live fundamentals feed'

export const FUNDAMENTALS: Fundamentals[] = [
  { symbol: 'RELIANCE',   pe: 24.3, pb: 2.4, de: 0.42, rev_growth: 0.09, last_price: 2950 },
  { symbol: 'TCS',        pe: 30.1, pb: 13.8, de: 0.05, rev_growth: 0.07, last_price: 4200 },
  { symbol: 'HDFCBANK',   pe: 18.6, pb: 2.8, de: 0.70, rev_growth: 0.14, last_price: 1720 },
  { symbol: 'INFY',       pe: 26.4, pb: 8.1, de: 0.09, rev_growth: 0.05, last_price: 1850 },
  { symbol: 'ICICIBANK',  pe: 19.2, pb: 3.3, de: 0.65, rev_growth: 0.16, last_price: 1330 },
  { symbol: 'HINDUNILVR', pe: 55.0, pb: 12.5, de: 0.04, rev_growth: 0.03, last_price: 2400 },
  { symbol: 'ITC',        pe: 26.2, pb: 7.4, de: 0.01, rev_growth: 0.08, last_price: 445 },
  { symbol: 'SBIN',       pe: 10.8, pb: 1.7, de: 0.80, rev_growth: 0.13, last_price: 820 },
  { symbol: 'BHARTIARTL', pe: 68.4, pb: 8.9, de: 1.20, rev_growth: 0.18, last_price: 1610 },
  { symbol: 'KOTAKBANK',  pe: 21.5, pb: 2.9, de: 0.62, rev_growth: 0.11, last_price: 1780 },
  { symbol: 'LT',         pe: 33.9, pb: 5.6, de: 0.35, rev_growth: 0.15, last_price: 3600 },
  { symbol: 'AXISBANK',   pe: 14.7, pb: 2.4, de: 0.72, rev_growth: 0.12, last_price: 1150 },
  { symbol: 'ASIANPAINT', pe: 51.0, pb: 12.0, de: 0.10, rev_growth: 0.02, last_price: 2900 },
  { symbol: 'MARUTI',     pe: 27.6, pb: 4.2, de: 0.02, rev_growth: 0.11, last_price: 12500 },
  { symbol: 'BAJFINANCE', pe: 30.5, pb: 5.9, de: 3.60, rev_growth: 0.22, last_price: 7100 },
  { symbol: 'TITAN',      pe: 92.0, pb: 30.0, de: 0.45, rev_growth: 0.19, last_price: 3550 },
  { symbol: 'SUNPHARMA',  pe: 40.1, pb: 6.7, de: 0.08, rev_growth: 0.10, last_price: 1720 },
  { symbol: 'NESTLEIND',  pe: 76.0, pb: 68.0, de: 0.05, rev_growth: 0.06, last_price: 2200 },
  { symbol: 'WIPRO',      pe: 25.3, pb: 3.6, de: 0.20, rev_growth: 0.01, last_price: 540 },
  { symbol: 'ULTRACEMCO', pe: 42.0, pb: 5.1, de: 0.28, rev_growth: 0.09, last_price: 11000 },
  { symbol: 'HCLTECH',    pe: 27.0, pb: 6.0, de: 0.06, rev_growth: 0.06, last_price: 1780 },
  { symbol: 'M&M',        pe: 30.2, pb: 4.4, de: 1.10, rev_growth: 0.14, last_price: 2900 },
  { symbol: 'ADANIENT',   pe: 90.0, pb: 8.5, de: 1.50, rev_growth: 0.20, last_price: 2600 },
  { symbol: 'NTPC',       pe: 17.4, pb: 2.1, de: 1.45, rev_growth: 0.07, last_price: 380 },
  { symbol: 'POWERGRID',  pe: 18.0, pb: 3.0, de: 1.30, rev_growth: 0.05, last_price: 290 },
  { symbol: 'TATAMOTORS', pe: 12.5, pb: 3.4, de: 1.10, rev_growth: 0.17, last_price: 950 },
  { symbol: 'TATASTEEL',  pe: 22.0, pb: 2.0, de: 0.85, rev_growth: 0.08, last_price: 155 },
  { symbol: 'ONGC',       pe: 8.9, pb: 1.1, de: 0.55, rev_growth: 0.04, last_price: 285 },
  { symbol: 'JSWSTEEL',   pe: 21.5, pb: 2.5, de: 0.90, rev_growth: 0.10, last_price: 940 },
  { symbol: 'COALINDIA',  pe: 9.1, pb: 3.5, de: 0.10, rev_growth: 0.05, last_price: 460 },
]

export const bySymbol = (sym: string) =>
  FUNDAMENTALS.find((f) => f.symbol === sym)

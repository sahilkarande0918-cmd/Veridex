// Professional-trader style single-stock analysis.
//
// GET ?symbol=RELIANCE   (or ?key=NSE_EQ|INE002A01018)
//
// Everything here is computed from ~3 years of daily candles. The
// "chance it goes up" numbers are EMPIRICAL BASE RATES: we bucket the
// stock's current technical state, find every historical day in the
// same bucket, and count how often price was higher N sessions later.
// Sample size is always returned so the caller can judge reliability.
// Nothing is fitted, nothing is forecast, nothing is a model opinion.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

const HORIZONS = [1, 5, 20, 60] as const   // sessions forward
const MIN_SAMPLE = 20                       // below this we flag low reliability
const YEARS = 3

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const TOKEN = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!SUPABASE_URL || !SR) return json({ error: 'supabase env unset' }, 500)
  if (!TOKEN) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  const url = new URL(req.url)
  const symbolQ = (url.searchParams.get('symbol') ?? '').trim().toUpperCase()
  let key = (url.searchParams.get('key') ?? '').trim()
  let symbol = symbolQ
  let name = symbolQ

  // ---- resolve the instrument -------------------------------------
  if (!key) {
    if (!symbolQ) return json({ error: 'pass ?symbol=TICKER or ?key=INSTRUMENT_KEY' }, 400)
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/instruments?select=instrument_key,trading_symbol,name&trading_symbol=eq.${encodeURIComponent(symbolQ)}&limit=1`,
      { headers: { apikey: SR, Authorization: `Bearer ${SR}` } },
    )
    const hit: { instrument_key: string; trading_symbol: string; name: string }[] = r.ok ? await r.json() : []
    if (hit.length === 0) {
      return json({ error: 'unknown_symbol', symbol: symbolQ, hint: 'Use the search endpoint to find the exact NSE ticker.' }, 404)
    }
    key = hit[0].instrument_key; symbol = hit[0].trading_symbol; name = hit[0].name
  } else {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/instruments?select=trading_symbol,name&instrument_key=eq.${encodeURIComponent(key)}&limit=1`,
      { headers: { apikey: SR, Authorization: `Bearer ${SR}` } },
    )
    const hit: { trading_symbol: string; name: string }[] = r.ok ? await r.json() : []
    if (hit.length) { symbol = hit[0].trading_symbol; name = hit[0].name }
  }

  // ---- data --------------------------------------------------------
  const [candles, quote, nifty] = await Promise.all([
    fetchCandles(key, TOKEN, YEARS),
    fetchQuote(key, TOKEN).catch(() => null),
    fetchQuote('NSE_INDEX|Nifty 50', TOKEN).catch(() => null),
  ])
  if (candles.length < 260) {
    return json({ error: 'insufficient_history', symbol, sessions: candles.length,
                  hint: 'Needs at least ~1 year of daily candles to compute base rates.' }, 422)
  }

  const closes = candles.map((c) => c.c)
  const highs  = candles.map((c) => c.h)
  const lows   = candles.map((c) => c.l)
  const vols   = candles.map((c) => c.v)
  const last   = closes.at(-1)!
  const live   = quote?.last_price ?? last

  // ---- indicator series -------------------------------------------
  const rsiSeries = rsi14(closes)
  const sma20  = smaSeries(closes, 20)
  const sma50  = smaSeries(closes, 50)
  const sma200 = smaSeries(closes, 200)
  const atrSeries = atr14(highs, lows, closes)

  const i = closes.length - 1
  const curRsi   = rsiSeries[i]
  const curSma20 = sma20[i], curSma50 = sma50[i], curSma200 = sma200[i]
  const curAtr   = atrSeries[i]
  const atrPct   = live > 0 ? (curAtr / live) * 100 : 0

  const vsSma20  = curSma20  ? ((live - curSma20)  / curSma20)  * 100 : 0
  const vsSma50  = curSma50  ? ((live - curSma50)  / curSma50)  * 100 : 0
  const vsSma200 = curSma200 ? ((live - curSma200) / curSma200) * 100 : 0

  const ret = (n: number) => {
    const p = closes.at(-1 - n)
    return p && p > 0 ? ((last - p) / p) * 100 : null
  }
  const hi52 = Math.max(...closes.slice(-252))
  const lo52 = Math.min(...closes.slice(-252))
  const posIn52 = hi52 > lo52 ? ((live - lo52) / (hi52 - lo52)) * 100 : 50

  const vol20 = mean(vols.slice(-20))
  const volToday = quote?.volume ?? vols.at(-1) ?? 0
  const volRatio = vol20 > 0 ? volToday / vol20 : 1

  // ---- BASE RATES (the honest "% chance") --------------------------
  const curBucket = bucketOf(curRsi, vsSma50)
  const maxH = Math.max(...HORIZONS)
  const start = 200                       // need SMA200 warm
  const end = closes.length - maxH - 1     // need forward data

  const matches: number[] = []
  for (let j = start; j <= end; j++) {
    if (bucketOf(rsiSeries[j], sma50[j] ? ((closes[j] - sma50[j]) / sma50[j]) * 100 : 0) === curBucket) {
      matches.push(j)
    }
  }

  const baseRates: Record<string, unknown> = {}
  for (const h of HORIZONS) {
    const fwd = matches.map((j) => (closes[j + h] - closes[j]) / closes[j])
    const up = fwd.filter((x) => x > 0).length
    const n = fwd.length
    // unconditional comparison over the same window
    const allFwd: number[] = []
    for (let j = start; j <= end; j++) allFwd.push((closes[j + h] - closes[j]) / closes[j])
    const uncondUp = allFwd.filter((x) => x > 0).length
    baseRates[`${h}d`] = {
      prob_up_pct: n ? round((up / n) * 100, 1) : null,
      prob_down_pct: n ? round(((n - up) / n) * 100, 1) : null,
      sample_size: n,
      reliability: n >= MIN_SAMPLE ? 'ok' : 'low',
      median_move_pct: n ? round(median(fwd) * 100, 2) : null,
      best_case_pct: n ? round(quantile(fwd, 0.9) * 100, 2) : null,
      worst_case_pct: n ? round(quantile(fwd, 0.1) * 100, 2) : null,
      unconditional_up_pct: allFwd.length ? round((uncondUp / allFwd.length) * 100, 1) : null,
      edge_vs_unconditional_pp:
        n && allFwd.length ? round((up / n) * 100 - (uncondUp / allFwd.length) * 100, 1) : null,
    }
  }

  // ---- horizon fitness ---------------------------------------------
  const intraday = {
    score: round(clamp01(atrPct / 3) * 50 + clamp01(volRatio / 2) * 30 + clamp01((live * volToday) / 5e8) * 20, 0),
    daily_range_pct: round(atrPct, 2),
    volume_vs_20d: round(volRatio, 2),
    turnover_cr: round((live * volToday) / 1e7, 1),
    reads: atrPct < 1.5
      ? 'Daily range is tight — thin edge after brokerage and slippage.'
      : 'Daily range is wide enough that intraday moves can cover costs.',
  }
  const swing = {
    score: round(
      (vsSma20 > 0 ? 30 : 0) + (vsSma50 > 0 ? 30 : 0) +
      (curRsi >= 40 && curRsi <= 70 ? 25 : 5) +
      (((ret(20) ?? 0) > 0) ? 15 : 0), 0),
    vs_sma20_pct: round(vsSma20, 2),
    vs_sma50_pct: round(vsSma50, 2),
    rsi14: round(curRsi, 1),
    reads: vsSma20 > 0 && vsSma50 > 0
      ? 'Short and medium trend both point up — structure supports a swing hold.'
      : 'Price is under at least one key average — swing entries fight the trend here.',
  }
  const longterm = {
    score: round(
      (vsSma200 > 0 ? 40 : 0) +
      (((ret(252) ?? 0) > 0) ? 25 : 0) +
      (annualVol(closes) < 35 ? 20 : 5) +
      (posIn52 < 85 ? 15 : 0), 0),
    vs_sma200_pct: round(vsSma200, 2),
    return_1y_pct: ret(252) != null ? round(ret(252)!, 2) : null,
    annualised_volatility_pct: round(annualVol(closes), 1),
    position_in_52w_range_pct: round(posIn52, 1),
    reads: vsSma200 > 0
      ? 'Above the 200-session average — the long-term structure is intact.'
      : 'Below the 200-session average — long-term structure is damaged.',
  }
  const ranked = [
    { horizon: 'intraday', score: intraday.score },
    { horizon: 'swing_delivery', score: swing.score },
    { horizon: 'long_term', score: longterm.score },
  ].sort((a, b) => b.score - a.score)

  // ---- risk levels --------------------------------------------------
  const support = Math.min(...lows.slice(-20))
  const resistance = Math.max(...highs.slice(-20))
  const risk = {
    atr_stop_1x: round(live - curAtr, 2),
    atr_stop_2x: round(live - 2 * curAtr, 2),
    recent_support_20d: round(support, 2),
    recent_resistance_20d: round(resistance, 2),
    upside_to_resistance_pct: round(((resistance - live) / live) * 100, 2),
    downside_to_support_pct: round(((live - support) / live) * 100, 2),
    note: 'Levels are mechanical (20-session extremes and ATR multiples), not chart-pattern judgements.',
  }

  // ---- VERDICT ------------------------------------------------------
  // A decisive call, computed from the numbers above — never authored
  // by the language model. Weights are returned so it stays auditable.
  const bestH = ranked[0].horizon
  const rateKey = bestH === 'intraday' ? '1d' : bestH === 'swing_delivery' ? '20d' : '60d'
  const br = baseRates[rateKey] as { prob_up_pct: number | null; edge_vs_unconditional_pp: number | null; sample_size: number; reliability: string; median_move_pct: number | null }

  const rr = risk_downside(live, support) > 0
    ? risk_upside(live, resistance) / risk_downside(live, support) : 0

  const cBase  = clamp01((((br.prob_up_pct ?? 50) - 40) / 25)) * 100
  const cEdge  = clamp01((((br.edge_vs_unconditional_pp ?? 0) + 5) / 20)) * 100
  const cFit   = ranked[0].score
  const cTrend = (vsSma20 > 0 ? 33 : 0) + (vsSma50 > 0 ? 33 : 0) + (vsSma200 > 0 ? 34 : 0)
  const cRR    = clamp01(rr / 3) * 100

  const W = { base_rate: 0.30, edge: 0.20, horizon_fit: 0.20, trend: 0.15, risk_reward: 0.15 }
  let conviction = cBase * W.base_rate + cEdge * W.edge + cFit * W.horizon_fit + cTrend * W.trend + cRR * W.risk_reward
  if (br.reliability === 'low') conviction *= 0.7   // thin sample → discount

  const call = conviction >= 60 ? 'FAVOURABLE' : conviction >= 42 ? 'NEUTRAL' : 'UNFAVOURABLE'
  const horizonWord = bestH === 'intraday' ? 'an intraday trade'
    : bestH === 'swing_delivery' ? 'a swing / delivery position' : 'a long-term hold'

  const headline =
    call === 'FAVOURABLE'
      ? `Setup favours ${horizonWord}. Best odds are on the ${labelOf(rateKey)} view.`
      : call === 'NEUTRAL'
      ? `Mixed setup. If you take it, ${horizonWord} is the only horizon the numbers support.`
      : `Numbers do not support an entry here. Better to wait for the setup to reset.`

  const reasons: string[] = []
  if (br.prob_up_pct != null) reasons.push(`In the same RSI/SMA50 state, price closed higher ${labelOf(rateKey)} later ${br.prob_up_pct}% of the time (n=${br.sample_size}).`)
  if (br.edge_vs_unconditional_pp != null) {
    reasons.push(Math.abs(br.edge_vs_unconditional_pp) < 3
      ? `That is within ~3pp of its all-days rate — effectively no edge from the current setup.`
      : `That is ${br.edge_vs_unconditional_pp > 0 ? '+' : ''}${br.edge_vs_unconditional_pp}pp versus its all-days rate.`)
  }
  reasons.push(`Trend: ${vsSma20 > 0 ? 'above' : 'below'} SMA20, ${vsSma50 > 0 ? 'above' : 'below'} SMA50, ${vsSma200 > 0 ? 'above' : 'below'} SMA200.`)
  reasons.push(`Risk:reward to the 20-session band is ${round(rr, 2)} : 1 (upside ${round(risk_upside(live, resistance), 2)}% vs downside ${round(risk_downside(live, support), 2)}%).`)
  if (br.reliability === 'low') reasons.push(`Sample is thin (n=${br.sample_size}) — conviction discounted 30%.`)

  const watch: string[] = []
  if (vsSma50 <= 0) watch.push(`A close back above SMA50 (₹${round(curSma50 ?? 0, 2)}) would flip the medium-term read.`)
  if (vsSma200 <= 0) watch.push(`A close above SMA200 (₹${round(curSma200 ?? 0, 2)}) would repair the long-term structure.`)
  if (curRsi > 70) watch.push(`RSI ${round(curRsi, 1)} is stretched — a cooldown toward 55-60 would give a cleaner entry.`)
  if (curRsi < 30) watch.push(`RSI ${round(curRsi, 1)} is washed out — a turn back above 35 often marks the reset.`)
  if (rr < 1) watch.push(`Resistance is closer than support; a break above ₹${round(resistance, 2)} would improve the payoff.`)

  const verdict = {
    call,
    conviction: round(conviction, 0),
    headline,
    recommended_horizon: bestH,
    reasons,
    what_would_change_it: watch,
    risk_reward_ratio: round(rr, 2),
    suggested_stop: round(live - 2 * curAtr, 2),
    components: {
      base_rate: round(cBase, 0), edge: round(cEdge, 0), horizon_fit: round(cFit, 0),
      trend: round(cTrend, 0), risk_reward: round(cRR, 0),
    },
    weights: W,
    how: 'Conviction is a fixed-weight blend of the five components above, each 0-100. It is arithmetic on the numbers in this response — no model judgement. Thin base-rate samples cut it by 30%.',
  }

  return json({
    symbol, name, instrument_key: key,
    verdict,
    quote: {
      last_price: round(live, 2),
      day_change_pct: quote?.pct_change != null ? round(quote.pct_change, 2) : null,
      volume: volToday,
      week52_high: round(hi52, 2),
      week52_low: round(lo52, 2),
      position_in_52w_range_pct: round(posIn52, 1),
    },
    market_context: nifty
      ? { index: 'Nifty 50', last: round(nifty.last_price ?? 0, 2),
          pct_change: nifty.pct_change != null ? round(nifty.pct_change, 2) : null }
      : null,
    technicals: {
      rsi14: round(curRsi, 1),
      sma20: round(curSma20 ?? 0, 2), sma50: round(curSma50 ?? 0, 2), sma200: round(curSma200 ?? 0, 2),
      vs_sma20_pct: round(vsSma20, 2), vs_sma50_pct: round(vsSma50, 2), vs_sma200_pct: round(vsSma200, 2),
      atr14: round(curAtr, 2), atr_pct: round(atrPct, 2),
      volume_vs_20d_avg: round(volRatio, 2),
      returns_pct: {
        w1: ret(5) != null ? round(ret(5)!, 2) : null,
        m1: ret(21) != null ? round(ret(21)!, 2) : null,
        m3: ret(63) != null ? round(ret(63)!, 2) : null,
        m6: ret(126) != null ? round(ret(126)!, 2) : null,
        y1: ret(252) != null ? round(ret(252)!, 2) : null,
      },
    },
    base_rates: {
      current_state: curBucket,
      history_sessions: closes.length,
      matched_days: matches.length,
      horizons: baseRates,
    },
    horizon_fitness: { intraday, swing_delivery: swing, long_term: longterm, best_fit: ranked[0].horizon, ranked },
    risk,
    methodology: {
      history: `${YEARS} years of daily candles from Upstox (${closes.length} sessions loaded).`,
      state_bucket: 'Current day is labelled by RSI(14) band x distance from SMA50 band.',
      base_rate: 'Every historical session in the SAME bucket is found, then we count how often the close was higher 1/5/20/60 sessions later. This is a frequency count over the past, not a forecast.',
      leakage_guard: 'Samples stop 60 sessions before the end so every matched day has complete forward data. Indicators use only trailing windows.',
      sample_size: `Any horizon with fewer than ${MIN_SAMPLE} matches is flagged reliability:"low".`,
      edge: 'edge_vs_unconditional_pp compares the conditional rate against the stock\'s own all-days rate. Near zero means the current setup carries no historical signal.',
      horizon_scores: 'Intraday = range + participation + turnover. Swing = trend alignment + RSI zone + 1-month momentum. Long term = SMA200 + 1-year return + volatility + room in 52-week range.',
      not_advice: 'Descriptive statistics only. Past frequency is not probability of the future. Not SEBI-registered investment advice.',
    },
    generated_at: new Date().toISOString(),
  })
})

// ---------------- indicators ----------------
function smaSeries(xs: number[], p: number): (number | null)[] {
  const out: (number | null)[] = new Array(xs.length).fill(null)
  let sum = 0
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i]
    if (i >= p) sum -= xs[i - p]
    if (i >= p - 1) out[i] = sum / p
  }
  return out
}

function rsi14(closes: number[]): number[] {
  const p = 14
  const out = new Array(closes.length).fill(50)
  let g = 0, l = 0
  for (let i = 1; i <= p && i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) g += d; else l -= d
  }
  g /= p; l /= p
  out[p] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  for (let i = p + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    g = (g * (p - 1) + (d > 0 ? d : 0)) / p
    l = (l * (p - 1) + (d < 0 ? -d : 0)) / p
    out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l)
  }
  return out
}

function atr14(h: number[], l: number[], c: number[]): number[] {
  const p = 14
  const tr: number[] = [h[0] - l[0]]
  for (let i = 1; i < c.length; i++) {
    tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])))
  }
  const out = new Array(c.length).fill(0)
  let a = mean(tr.slice(0, p))
  out[p - 1] = a
  for (let i = p; i < c.length; i++) { a = (a * (p - 1) + tr[i]) / p; out[i] = a }
  return out
}

function bucketOf(rsi: number, vsSma50: number): string {
  const r = rsi < 30 ? 'RSI<30'
    : rsi < 45 ? 'RSI30-45'
    : rsi < 55 ? 'RSI45-55'
    : rsi < 70 ? 'RSI55-70'
    : 'RSI>70'
  const t = vsSma50 < -5 ? 'far-below-SMA50'
    : vsSma50 < 0 ? 'below-SMA50'
    : vsSma50 < 5 ? 'above-SMA50'
    : 'far-above-SMA50'
  return `${r} / ${t}`
}

function annualVol(closes: number[]): number {
  const r: number[] = []
  for (let i = Math.max(1, closes.length - 252); i < closes.length; i++) {
    if (closes[i - 1] > 0) r.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  return stdev(r) * Math.sqrt(252) * 100
}

// ---------------- data fetch ----------------
async function fetchCandles(key: string, token: string, years: number): Promise<Candle[]> {
  const to = new Date()
  const from = new Date(to.getTime() - years * 365 * 24 * 60 * 60 * 1000)
  const f = (d: Date) => d.toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(key)}/day/${f(to)}/${f(from)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) return []
  const body = await res.json()
  const rows: (string | number)[][] = body?.data?.candles ?? []
  return rows
    .map((r) => ({ t: Math.floor(new Date(r[0] as string).getTime() / 1000),
                   o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +(r[5] ?? 0) }))
    .sort((a, b) => a.t - b.t)
}

async function fetchQuote(key: string, token: string) {
  const res = await fetch(
    `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(key)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const body = await res.json()
  const q = Object.values(body?.data ?? {})[0] as
    { last_price?: number; net_change?: number; volume?: number; ohlc?: { close?: number } } | undefined
  if (!q) return null
  const prev = q.ohlc?.close ?? (q.last_price != null && q.net_change != null ? q.last_price - q.net_change : null)
  const pct = prev && q.last_price ? ((q.last_price - prev) / prev) * 100 : null
  return { last_price: q.last_price ?? null, volume: q.volume ?? 0, pct_change: pct }
}

// ---------------- math ----------------
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0
  const mu = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1))
}
const median = (xs: number[]) => quantile(xs, 0.5)
function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const pos = (s.length - 1) * q
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (pos - lo)
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
const risk_upside = (live: number, resistance: number) => ((resistance - live) / live) * 100
const risk_downside = (live: number, support: number) => ((live - support) / live) * 100
const labelOf = (k: string) =>
  ({ '1d': '1 session', '5d': '1 week', '20d': '1 month', '60d': '3 months' }[k] ?? k)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

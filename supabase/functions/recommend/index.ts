// Transparent stock recommendation engine.
//
// GET ?max_price=500&min_volume=500000&count=5
//
// Pipeline (all ranking is computed HERE, in code — the LLM only
// narrates the result, so every number stays auditable):
//   1. Candidates  : market_snapshot filtered by price + liquidity
//   2. Shortlist   : top N by traded volume (liquidity proxy)
//   3. Deep dive   : daily candles per shortlisted name (parallel)
//   4. Metrics     : momentum, trend vs SMA50, volatility, volume trend,
//                    drawdown from 6-month high
//   5. Normalise   : percentile rank *within the analysed cohort*
//   6. Composite   : explicit fixed weights, returned with the payload
//   7. Context     : Nifty 50 level + % change for regime framing
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

const SHORTLIST = 30        // names we pull candles for
const CANDLE_PARALLEL = 8
const NIFTY_KEY = 'NSE_INDEX|Nifty 50'

const WEIGHTS = {
  momentum_3m: 0.30,
  trend_sma50: 0.25,
  low_volatility: 0.20,
  volume_trend: 0.15,
  recovery_room: 0.10,
} as const

const METHODOLOGY = {
  universe: 'All NSE mainboard equities (EQ + BE) with a live quote.',
  filters: 'last_price <= max_price AND volume >= min_volume (liquidity gate).',
  shortlist: `Top ${SHORTLIST} survivors by traded volume get a candle-level deep dive.`,
  metrics: {
    momentum_3m: 'Close-to-close return over the trailing ~63 sessions.',
    trend_sma50: 'Percent distance of last close above/below its 50-session simple moving average.',
    low_volatility: 'Annualised stdev of daily returns, inverted (calmer scores higher).',
    volume_trend: 'Mean volume of the last 10 sessions divided by the mean of the last 60.',
    recovery_room: 'Distance below the trailing 6-month high (more room scores higher).',
  },
  normalisation: 'Each metric is percentile-ranked (0-100) within the analysed cohort, not against absolute thresholds.',
  composite: WEIGHTS,
  caveats: [
    'Descriptive of past price behaviour only. Not a forecast.',
    'No fundamentals (P/E, debt, earnings) are used in this ranking.',
    'Liquidity gate excludes thinly-traded names but does not vet business quality.',
    'Not SEBI-registered investment advice.',
  ],
}

type Candidate = {
  instrument_key: string
  trading_symbol: string
  name: string
  last_price: number
  pct_change: number | null
  volume: number
}

type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const TOKEN = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!SUPABASE_URL || !SR) return json({ error: 'supabase env unset' }, 500)
  if (!TOKEN) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  const url = new URL(req.url)
  const maxPrice = clamp(Number(url.searchParams.get('max_price') ?? '500'), 1, 1_000_000)
  const minVolume = clamp(Number(url.searchParams.get('min_volume') ?? '500000'), 0, 1e12)
  const count = clamp(Number(url.searchParams.get('count') ?? '5'), 1, 15)

  // ---- 1 + 2. candidates → shortlist by liquidity -------------------
  const q = new URLSearchParams({
    select: 'instrument_key,trading_symbol,last_price,pct_change,volume,instruments(name)',
    last_price: `lte.${maxPrice}`,
    volume: `gte.${minVolume}`,
    order: 'volume.desc',
    limit: String(SHORTLIST),
  })
  const candRes = await fetch(`${SUPABASE_URL}/rest/v1/market_snapshot?${q}`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  })
  if (!candRes.ok) {
    return json({ error: 'candidate query failed', detail: (await candRes.text()).slice(0, 300) }, 500)
  }
  type Row = Omit<Candidate, 'name'> & { instruments: { name: string } | null }
  const raw: Row[] = await candRes.json()
  const candidates: Candidate[] = raw
    .filter((r) => r.last_price > 0)
    .map((r) => ({ ...r, name: r.instruments?.name ?? r.trading_symbol }))

  if (candidates.length === 0) {
    return json({
      query: { max_price: maxPrice, min_volume: minVolume, count },
      picks: [], analysed: 0,
      note: 'No stocks matched. Try raising max_price or lowering min_volume.',
      methodology: METHODOLOGY,
    })
  }

  // ---- 3. candles for the shortlist --------------------------------
  const series = new Map<string, Candle[]>()
  for (let i = 0; i < candidates.length; i += CANDLE_PARALLEL) {
    const group = candidates.slice(i, i + CANDLE_PARALLEL)
    const settled = await Promise.allSettled(group.map((c) => fetchCandles(c.instrument_key, TOKEN)))
    settled.forEach((s, j) => {
      if (s.status === 'fulfilled' && s.value.length > 60) series.set(group[j].instrument_key, s.value)
    })
  }

  // ---- 4. metrics ---------------------------------------------------
  type Metrics = {
    momentum_3m: number; trend_sma50: number; volatility: number
    volume_trend: number; drawdown: number
  }
  const analysed: { c: Candidate; m: Metrics }[] = []
  for (const c of candidates) {
    const s = series.get(c.instrument_key)
    if (!s) continue
    const closes = s.map((x) => x.c)
    const vols = s.map((x) => x.v)
    const last = closes.at(-1)!

    const back63 = closes.at(-64) ?? closes[0]
    const momentum_3m = back63 > 0 ? ((last - back63) / back63) * 100 : 0

    const sma50 = mean(closes.slice(-50))
    const trend_sma50 = sma50 > 0 ? ((last - sma50) / sma50) * 100 : 0

    const rets: number[] = []
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
    }
    const volatility = stdev(rets.slice(-63)) * Math.sqrt(252) * 100

    const v10 = mean(vols.slice(-10)), v60 = mean(vols.slice(-60))
    const volume_trend = v60 > 0 ? v10 / v60 : 1

    const high6m = Math.max(...closes.slice(-126))
    const drawdown = high6m > 0 ? ((high6m - last) / high6m) * 100 : 0

    analysed.push({ c, m: { momentum_3m, trend_sma50, volatility, volume_trend, drawdown } })
  }

  if (analysed.length === 0) {
    return json({
      query: { max_price: maxPrice, min_volume: minVolume, count },
      picks: [], analysed: 0,
      note: 'Candidates found but historical candles were unavailable for all of them.',
      methodology: METHODOLOGY,
    })
  }

  // ---- 5. percentile-rank each metric within the cohort -------------
  const pct = (vals: number[], higherIsBetter: boolean) => {
    const sorted = [...vals].sort((a, b) => a - b)
    return vals.map((v) => {
      const below = sorted.filter((x) => x < v).length
      const p = (below / Math.max(1, sorted.length - 1)) * 100
      return higherIsBetter ? p : 100 - p
    })
  }
  const sMom  = pct(analysed.map((a) => a.m.momentum_3m), true)
  const sTrd  = pct(analysed.map((a) => a.m.trend_sma50), true)
  const sVol  = pct(analysed.map((a) => a.m.volatility), false)   // lower vol is better
  const sVT   = pct(analysed.map((a) => a.m.volume_trend), true)
  const sRec  = pct(analysed.map((a) => a.m.drawdown), true)      // more room is better

  const scored = analysed.map((a, i) => {
    const sub = {
      momentum_3m: sMom[i],
      trend_sma50: sTrd[i],
      low_volatility: sVol[i],
      volume_trend: sVT[i],
      recovery_room: sRec[i],
    }
    const composite =
      sub.momentum_3m    * WEIGHTS.momentum_3m +
      sub.trend_sma50    * WEIGHTS.trend_sma50 +
      sub.low_volatility * WEIGHTS.low_volatility +
      sub.volume_trend   * WEIGHTS.volume_trend +
      sub.recovery_room  * WEIGHTS.recovery_room
    return {
      symbol: a.c.trading_symbol,
      name: a.c.name,
      instrument_key: a.c.instrument_key,
      last_price: round(a.c.last_price, 2),
      day_change_pct: a.c.pct_change != null ? round(a.c.pct_change, 2) : null,
      volume: a.c.volume,
      composite: round(composite, 1),
      subscores: mapRound(sub, 0),
      raw: {
        momentum_3m_pct: round(a.m.momentum_3m, 2),
        vs_sma50_pct: round(a.m.trend_sma50, 2),
        annualised_volatility_pct: round(a.m.volatility, 1),
        volume_10d_vs_60d: round(a.m.volume_trend, 2),
        below_6m_high_pct: round(a.m.drawdown, 1),
      },
      affordable_qty_at_max: Math.floor(maxPrice / a.c.last_price),
    }
  }).sort((x, y) => y.composite - x.composite)

  // ---- 6. market regime context ------------------------------------
  const market = await fetchNifty(TOKEN).catch(() => null)

  return json({
    query: { max_price: maxPrice, min_volume: minVolume, count },
    market,
    universe_size: candidates.length,
    analysed: analysed.length,
    picks: scored.slice(0, count),
    also_ranked: scored.slice(count, count + 5).map((s) => ({ symbol: s.symbol, composite: s.composite })),
    methodology: METHODOLOGY,
    generated_at: new Date().toISOString(),
  })
})

// ---------------- helpers ----------------
async function fetchCandles(key: string, token: string): Promise<Candle[]> {
  const to = new Date()
  const from = new Date(to.getTime() - 260 * 24 * 60 * 60 * 1000)
  const f = (d: Date) => d.toISOString().slice(0, 10)
  const res = await fetch(
    `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(key)}/day/${f(to)}/${f(from)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`candles ${res.status}`)
  const body = await res.json()
  const rows: (string | number)[][] = body?.data?.candles ?? []
  return rows
    .map((r) => ({
      t: Math.floor(new Date(r[0] as string).getTime() / 1000),
      o: +r[1], h: +r[2], l: +r[3], c: +r[4], v: +(r[5] ?? 0),
    }))
    .sort((a, b) => a.t - b.t)
}

async function fetchNifty(token: string) {
  const res = await fetch(
    `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(NIFTY_KEY)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) return null
  const body = await res.json()
  const q = Object.values(body?.data ?? {})[0] as
    { last_price?: number; net_change?: number; ohlc?: { close?: number } } | undefined
  if (!q?.last_price) return null
  const prev = q.ohlc?.close ?? (q.net_change != null ? q.last_price - q.net_change : null)
  const pct = prev ? ((q.last_price - prev) / prev) * 100 : null
  return {
    index: 'Nifty 50',
    last: round(q.last_price, 2),
    pct_change: pct != null ? round(pct, 2) : null,
    regime: pct == null ? 'unknown' : pct > 0.35 ? 'risk-on' : pct < -0.35 ? 'risk-off' : 'flat',
  }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const stdev = (xs: number[]) => {
  if (xs.length < 2) return 0
  const mu = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (xs.length - 1))
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo)
const mapRound = (o: Record<string, number>, d: number) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v, d)]))

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

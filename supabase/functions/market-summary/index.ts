// Batch market snapshot: Nifty 50 + top movers from the curated universe.
// One Upstox call, cached briefly at the edge via short cache-control.
//
// GET → { nifty: {last, pct}, gainers: [...5], losers: [...5], universe: [...] }
// Env: UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

const NIFTY_KEY = 'NSE_INDEX|Nifty 50'
const UNIVERSE: { symbol: string; key: string }[] = [
  { symbol: 'RELIANCE',   key: 'NSE_EQ|INE002A01018' },
  { symbol: 'TCS',        key: 'NSE_EQ|INE467B01029' },
  { symbol: 'HDFCBANK',   key: 'NSE_EQ|INE040A01034' },
  { symbol: 'INFY',       key: 'NSE_EQ|INE009A01021' },
  { symbol: 'ICICIBANK',  key: 'NSE_EQ|INE090A01021' },
  { symbol: 'HINDUNILVR', key: 'NSE_EQ|INE030A01027' },
  { symbol: 'ITC',        key: 'NSE_EQ|INE154A01025' },
  { symbol: 'SBIN',       key: 'NSE_EQ|INE062A01020' },
  { symbol: 'BHARTIARTL', key: 'NSE_EQ|INE397D01024' },
  { symbol: 'KOTAKBANK',  key: 'NSE_EQ|INE237A01028' },
  { symbol: 'LT',         key: 'NSE_EQ|INE018A01030' },
  { symbol: 'AXISBANK',   key: 'NSE_EQ|INE238A01034' },
  { symbol: 'MARUTI',     key: 'NSE_EQ|INE585B01010' },
  { symbol: 'BAJFINANCE', key: 'NSE_EQ|INE296A01024' },
  { symbol: 'SUNPHARMA',  key: 'NSE_EQ|INE044A01036' },
  { symbol: 'TATAMOTORS', key: 'NSE_EQ|INE155A01022' },
  { symbol: 'TATASTEEL',  key: 'NSE_EQ|INE081A01020' },
  { symbol: 'ONGC',       key: 'NSE_EQ|INE213A01029' },
  { symbol: 'ADANIENT',   key: 'NSE_EQ|INE423A01024' },
  { symbol: 'COALINDIA',  key: 'NSE_EQ|INE522F01014' },
]

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const token = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!token) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  const keys = [NIFTY_KEY, ...UNIVERSE.map((u) => u.key)].join(',')
  const res = await fetch(`https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) return json({ error: 'upstox error', detail: body }, res.status)

  type Q = { last_price?: number; close_price?: number; net_change?: number }
  const data: Record<string, Q> = body.data ?? {}

  const universe = UNIVERSE.map((u) => {
    const q = data[`NSE_EQ:${u.symbol}`] ?? {}
    const last = q.last_price ?? 0
    const prev = q.close_price ?? (last - (q.net_change ?? 0))
    const pct  = prev > 0 ? ((last - prev) / prev) * 100 : 0
    const chg  = last - prev
    return { symbol: u.symbol, last, prev, chg, pct }
  })
  const gainers = [...universe].sort((a, b) => b.pct - a.pct).slice(0, 5)
  const losers  = [...universe].sort((a, b) => a.pct - b.pct).slice(0, 5)

  const nRaw = data['NSE_INDEX:Nifty 50'] ?? {}
  const nLast = nRaw.last_price ?? null
  const nPrev = nRaw.close_price ?? (nLast != null && nRaw.net_change != null ? nLast - nRaw.net_change : null)
  const nPct  = nLast != null && nPrev ? ((nLast - nPrev) / nPrev) * 100 : null
  const nChg  = nLast != null && nPrev != null ? nLast - nPrev : null

  return json({
    nifty: { last: nLast, prev: nPrev, chg: nChg, pct: nPct },
    gainers,
    losers,
    universe,
    fetched_at: new Date().toISOString(),
  }, 200, 30) // 30s CDN cache
})

function json(body: unknown, status = 200, sMaxAge = 0) {
  const headers: Record<string, string> = {
    ...corsHeaders,
    'content-type': 'application/json',
  }
  if (sMaxAge > 0) headers['cache-control'] = `public, s-maxage=${sMaxAge}`
  return new Response(JSON.stringify(body), { status, headers })
}

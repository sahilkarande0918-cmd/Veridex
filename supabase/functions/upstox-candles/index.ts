// Historical OHLC candles for one instrument.
//
// GET  ?key=NSE_EQ|INE002A01018&interval=day&days=90
// Env: UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

type Interval = '1minute' | '30minute' | 'day' | 'week' | 'month'
const VALID: Interval[] = ['1minute', '30minute', 'day', 'week', 'month']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const token = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!token) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  const interval = (url.searchParams.get('interval') ?? 'day') as Interval
  const days = Number(url.searchParams.get('days') ?? '90')

  if (!key) return json({ error: 'missing ?key=<instrument_key>' }, 400)
  if (!VALID.includes(interval)) return json({ error: `bad interval, use one of: ${VALID.join(',')}` }, 400)

  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const upstox =
    `https://api.upstox.com/v2/historical-candle/${encodeURIComponent(key)}/${interval}/${fmt(to)}/${fmt(from)}`

  const res = await fetch(upstox, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) return json({ error: 'upstox error', detail: body }, res.status)

  // Upstox returns { status, data: { candles: [[ts, o, h, l, c, v, oi], ...] } }
  // Newest-first; lightweight-charts wants ascending.
  const raw: (string | number)[][] = body.data?.candles ?? []
  const candles = raw
    .map((c) => ({
      time: Math.floor(new Date(c[0] as string).getTime() / 1000),
      open: +c[1], high: +c[2], low: +c[3], close: +c[4],
      volume: +(c[5] ?? 0),
    }))
    .sort((a, b) => a.time - b.time)

  return json({ key, interval, days, candles })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

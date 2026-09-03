// Live LTP (last traded price) for one instrument.
// Frontend polls this every 5s per active symbol.
//
// GET  ?key=NSE_EQ|INE002A01018
// Env: UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const token = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!token) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (!key) return json({ error: 'missing ?key=<instrument_key>' }, 400)

  const upstox = `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${encodeURIComponent(key)}`
  const res = await fetch(upstox, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const body = await res.json()
  if (!res.ok) return json({ error: 'upstox error', detail: body }, res.status)

  // Upstox returns: { status:'success', data: { 'NSE_EQ:RELIANCE': { last_price, instrument_token } } }
  const [, first] = Object.entries(body.data ?? {})[0] ?? []
  const price = (first as { last_price?: number } | undefined)?.last_price ?? null
  return json({ key, price, fetched_at: new Date().toISOString() })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

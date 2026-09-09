// Refreshes public.market_snapshot with last price / prev close /
// volume for the whole NSE equity universe.
//
// Upstox caps instrument_key batches, so we chunk and run a few
// chunks in parallel. Individual chunk failures are tolerated —
// a partial refresh beats no refresh.
//
// POST → { instruments, chunks_ok, chunks_failed, upserted }
// Env: UPSTOX_ACCESS_TOKEN

import { corsHeaders } from '../_shared/cors.ts'

const CHUNK = 100        // instrument keys per Upstox request
const PARALLEL = 5       // concurrent Upstox requests
const UPSERT_CHUNK = 500

type Quote = {
  last_price?: number
  close_price?: number
  net_change?: number
  volume?: number
  ohlc?: { close?: number }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const TOKEN = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  if (!SUPABASE_URL || !SR) return json({ error: 'supabase env unset' }, 500)
  if (!TOKEN) return json({ error: 'UPSTOX_ACCESS_TOKEN unset' }, 500)

  // 1) pull the universe — PostgREST caps a page at 1000, so paginate
  const PAGE = 1000
  const universe: { instrument_key: string; trading_symbol: string }[] = []
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/instruments?select=instrument_key,trading_symbol&order=instrument_key`,
      {
        headers: {
          apikey: SR,
          Authorization: `Bearer ${SR}`,
          Range: `${from}-${from + PAGE - 1}`,
          'Range-Unit': 'items',
        },
      },
    )
    if (!r.ok) return json({ error: 'instruments read failed', detail: (await r.text()).slice(0, 300) }, 500)
    const page: { instrument_key: string; trading_symbol: string }[] = await r.json()
    universe.push(...page)
    if (page.length < PAGE) break
  }
  if (universe.length === 0) return json({ error: 'instruments table is empty — run sync-instruments first' }, 400)

  const bySymbol = new Map(universe.map((u) => [u.trading_symbol, u.instrument_key]))

  // 2) chunk + fetch quotes with bounded concurrency
  const chunks: typeof universe[] = []
  for (let i = 0; i < universe.length; i += CHUNK) chunks.push(universe.slice(i, i + CHUNK))

  const rows: Record<string, unknown>[] = []
  let ok = 0, failed = 0
  const now = new Date().toISOString()

  for (let i = 0; i < chunks.length; i += PARALLEL) {
    const group = chunks.slice(i, i + PARALLEL)
    const settled = await Promise.allSettled(group.map((c) => fetchQuotes(c, TOKEN)))
    for (const s of settled) {
      if (s.status !== 'fulfilled') { failed++; continue }
      ok++
      for (const [key, q] of Object.entries(s.value)) {
        // Upstox keys results as "NSE_EQ:SYMBOL"; map back to instrument_key
        const sym = key.includes(':') ? key.split(':')[1] : key
        const instrument_key = bySymbol.get(sym) ?? (key.includes('|') ? key : null)
        if (!instrument_key) continue
        const last = q.last_price ?? null
        const prev = q.ohlc?.close ?? q.close_price ??
          (last != null && q.net_change != null ? last - q.net_change : null)
        const pct = last != null && prev ? ((last - prev) / prev) * 100 : null
        rows.push({
          instrument_key,
          trading_symbol: sym,
          last_price: last,
          prev_close: prev,
          pct_change: pct,
          volume: q.volume ?? null,
          updated_at: now,
        })
      }
    }
  }

  // 3) upsert
  let upserted = 0
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const batch = rows.slice(i, i + UPSERT_CHUNK)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/market_snapshot?on_conflict=instrument_key`, {
      method: 'POST',
      headers: {
        apikey: SR, Authorization: `Bearer ${SR}`,
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    })
    if (r.ok) upserted += batch.length
  }

  return json({ instruments: universe.length, chunks_ok: ok, chunks_failed: failed, quoted: rows.length, upserted })
})

async function fetchQuotes(
  chunk: { instrument_key: string }[],
  token: string,
): Promise<Record<string, Quote>> {
  const keys = chunk.map((c) => c.instrument_key).join(',')
  const res = await fetch(
    `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`upstox ${res.status}`)
  const body = await res.json()
  return (body?.data ?? {}) as Record<string, Quote>
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

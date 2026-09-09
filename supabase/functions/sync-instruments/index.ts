// Loads the full Upstox NSE equity master into public.instruments.
//
// The master is a public gzipped JSON (no auth). We keep only the
// tradeable mainboard equity types (EQ = rolling settlement,
// BE = trade-to-trade) and upsert in chunks.
//
// POST / GET → { fetched, kept, upserted }
// Run once after deploy, then daily via pg_cron.

import { corsHeaders } from '../_shared/cors.ts'

const MASTER_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz'
const KEEP_TYPES = new Set(['EQ', 'BE'])
const CHUNK = 500

type Raw = {
  segment: string
  name: string
  exchange: string
  isin?: string
  instrument_type: string
  instrument_key: string
  lot_size?: number
  tick_size?: number
  trading_symbol: string
  short_name?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SR) return json({ error: 'supabase env unset' }, 500)

  // 1) download + gunzip + parse
  const res = await fetch(MASTER_URL)
  if (!res.ok || !res.body) return json({ error: `master fetch failed: ${res.status}` }, 502)
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'))
  const text = await new Response(stream).text()
  const all: Raw[] = JSON.parse(text)

  // 2) filter to tradeable NSE equity
  const rows = all
    .filter((i) => i.segment === 'NSE_EQ' && KEEP_TYPES.has(i.instrument_type))
    .map((i) => ({
      instrument_key: i.instrument_key,
      trading_symbol: i.trading_symbol,
      name: i.name,
      short_name: i.short_name ?? null,
      isin: i.isin ?? null,
      exchange: 'NSE',
      segment: i.segment,
      instrument_type: i.instrument_type,
      lot_size: i.lot_size ?? 1,
      tick_size: i.tick_size ?? null,
      updated_at: new Date().toISOString(),
    }))

  // 3) upsert in chunks
  let upserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/instruments?on_conflict=instrument_key`, {
      method: 'POST',
      headers: {
        apikey: SR,
        Authorization: `Bearer ${SR}`,
        'content-type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    })
    if (!r.ok) {
      return json({ error: 'upsert failed', at: i, detail: (await r.text()).slice(0, 400) }, 500)
    }
    upserted += batch.length
  }

  return json({ fetched: all.length, kept: rows.length, upserted, at: new Date().toISOString() })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

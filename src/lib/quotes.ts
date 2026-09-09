// Batch price lookup for a set of tickers.
//
// Portfolio / Profile / Overview used to fire one upstox-quote edge
// call PER HOLDING on a timer (4 holdings = 4 round-trips every 15s).
// market_snapshot already carries a live price for the whole universe
// and is refreshed server-side every 15 minutes during market hours,
// so one Postgres query replaces all of them.
//
// Charts still uses the per-symbol upstox-quote endpoint because it
// genuinely needs 5-second tick resolution on a single name.

import { supabase } from './supabase'
import { cached } from './cache'

export type PriceRow = { symbol: string; last_price: number; pct_change: number | null; updated_at: string }

export async function fetchPrices(symbols: string[]): Promise<Record<string, PriceRow>> {
  const want = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).filter(Boolean).sort()
  if (want.length === 0) return {}

  return cached(`prices:${want.join(',')}`, 30_000, async () => {
    const { data, error } = await supabase
      .from('market_snapshot')
      .select('trading_symbol,last_price,pct_change,updated_at')
      .in('trading_symbol', want)
    if (error) throw error

    const out: Record<string, PriceRow> = {}
    for (const r of (data ?? []) as { trading_symbol: string; last_price: number | null; pct_change: number | null; updated_at: string }[]) {
      if (r.last_price == null) continue
      out[r.trading_symbol.toUpperCase()] = {
        symbol: r.trading_symbol,
        last_price: Number(r.last_price),
        pct_change: r.pct_change != null ? Number(r.pct_change) : null,
        updated_at: r.updated_at,
      }
    }
    return out
  })
}

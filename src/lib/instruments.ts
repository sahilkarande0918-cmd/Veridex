// Instrument universe — backed by the full NSE master in Postgres
// (~2,900 equities), not a hardcoded list.
//
// Search goes through the relevance-ranked `search_instruments` RPC.
// Symbol → instrument_key lookups are cached in-module because the
// portfolio views resolve the same handful of tickers repeatedly.

import { supabase } from './supabase'
import { cached } from './cache'

export type Instrument = {
  symbol: string
  name: string
  key: string                 // Upstox instrument_key
  exchange: 'NSE'
  last_price?: number | null
  pct_change?: number | null
}

type Row = {
  instrument_key: string
  trading_symbol: string
  name: string
  short_name: string | null
  last_price: number | null
  pct_change: number | null
}

const toInstrument = (r: Row): Instrument => ({
  symbol: r.trading_symbol,
  name: r.short_name || r.name,
  key: r.instrument_key,
  exchange: 'NSE',
  last_price: r.last_price,
  pct_change: r.pct_change,
})

/** Relevance-ranked search across the whole NSE equity universe. */
export async function searchInstruments(q: string, limit = 20): Promise<Instrument[]> {
  const term = q.trim()
  if (!term) return defaultInstruments(limit)
  const { data, error } = await supabase.rpc('search_instruments', { q: term, lim: limit })
  if (error) throw error
  return ((data ?? []) as Row[]).map(toInstrument)
}

/** Most actively traded names — shown before the user types anything. */
export function defaultInstruments(limit = 20): Promise<Instrument[]> {
  return cached(`default-instruments:${limit}`, 60_000, () => loadDefaults(limit))
}

async function loadDefaults(limit: number): Promise<Instrument[]> {
  const { data, error } = await supabase
    .from('market_snapshot')
    .select('instrument_key,trading_symbol,last_price,pct_change,instruments(name,short_name)')
    .order('volume', { ascending: false })
    .limit(limit)
  if (error) throw error
  type Snap = {
    instrument_key: string; trading_symbol: string
    last_price: number | null; pct_change: number | null
    instruments: { name: string; short_name: string | null } | null
  }
  return ((data ?? []) as unknown as Snap[]).map((s) => ({
    symbol: s.trading_symbol,
    name: s.instruments?.short_name || s.instruments?.name || s.trading_symbol,
    key: s.instrument_key,
    exchange: 'NSE' as const,
    last_price: s.last_price,
    pct_change: s.pct_change,
  }))
}

// ---- symbol → instrument cache -------------------------------------
const cache = new Map<string, Instrument>()

/** Resolve many tickers to instruments at once. Cached across calls. */
export async function resolveSymbols(symbols: string[]): Promise<Map<string, Instrument>> {
  const want = Array.from(new Set(symbols.map((s) => s.toUpperCase()))).filter(Boolean)
  const missing = want.filter((s) => !cache.has(s))

  if (missing.length) {
    const { data } = await supabase
      .from('instruments')
      .select('instrument_key,trading_symbol,name,short_name')
      .in('trading_symbol', missing)
    for (const r of (data ?? []) as Omit<Row, 'last_price' | 'pct_change'>[]) {
      cache.set(r.trading_symbol.toUpperCase(), toInstrument({ ...r, last_price: null, pct_change: null }))
    }
  }

  const out = new Map<string, Instrument>()
  for (const s of want) {
    const hit = cache.get(s)
    if (hit) out.set(s, hit)
  }
  return out
}

/** Single-symbol convenience wrapper over resolveSymbols. */
export async function getInstrument(symbol: string): Promise<Instrument | null> {
  const m = await resolveSymbols([symbol])
  return m.get(symbol.toUpperCase()) ?? null
}

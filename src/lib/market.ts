import { supabase } from './supabase'
import { cached } from './cache'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export type Ticker = { symbol: string; last: number; prev: number; chg: number; pct: number }
export type MarketSummary = {
  nifty: { last: number | null; prev: number | null; chg: number | null; pct: number | null }
  gainers: Ticker[]
  losers: Ticker[]
  universe: Ticker[]
  fetched_at: string
}

export function fetchMarketSummary(): Promise<MarketSummary> {
  // TickerTape and Overview both want this; one call serves both.
  return cached('market-summary', 30_000, loadMarketSummary)
}

async function loadMarketSummary(): Promise<MarketSummary> {
  const url = `${SUPABASE_URL}/functions/v1/market-summary`
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token ?? ANON}` },
  })
  if (!res.ok) throw new Error(`market-summary failed: ${res.status}`)
  return res.json()
}

import { supabase } from './supabase'

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

export async function fetchMarketSummary(): Promise<MarketSummary> {
  const url = `${SUPABASE_URL}/functions/v1/market-summary`
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token ?? ANON}` },
  })
  if (!res.ok) throw new Error(`market-summary failed: ${res.status}`)
  return res.json()
}

import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export type BaseRate = {
  prob_up_pct: number | null
  prob_down_pct: number | null
  sample_size: number
  reliability: 'ok' | 'low'
  median_move_pct: number | null
  best_case_pct: number | null
  worst_case_pct: number | null
  unconditional_up_pct: number | null
  edge_vs_unconditional_pp: number | null
}

export type HorizonBlock = {
  score: number
  reads: string
  [k: string]: unknown
}

export type StockAnalysis = {
  symbol: string
  name: string
  instrument_key: string
  quote: {
    last_price: number
    day_change_pct: number | null
    volume: number
    week52_high: number
    week52_low: number
    position_in_52w_range_pct: number
  }
  market_context: { index: string; last: number; pct_change: number | null } | null
  technicals: {
    rsi14: number
    sma20: number; sma50: number; sma200: number
    vs_sma20_pct: number; vs_sma50_pct: number; vs_sma200_pct: number
    atr14: number; atr_pct: number
    volume_vs_20d_avg: number
    returns_pct: { w1: number | null; m1: number | null; m3: number | null; m6: number | null; y1: number | null }
  }
  base_rates: {
    current_state: string
    history_sessions: number
    matched_days: number
    horizons: Record<string, BaseRate>
  }
  horizon_fitness: {
    intraday: HorizonBlock
    swing_delivery: HorizonBlock
    long_term: HorizonBlock
    best_fit: 'intraday' | 'swing_delivery' | 'long_term'
    ranked: { horizon: string; score: number }[]
  }
  risk: {
    atr_stop_1x: number; atr_stop_2x: number
    recent_support_20d: number; recent_resistance_20d: number
    upside_to_resistance_pct: number; downside_to_support_pct: number
    note: string
  }
  methodology: Record<string, string>
  generated_at: string
}

export async function analyzeStock(instrumentKey: string): Promise<StockAnalysis> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/analyze-stock?key=${encodeURIComponent(instrumentKey)}`,
    { headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token ?? ANON}` } },
  )
  const body = await res.json()
  if (!res.ok) throw new Error(body?.error ? `${body.error}${body.hint ? ' — ' + body.hint : ''}` : `analyze failed: ${res.status}`)
  return body
}

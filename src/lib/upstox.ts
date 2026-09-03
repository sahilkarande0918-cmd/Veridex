import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export type Candle = {
  time: number    // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Interval = '1minute' | '30minute' | 'day' | 'week' | 'month'

async function invoke<T>(fn: string, params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams(params).toString()
  const url = `${SUPABASE_URL}/functions/v1/${fn}?${q}`

  // Auth token so the Edge Function can be locked down to authenticated users.
  const { data: { session } } = await supabase.auth.getSession()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${session?.access_token ?? key}`,
    },
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const fetchQuote = (key: string) =>
  invoke<{ key: string; price: number | null; fetched_at: string }>('upstox-quote', { key })

export const fetchCandles = (key: string, interval: Interval = 'day', days = 90) =>
  invoke<{ key: string; interval: Interval; days: number; candles: Candle[] }>('upstox-candles', {
    key,
    interval,
    days: String(days),
  })

import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export type Labeled = {
  title: string
  link: string
  source: string
  published_at: string
  summary?: string
  label: 'positive' | 'neutral' | 'negative'
  why: string
}

export type SentimentReport = {
  q: string
  counts: { positive: number; neutral: number; negative: number }
  labeled: Labeled[]
  fetched_at: string
  note?: string
}

export async function fetchSentiment(q: string): Promise<SentimentReport> {
  const url = `${SUPABASE_URL}/functions/v1/sentiment?q=${encodeURIComponent(q)}`
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token ?? ANON}` },
  })
  if (!res.ok) throw new Error(`sentiment failed: ${res.status} ${await res.text()}`)
  return res.json()
}

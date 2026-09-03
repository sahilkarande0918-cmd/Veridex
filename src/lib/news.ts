import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export type NewsItem = {
  title: string
  link: string
  source: string
  published_at: string    // ISO
  summary: string
  image?: string | null
}

async function call<T>(fn: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams(params).toString()
  const url = `${SUPABASE_URL}/functions/v1/${fn}${q ? `?${q}` : ''}`
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token ?? ANON}` },
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

export const fetchFeed = () =>
  call<{ items: NewsItem[]; errors: { source: string; error: string }[]; fetched_at: string }>('news-feed')

export const searchNews = (q: string) =>
  call<{ q: string; items: NewsItem[]; fetched_at: string }>('news-search', { q })

export function relTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = (Date.now() - then) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

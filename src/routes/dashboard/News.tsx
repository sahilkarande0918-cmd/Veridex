import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchFeed, searchNews, relTime, type NewsItem } from '@/lib/news'

type Tab = 'latest' | 'ipo' | 'search'

export default function News() {
  const [tab, setTab] = useState<Tab>('latest')
  const [items, setItems] = useState<NewsItem[]>([])
  const [errors, setErrors] = useState<{ source: string; error: string }[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const r = await fetchFeed()
      setItems(r.items); setErrors(r.errors ?? []); setFetchedAt(r.fetched_at)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  // refresh every 5 min
  useEffect(() => {
    const id = window.setInterval(load, 5 * 60_000)
    return () => window.clearInterval(id)
  }, [load])

  const filtered = useMemo(() => {
    if (tab === 'ipo') {
      const re = /\bipo\b/i
      return items.filter((i) => re.test(i.title) || re.test(i.summary))
    }
    return items
  }, [items, tab])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">News</h1>
          <p className="text-sm text-neutral-500 mt-1">
            RSS from Economic Times / Moneycontrol / LiveMint, refreshed every 5 minutes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {fetchedAt && (
            <span className="text-xs text-neutral-500">Updated {relTime(fetchedAt)}</span>
          )}
          <button onClick={load} className="h-8 px-3 rounded-md border border-neutral-800 hover:bg-neutral-900 text-xs">
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-neutral-900 border border-neutral-800 w-fit">
        <TabButton active={tab === 'latest'} onClick={() => setTab('latest')}>Latest</TabButton>
        <TabButton active={tab === 'ipo'}    onClick={() => setTab('ipo')}>IPO</TabButton>
        <TabButton active={tab === 'search'} onClick={() => setTab('search')}>Search company</TabButton>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-4 py-2 text-xs text-amber-200/80">
          Partial feed — {errors.map((e) => e.source).join(', ')} failed. Other sources shown below.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {err}. Deploy the Edge Function: <code>supabase functions deploy news-feed news-search</code>
        </div>
      )}

      {tab === 'search' ? (
        <NewsSearchPanel />
      ) : (
        <NewsList items={filtered} loading={loading} emptyMsg={tab === 'ipo' ? 'No IPO headlines in the current feed.' : 'No headlines yet.'} />
      )}
    </div>
  )
}

function NewsSearchPanel() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<NewsItem[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    setBusy(true); setErr(null); setSearched(true)
    try {
      const r = await searchNews(q.trim())
      setItems(r.items)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={go} className="flex gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search company or ticker: RELIANCE, HDFC, IPO…"
          className="flex-1 h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
        />
        <button
          type="submit" disabled={busy || !q.trim()}
          className="h-10 px-4 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
        >
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>
      {err && <p className="text-xs text-red-400">{err}</p>}
      {searched && !busy && items.length === 0 && !err && (
        <p className="text-sm text-neutral-500">No matches. Try a different term or ticker.</p>
      )}
      <NewsList items={items} loading={busy} />
    </div>
  )
}

function NewsList({ items, loading, emptyMsg }: { items: NewsItem[]; loading?: boolean; emptyMsg?: string }) {
  if (loading && items.length === 0) return <div className="text-sm text-neutral-500">Loading…</div>
  if (items.length === 0) return emptyMsg ? <div className="text-sm text-neutral-500">{emptyMsg}</div> : null
  return (
    <ul className="space-y-2">
      {items.map((n, i) => (
        <li key={`${n.link}-${i}`}>
          <a
            href={n.link} target="_blank" rel="noopener noreferrer"
            className="block rounded-xl border border-neutral-900 bg-neutral-950 hover:bg-neutral-900/60 transition p-4 space-y-1"
          >
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="text-violet-400">{n.source}</span>
              <span>·</span>
              <span>{relTime(n.published_at)}</span>
            </div>
            <div className="text-sm font-medium leading-snug">{n.title}</div>
            {n.summary && <div className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{n.summary}</div>}
          </a>
        </li>
      ))}
    </ul>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-md text-xs transition ${active ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-100'}`}
    >
      {children}
    </button>
  )
}

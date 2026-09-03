import { useEffect, useState } from 'react'
import { fetchMarketSummary, type Ticker } from '@/lib/market'

// Auto-scrolling ticker tape. Duplicates the list so the marquee loops
// seamlessly. Refreshes every 30s (Edge Function caches for 30s too).
export default function TickerTape() {
  const [items, setItems] = useState<Ticker[]>([])

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchMarketSummary()
        .then((r) => alive && setItems(r.universe.filter((u) => u.last > 0)))
        .catch(() => {})
    load()
    const id = window.setInterval(load, 30_000)
    return () => { alive = false; window.clearInterval(id) }
  }, [])

  if (items.length === 0) {
    return (
      <div className="h-8 border-b border-neutral-900 bg-neutral-950 overflow-hidden flex items-center">
        <span className="text-[10px] text-neutral-600 px-4">loading market…</span>
      </div>
    )
  }

  const doubled = [...items, ...items]
  return (
    <div className="h-8 border-b border-neutral-900 bg-neutral-950 overflow-hidden relative">
      <style>{`
        @keyframes veridex-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .veridex-marquee { animation: veridex-marquee 80s linear infinite; }
        .veridex-marquee:hover { animation-play-state: paused; }
      `}</style>
      <div className="veridex-marquee flex whitespace-nowrap h-full items-center">
        {doubled.map((t, i) => (
          <span key={`${t.symbol}-${i}`} className="inline-flex items-center gap-2 px-4 text-[11px] tabular border-r border-neutral-900">
            <span className="text-neutral-300 font-medium">{t.symbol}</span>
            <span className="text-neutral-100">{t.last.toFixed(2)}</span>
            <span className={t.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {t.pct >= 0 ? '▲' : '▼'} {Math.abs(t.pct).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

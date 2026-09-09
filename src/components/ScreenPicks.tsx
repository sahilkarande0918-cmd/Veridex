// Renders screener picks as cards instead of letting the model draw an
// ASCII table. The numbers come straight from the `recommend` payload,
// so nothing here is model-generated.

export type Pick = {
  symbol: string
  name: string
  last_price: number
  day_change_pct: number | null
  composite: number
  affordable_qty_at_max: number
  raw: {
    momentum_3m_pct: number
    vs_sma50_pct: number
    annualised_volatility_pct: number
    volume_10d_vs_60d: number
    below_6m_high_pct: number
  }
}

export type ScreenResult = {
  query: { max_price: number; min_volume: number; count: number }
  picks: Pick[]
  analysed: number
  universe_size: number
}

export default function ScreenPicks({ data }: { data: ScreenResult }) {
  if (!data?.picks?.length) return null
  const top = data.picks[0].composite

  return (
    <div className="mt-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">
        Top {data.picks.length} under ₹{data.query.max_price.toLocaleString('en-IN')} ·
        screened {data.analysed} of {data.universe_size} liquid names
      </div>

      {data.picks.map((p, i) => (
        <div key={p.symbol} className="rounded-lg border border-neutral-800 bg-black/30 p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-neutral-500 mr-1.5">#{i + 1}</span>
              <span className="text-sm font-semibold">{p.symbol}</span>
              <span className="text-[11px] text-neutral-500 ml-2 truncate">{p.name}</span>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-medium tabular">₹{p.last_price.toLocaleString('en-IN')}</div>
              {p.day_change_pct != null && (
                <div className={`text-[10px] tabular ${p.day_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {p.day_change_pct >= 0 ? '+' : ''}{p.day_change_pct}%
                </div>
              )}
            </div>
          </div>

          {/* composite score bar */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div className="h-full rounded-full bg-violet-500"
                   style={{ width: `${Math.max(4, (p.composite / Math.max(top, 1)) * 100)}%` }} />
            </div>
            <span className="text-xs font-medium tabular w-9 text-right">{p.composite}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-2.5 text-[10px]">
            <Stat k="3-mo move"   v={`${p.raw.momentum_3m_pct >= 0 ? '+' : ''}${p.raw.momentum_3m_pct}%`} good={p.raw.momentum_3m_pct >= 0} />
            <Stat k="vs SMA50"    v={`${p.raw.vs_sma50_pct >= 0 ? '+' : ''}${p.raw.vs_sma50_pct}%`} good={p.raw.vs_sma50_pct >= 0} />
            <Stat k="Volatility"  v={`${p.raw.annualised_volatility_pct}%`} />
            <Stat k="Buy w/ ₹"    v={`${p.affordable_qty_at_max}`} />
          </div>
        </div>
      ))}

      <p className="text-[10px] text-neutral-500 leading-relaxed">
        Ranked on price momentum and liquidity only — no earnings, debt or valuation.
        A high score means the stock <em>has been moving</em>, not that the business is sound.
      </p>
    </div>
  )
}

function Stat({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-neutral-500">{k}</span>
      <span className={`tabular ${good === undefined ? 'text-neutral-300' : good ? 'text-emerald-400' : 'text-red-400'}`}>{v}</span>
    </div>
  )
}

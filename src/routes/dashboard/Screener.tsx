import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { score, medians, type Scored } from '@/lib/screener'
import { SAMPLE_AS_OF, SAMPLE_SOURCE } from '@/data/fundamentals'
import Disclaimer from '@/components/Disclaimer'

type SortKey = 'composite' | 'value_score' | 'leverage_score' | 'growth_score' | 'symbol'

export default function Screener() {
  const { user } = useAuth()
  const [capital, setCapital] = useState<number>(50_000)
  const [affordableOnly, setAffordableOnly] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('composite')
  const [showMethodology, setShowMethodology] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('capital_available')
      .eq('id', user.id)
      .maybeSingle<{ capital_available: number | null }>()
      .then(({ data }) => {
        if (data?.capital_available && data.capital_available > 0) setCapital(data.capital_available)
      })
  }, [user])

  const rows = useMemo(() => {
    const all = score(capital)
    const filtered = affordableOnly ? all.filter((r) => r.affordable_qty > 0) : all
    return [...filtered].sort((a, b) => {
      if (sortKey === 'symbol') return a.f.symbol.localeCompare(b.f.symbol)
      return (b[sortKey] as number) - (a[sortKey] as number)
    })
  }, [capital, affordableOnly, sortKey])

  const med = medians()

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Screener</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Sample fundamentals
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Composite score = 40% value + 20% leverage + 40% growth · equal within each subscore.
          </p>
        </div>
        <button
          onClick={() => setShowMethodology((v) => !v)}
          className="h-9 px-3 rounded-md border border-neutral-800 hover:bg-neutral-900 text-xs"
        >
          {showMethodology ? 'Hide' : 'Show'} methodology
        </button>
      </div>

      {/* sample banner */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.03] px-4 py-3 text-xs text-amber-200/80">
        <strong className="text-amber-300">Sample data.</strong>{' '}
        Fundamentals shown here are illustrative round-numbers as of {SAMPLE_AS_OF}.
        Source: <em>{SAMPLE_SOURCE}</em>. The scoring engine, methodology,
        and UI are production-ready — swap the file <code className="text-neutral-400">src/data/fundamentals.ts</code> for
        a live fetch (Alpha Vantage OVERVIEW, FMP, or IndMoney fundamentals) to run against real numbers.
      </div>

      {showMethodology && (
        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-5 text-sm text-neutral-300 space-y-3">
          <div className="font-medium">How the score is built</div>
          <ul className="space-y-2 text-neutral-400 list-disc pl-5">
            <li>
              <strong className="text-neutral-200">Value (40%):</strong> average of two normalized
              scores — one for P/E, one for P/B. Each maps <em>lower is better</em>:
              <span className="ml-1">value / cross-section-median → 100 when far below median, 50 at median, 0 at 2× median.</span>
              Current medians: P/E <span className="tabular">{med.pe.toFixed(1)}</span>, P/B <span className="tabular">{med.pb.toFixed(1)}</span>.
            </li>
            <li>
              <strong className="text-neutral-200">Leverage (20%):</strong> same lower-is-better mapping
              applied to Debt/Equity. Median D/E: <span className="tabular">{med.de.toFixed(2)}</span>.
              Debt-free companies score highest.
            </li>
            <li>
              <strong className="text-neutral-200">Growth (40%):</strong> YoY revenue growth mapped
              linearly — 0% → 20, 10% → 55, 20% → 85, capped at 100.
            </li>
            <li>
              <strong className="text-neutral-200">Capital-aware filter:</strong> hides stocks whose
              approx spot exceeds your available capital. Toggle "show unaffordable" to include them.
            </li>
          </ul>
          <div className="text-neutral-500 text-xs pt-2 border-t border-neutral-900">
            No look-ahead: subscores use only the current fundamentals row. Composite
            has no time-series component and does not predict future price movement.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-neutral-900 bg-neutral-950 p-4">
        <label className="space-y-1.5">
          <span className="text-xs text-neutral-400">Available capital (₹)</span>
          <input
            type="number" min={0} step={1000} value={capital}
            onChange={(e) => setCapital(Number(e.target.value) || 0)}
            className="h-9 w-40 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600 tabular"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-neutral-300 h-9">
          <input
            type="checkbox" checked={affordableOnly}
            onChange={(e) => setAffordableOnly(e.target.checked)}
          />
          Affordable only
        </label>
        <label className="space-y-1.5 ml-auto">
          <span className="text-xs text-neutral-400">Sort</span>
          <select
            value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm"
          >
            <option value="composite">Composite score</option>
            <option value="value_score">Value</option>
            <option value="leverage_score">Leverage</option>
            <option value="growth_score">Growth</option>
            <option value="symbol">Symbol</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-neutral-900 bg-neutral-950 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-[11px] uppercase tracking-wider text-neutral-500 bg-neutral-900/50">
            <tr>
              <Th>Symbol</Th>
              <Th align="right">Score</Th>
              <Th align="right">Value</Th>
              <Th align="right">Leverage</Th>
              <Th align="right">Growth</Th>
              <Th align="right">P/E</Th>
              <Th align="right">P/B</Th>
              <Th align="right">D/E</Th>
              <Th align="right">Rev g%</Th>
              <Th align="right">Price</Th>
              <Th align="right">Buyable qty</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.f.symbol} r={r} />
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="p-8 text-center text-neutral-500 text-sm">
                Increase capital or toggle "affordable only" off.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Disclaimer />
    </div>
  )
}

function Row({ r }: { r: Scored }) {
  return (
    <tr className="border-t border-neutral-900 hover:bg-neutral-900/40">
      <Td>
        <div className="font-medium">{r.f.symbol}</div>
        <div className="text-[11px] text-neutral-500 truncate max-w-[180px]">{r.name} · {r.sector}</div>
      </Td>
      <Td align="right"><ScoreBadge v={r.composite} big /></Td>
      <Td align="right"><ScoreBadge v={r.value_score} /></Td>
      <Td align="right"><ScoreBadge v={r.leverage_score} /></Td>
      <Td align="right"><ScoreBadge v={r.growth_score} /></Td>
      <Td align="right" className="tabular">{r.f.pe.toFixed(1)}</Td>
      <Td align="right" className="tabular">{r.f.pb.toFixed(1)}</Td>
      <Td align="right" className="tabular">{r.f.de.toFixed(2)}</Td>
      <Td align="right" className="tabular">{(r.f.rev_growth * 100).toFixed(0)}%</Td>
      <Td align="right" className="tabular">₹{r.f.last_price.toLocaleString('en-IN')}</Td>
      <Td align="right" className="tabular">{r.affordable_qty}</Td>
    </tr>
  )
}

function ScoreBadge({ v, big }: { v: number; big?: boolean }) {
  const tone =
    v >= 70 ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : v >= 45 ? 'bg-neutral-800/40 text-neutral-300 border-neutral-800'
    : 'bg-red-500/10 text-red-300 border-red-500/20'
  return (
    <span className={`inline-flex justify-center min-w-[42px] px-2 py-0.5 rounded border tabular ${tone} ${big ? 'text-sm font-semibold' : 'text-xs'}`}>
      {v.toFixed(0)}
    </span>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-3 font-normal text-${align}`}>{children}</th>
}
function Td({ children, align = 'left', className = '' }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-3 py-3 text-${align} ${className}`}>{children}</td>
}

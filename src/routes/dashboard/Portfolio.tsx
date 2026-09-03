import { useCallback, useEffect, useMemo, useState } from 'react'
import { listHoldings, deleteHolding, type Holding } from '@/lib/portfolio'
import { fetchQuote } from '@/lib/upstox'
import { bySymbol } from '@/lib/instruments'
import AddHoldingModal from '@/components/AddHoldingModal'
import AllocationChart from '@/components/AllocationChart'

type PriceMap = Record<string, number> // symbol → LTP

export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const rows = await listHoldings()
      setHoldings(rows)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll LTP per unique symbol every 15s. ponytail: no batch endpoint yet,
  // 15s cadence keeps request volume tame for a demo portfolio.
  useEffect(() => {
    if (holdings.length === 0) return
    const symbols = Array.from(new Set(holdings.map((h) => h.symbol)))

    const tick = () => {
      symbols.forEach((sym) => {
        const inst = bySymbol(sym)
        if (!inst) return
        fetchQuote(inst.key)
          .then((r) => {
            if (r.price != null) setPrices((p) => ({ ...p, [sym]: r.price! }))
          })
          .catch(() => {})
      })
    }
    tick()
    const id = window.setInterval(tick, 15_000)
    return () => window.clearInterval(id)
  }, [holdings])

  const rows = useMemo(() => holdings.map((h) => {
    const ltp = prices[h.symbol]
    const invested = h.qty * h.buy_price
    const current  = ltp != null ? h.qty * ltp : null
    const pnl      = current != null ? current - invested : null
    const pnlPct   = pnl != null && invested > 0 ? (pnl / invested) * 100 : null
    return { h, ltp, invested, current, pnl, pnlPct }
  }), [holdings, prices])

  const totals = useMemo(() => {
    const invested = rows.reduce((s, r) => s + r.invested, 0)
    const current  = rows.reduce((s, r) => s + (r.current ?? r.invested), 0)
    const pnl      = current - invested
    const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0
    const anyLive  = rows.some((r) => r.current != null)
    return { invested, current, pnl, pnlPct, anyLive }
  }, [rows])

  const slices = useMemo(
    () => rows.map((r) => ({ label: r.h.symbol, value: r.invested })),
    [rows],
  )

  const del = async (id: string) => {
    if (!confirm('Delete this position?')) return
    await deleteHolding(id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
            {totals.anyLive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Live P&L
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1">Manual entry — Upstox holdings auto-import lands later.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="h-10 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium"
        >
          + Add position
        </button>
      </div>

      {/* summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Invested"     value={`₹${totals.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} />
        <SummaryCard label="Current value" value={`₹${totals.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} muted={!totals.anyLive} />
        <SummaryCard
          label="Unrealized P&L"
          value={`${totals.pnl >= 0 ? '+' : ''}₹${totals.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}  (${totals.pnlPct.toFixed(2)}%)`}
          tone={totals.pnl >= 0 ? 'pos' : 'neg'}
          muted={!totals.anyLive}
        />
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      {loading && holdings.length === 0 && (
        <div className="text-sm text-neutral-500">Loading…</div>
      )}

      {!loading && holdings.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center space-y-3">
          <div className="text-sm text-neutral-400">No positions yet.</div>
          <button onClick={() => setAddOpen(true)} className="text-sm text-violet-400 hover:text-violet-300">
            Add your first position
          </button>
        </div>
      )}

      {holdings.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
          <section className="rounded-xl border border-neutral-900 bg-neutral-950 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-neutral-500 bg-neutral-900/50">
                <tr>
                  <Th>Symbol</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Buy ₹</Th>
                  <Th align="right">LTP ₹</Th>
                  <Th align="right">Invested</Th>
                  <Th align="right">Current</Th>
                  <Th align="right">P&L</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.h.id} className="border-t border-neutral-900 hover:bg-neutral-900/40">
                    <Td>
                      <div className="font-medium">{r.h.symbol}</div>
                      <div className="text-[11px] text-neutral-500">{new Date(r.h.buy_date).toLocaleDateString('en-IN')}</div>
                    </Td>
                    <Td align="right" className="tabular">{r.h.qty}</Td>
                    <Td align="right" className="tabular">{r.h.buy_price.toFixed(2)}</Td>
                    <Td align="right" className="tabular">{r.ltp != null ? r.ltp.toFixed(2) : '—'}</Td>
                    <Td align="right" className="tabular">₹{r.invested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Td>
                    <Td align="right" className="tabular">{r.current != null ? `₹${r.current.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}</Td>
                    <Td align="right" className={`tabular ${r.pnl == null ? 'text-neutral-500' : r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.pnl == null
                        ? '—'
                        : `${r.pnl >= 0 ? '+' : ''}₹${r.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${r.pnlPct?.toFixed(2)}%)`}
                    </Td>
                    <Td align="right">
                      <button onClick={() => del(r.h.id)} className="text-xs text-neutral-500 hover:text-red-400">Delete</button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
            <div className="text-sm font-medium mb-2">Allocation</div>
            <AllocationChart slices={slices} />
          </section>
        </div>
      )}

      {addOpen && (
        <AddHoldingModal
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load() }}
        />
      )}
    </div>
  )
}

function SummaryCard({
  label, value, tone, muted,
}: {
  label: string
  value: string
  tone?: 'pos' | 'neg'
  muted?: boolean
}) {
  const toneCls = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-neutral-100'
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-xl font-semibold tabular mt-1 ${muted ? 'opacity-60' : ''} ${toneCls}`}>{value}</div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-4 py-3 font-normal text-${align}`}>{children}</th>
}
function Td({
  children, align = 'left', className = '',
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return <td className={`px-4 py-3 text-${align} ${className}`}>{children}</td>
}

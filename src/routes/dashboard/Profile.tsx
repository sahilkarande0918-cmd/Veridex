import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { listHoldings, type Holding } from '@/lib/portfolio'
import { fetchQuote } from '@/lib/upstox'
import { bySymbol, INSTRUMENTS } from '@/lib/instruments'
import { useCountUp } from '@/lib/useCountUp'
import AllocationChart from '@/components/AllocationChart'
import Disclaimer from '@/components/Disclaimer'

type Profile = {
  email: string | null
  full_name: string | null
  capital_available: number | null
  risk_tolerance: string | null
  goal_horizon: string | null
  created_at: string
}

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    if (!user) return
    const [{ data: p }, hs] = await Promise.all([
      supabase.from('profiles').select('email,full_name,capital_available,risk_tolerance,goal_horizon,created_at')
        .eq('id', user.id).maybeSingle<Profile>(),
      listHoldings(),
    ])
    setProfile(p ?? null)
    setHoldings(hs)
  }, [user])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (holdings.length === 0) return
    const syms = Array.from(new Set(holdings.map((h) => h.symbol)))
    const tick = () => syms.forEach((sym) => {
      const inst = bySymbol(sym)
      if (!inst) return
      fetchQuote(inst.key)
        .then((r) => r.price != null && setPrices((p) => ({ ...p, [sym]: r.price! })))
        .catch(() => {})
    })
    tick()
    const id = window.setInterval(tick, 20_000)
    return () => window.clearInterval(id)
  }, [holdings])

  const rows = useMemo(() => holdings.map((h) => {
    const ltp = prices[h.symbol]
    const invested = h.qty * h.buy_price
    const current  = ltp != null ? h.qty * ltp : invested
    const pnl      = current - invested
    const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0
    return { h, ltp, invested, current, pnl, pnlPct }
  }), [holdings, prices])

  const totals = useMemo(() => {
    const invested = rows.reduce((s, r) => s + r.invested, 0)
    const current  = rows.reduce((s, r) => s + r.current, 0)
    const pnl      = current - invested
    const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0
    return { invested, current, pnl, pnlPct }
  }, [rows])

  const cash = profile?.capital_available ?? 0
  const netWorth = totals.current + cash
  const netWorthAnim = useCountUp(netWorth, 900)

  const sectorSlices = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach((r) => {
      const sect = INSTRUMENTS.find((i) => i.symbol === r.h.symbol)?.sector ?? 'Other'
      map[sect] = (map[sect] ?? 0) + r.current
    })
    return Object.entries(map).map(([label, value]) => ({ label, value }))
  }, [rows])

  const topHoldings = useMemo(() => [...rows].sort((a, b) => b.current - a.current).slice(0, 5), [rows])
  const best = useMemo(() => rows.length ? [...rows].sort((a, b) => b.pnlPct - a.pnlPct)[0] : null, [rows])
  const worst = useMemo(() => rows.length ? [...rows].sort((a, b) => a.pnlPct - b.pnlPct)[0] : null, [rows])

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Live</span>
          </div>
          <p className="text-sm text-neutral-500 mt-1">{profile?.email ?? user?.email}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/portfolio" className="h-9 px-3 rounded-md border border-neutral-800 hover:bg-neutral-900 text-xs flex items-center">Manage positions</Link>
          <Link to="/dashboard/screener"  className="h-9 px-3 rounded-md bg-violet-600 hover:bg-violet-500 text-xs font-medium flex items-center">Find picks</Link>
        </div>
      </div>

      {/* Net worth strip */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-neutral-900 bg-gradient-to-br from-violet-600/[0.08] via-neutral-950 to-neutral-950 p-6 relative overflow-hidden"
      >
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total net worth</div>
        <div className="text-4xl font-semibold tabular mt-1">₹{fmt(netWorthAnim)}</div>
        <div className={`text-sm tabular mt-1 ${totals.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {totals.pnl >= 0 ? '▲' : '▼'} ₹{fmt(Math.abs(totals.pnl))} ({totals.pnlPct.toFixed(2)}%)
          <span className="text-neutral-500 ml-2">on stocks</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Stat label="Stocks · current" value={`₹${fmt(totals.current)}`} />
          <Stat label="Stocks · invested" value={`₹${fmt(totals.invested)}`} />
          <Stat label="Cash / free capital" value={`₹${fmt(cash)}`} />
          <Stat label="Positions" value={String(rows.length)} />
        </div>
      </motion.div>

      {/* Composition + best/worst */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4">
        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
          <div className="text-sm font-medium mb-3">Top holdings</div>
          {topHoldings.length === 0 ? (
            <div className="text-xs text-neutral-500">
              No positions yet — <Link to="/dashboard/portfolio" className="text-violet-400 hover:text-violet-300">add one</Link>.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="text-left font-normal pb-2">Stock</th>
                  <th className="text-right font-normal pb-2">Qty</th>
                  <th className="text-right font-normal pb-2">LTP</th>
                  <th className="text-right font-normal pb-2">Value</th>
                  <th className="text-right font-normal pb-2">P&L</th>
                </tr>
              </thead>
              <tbody>
                {topHoldings.map((r) => (
                  <tr key={r.h.id} className="border-t border-neutral-900">
                    <td className="py-2">
                      <div className="font-medium">{r.h.symbol}</div>
                      <div className="text-[10px] text-neutral-500">{INSTRUMENTS.find((i) => i.symbol === r.h.symbol)?.sector ?? '—'}</div>
                    </td>
                    <td className="text-right tabular py-2">{r.h.qty}</td>
                    <td className="text-right tabular py-2">{r.ltp != null ? r.ltp.toFixed(2) : '—'}</td>
                    <td className="text-right tabular py-2">₹{fmt(r.current)}</td>
                    <td className={`text-right tabular py-2 ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.pnl >= 0 ? '+' : ''}{r.pnlPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
          <div className="text-sm font-medium mb-2">Sector allocation</div>
          {sectorSlices.length === 0 ? (
            <div className="text-xs text-neutral-500 py-8 text-center">Add positions to see sector split.</div>
          ) : (
            <AllocationChart slices={sectorSlices} />
          )}
        </div>
      </div>

      {/* Best/worst + profile info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PerformerCard label="Best performer" row={best} />
        <PerformerCard label="Worst performer" row={worst} />
        <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-3">Preferences</div>
          <dl className="space-y-2 text-xs">
            <Row k="Risk tolerance" v={profile?.risk_tolerance ?? '—'} />
            <Row k="Goal horizon"   v={horizonLabel(profile?.goal_horizon)} />
            <Row k="Member since"   v={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
          </dl>
        </div>
      </div>

      <Disclaimer />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-sm font-medium tabular mt-1">{value}</div>
    </div>
  )
}

function PerformerCard({ label, row }: { label: string; row: { h: Holding; pnlPct: number; pnl: number; current: number } | null }) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      {!row ? (
        <div className="text-xs text-neutral-500 mt-3">—</div>
      ) : (
        <>
          <div className="text-lg font-semibold mt-2">{row.h.symbol}</div>
          <div className={`text-sm tabular ${row.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {row.pnl >= 0 ? '+' : ''}{row.pnlPct.toFixed(2)}% · ₹{fmt(row.current)}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-neutral-200 capitalize">{v}</dd>
    </div>
  )
}

function horizonLabel(h?: string | null) {
  if (!h) return '—'
  if (h === 'short')  return '< 1 year'
  if (h === 'medium') return '1–3 years'
  if (h === 'long')   return '3+ years'
  return h
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

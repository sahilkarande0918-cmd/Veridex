import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Onboarding from '@/components/Onboarding'
import { listHoldings, type Holding } from '@/lib/portfolio'
import { fetchQuote } from '@/lib/upstox'
import { fetchMarketSummary, type MarketSummary } from '@/lib/market'
import { fetchFeed, relTime, type NewsItem } from '@/lib/news'
import { bySymbol } from '@/lib/instruments'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }

export default function Overview() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [market, setMarket] = useState<MarketSummary | null>(null)
  const [news, setNews] = useState<NewsItem[]>([])

  useEffect(() => { listHoldings().then(setHoldings).catch(() => {}) }, [])
  useEffect(() => { fetchMarketSummary().then(setMarket).catch(() => {}) }, [])
  useEffect(() => { fetchFeed().then((r) => setNews(r.items.slice(0, 5))).catch(() => {}) }, [])

  useEffect(() => {
    if (holdings.length === 0) return
    const syms = Array.from(new Set(holdings.map((h) => h.symbol)))
    syms.forEach((sym) => {
      const inst = bySymbol(sym)
      if (!inst) return
      fetchQuote(inst.key).then((r) => r.price != null && setPrices((p) => ({ ...p, [sym]: r.price! }))).catch(() => {})
    })
  }, [holdings])

  const portfolio = useMemo(() => {
    const invested = holdings.reduce((s, h) => s + h.qty * h.buy_price, 0)
    const current  = holdings.reduce((s, h) => s + h.qty * (prices[h.symbol] ?? h.buy_price), 0)
    const pnl = current - invested
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
    const anyLive = holdings.some((h) => prices[h.symbol] != null)
    return { invested, current, pnl, pnlPct, count: holdings.length, anyLive }
  }, [holdings, prices])

  return (
    <>
      <Onboarding />
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-neutral-500 text-sm mt-1">Live snapshot of your portfolio and the market.</p>
        </div>

        {/* KPI strip */}
        <motion.div
          initial="hidden" animate="show" variants={stagger}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <Kpi
            label="Portfolio value"
            value={portfolio.count === 0 ? '—' : `₹${fmt(portfolio.current)}`}
            sub={portfolio.count === 0 ? 'No positions yet' : `${portfolio.count} position${portfolio.count === 1 ? '' : 's'}`}
            to="/dashboard/profile"
          />
          <Kpi
            label="Unrealized P&L"
            value={portfolio.count === 0 ? '—' : `${portfolio.pnl >= 0 ? '+' : ''}₹${fmt(portfolio.pnl)}`}
            sub={portfolio.count === 0 ? '' : `${portfolio.pnlPct.toFixed(2)}%`}
            tone={portfolio.count === 0 ? undefined : portfolio.pnl >= 0 ? 'pos' : 'neg'}
            to="/dashboard/portfolio"
          />
          <Kpi
            label="Nifty 50"
            value={market?.nifty.last != null ? fmt(market.nifty.last) : '—'}
            sub={market?.nifty.pct != null ? `${market.nifty.pct >= 0 ? '+' : ''}${market.nifty.pct.toFixed(2)}%` : 'loading…'}
            tone={market?.nifty.pct != null ? (market.nifty.pct >= 0 ? 'pos' : 'neg') : undefined}
            to="/dashboard/charts"
          />
          <Kpi
            label="Top mover"
            value={market?.gainers?.[0]?.symbol ?? '—'}
            sub={market?.gainers?.[0] ? `+${market.gainers[0].pct.toFixed(2)}%` : ''}
            tone="pos"
            to="/dashboard/charts"
          />
        </motion.div>

        {/* Two-column feature strip */}
        <motion.div
          initial="hidden" animate="show" variants={stagger}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {/* Movers card */}
          <LinkCard to="/dashboard/charts" title="Top movers" note="Live · from your universe">
            <div className="grid grid-cols-2 gap-3 mt-3">
              <MoverList title="Gainers" items={market?.gainers ?? []} tone="pos" />
              <MoverList title="Losers"  items={market?.losers ?? []}  tone="neg" />
            </div>
          </LinkCard>

          {/* Signals shortcut */}
          <LinkCard to="/dashboard/signals" title="Signals" note="Anomaly + sentiment">
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              Z-score volume/price anomalies over a 20-day window, plus Groq-classified headline tone.
              Every signal shows its methodology inline. Pick a stock →
            </p>
            <div className="flex gap-2 mt-3">
              <Chip>|z| ≥ 2 flagged</Chip>
              <Chip>AI-classified tone</Chip>
              <Chip>No forecasts</Chip>
            </div>
          </LinkCard>

          {/* News card */}
          <LinkCard to="/dashboard/news" title="Latest news" note={news[0] ? `Updated ${relTime(news[0].published_at)}` : 'loading…'}>
            <ul className="mt-3 space-y-2">
              {news.length === 0 && <li className="text-xs text-neutral-500">Fetching feed…</li>}
              {news.map((n, i) => (
                <li key={i} className="text-xs">
                  <div className="text-[10px] text-neutral-500"><span className="text-violet-400">{n.source}</span> · {relTime(n.published_at)}</div>
                  <div className="text-neutral-200 truncate">{n.title}</div>
                </li>
              ))}
            </ul>
          </LinkCard>

          {/* Chat + Screener */}
          <LinkCard to="/dashboard/chat" title="AI chat" note="Grounded · Llama 3.3 70B">
            <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
              Ask "what's Nifty doing today?" or "how is my portfolio doing?" — Veridex fetches live data
              <em> before </em> the model replies, so answers cite real numbers, not memory.
            </p>
            <div className="flex gap-2 mt-3">
              <Chip>market · news</Chip>
              <Chip>your holdings</Chip>
              <Chip>screener top-3</Chip>
            </div>
          </LinkCard>
        </motion.div>

        <div className="text-[10px] text-neutral-600 border-t border-neutral-900 pt-3">
          Not SEBI-registered investment advice. Educational/analytical tool only.
        </div>
      </div>
    </>
  )
}

/* -------------------- little components -------------------- */

function Kpi({
  label, value, sub, tone, to,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'pos' | 'neg'
  to: string
}) {
  const toneCls = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-neutral-100'
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
    <Link
      to={to}
      className="group relative rounded-xl border border-neutral-900 bg-gradient-to-br from-neutral-950 to-neutral-950/40 p-4 hover:border-violet-500/40 transition overflow-hidden block"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-violet-600/[0.03] to-transparent pointer-events-none" />
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className={`text-xl font-semibold tabular mt-1 ${toneCls}`}>{value}</div>
      {sub && <div className={`text-[11px] tabular mt-0.5 ${tone === 'pos' ? 'text-emerald-400/70' : tone === 'neg' ? 'text-red-400/70' : 'text-neutral-500'}`}>{sub}</div>}
    </Link>
    </motion.div>
  )
}

function LinkCard({
  to, title, note, children,
}: {
  to: string
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <motion.div variants={fadeUp} whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
    <Link
      to={to}
      className="group rounded-xl border border-neutral-900 bg-neutral-950 p-4 hover:border-violet-500/40 transition block"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <div className="flex items-center gap-2">
          {note && <span className="text-[10px] text-neutral-500">{note}</span>}
          <span className="text-neutral-500 group-hover:text-violet-300 transition text-lg leading-none">→</span>
        </div>
      </div>
      {children}
    </Link>
    </motion.div>
  )
}

function MoverList({ title, items, tone }: { title: string; items: { symbol: string; pct: number }[]; tone: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-emerald-400' : 'text-red-400'
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">{title}</div>
      <ul className="space-y-1">
        {items.length === 0 && <li className="text-xs text-neutral-500">—</li>}
        {items.map((m) => (
          <li key={m.symbol} className="flex justify-between text-xs tabular border-b border-neutral-900 py-1 last:border-b-0">
            <span className="text-neutral-300 font-medium">{m.symbol}</span>
            <span className={color}>{m.pct >= 0 ? '+' : ''}{m.pct.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">{children}</span>
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

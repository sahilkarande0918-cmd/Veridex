import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import SymbolSearch from '@/components/SymbolSearch'
import Disclaimer from '@/components/Disclaimer'
import { defaultInstruments, type Instrument } from '@/lib/instruments'
import { analyzeStock, type StockAnalysis, type BaseRate, type Verdict } from '@/lib/analyze'

const HORIZON_LABEL: Record<string, string> = {
  intraday: 'Intraday',
  swing_delivery: 'Swing / Delivery',
  long_term: 'Long term',
}

export default function Analyze() {
  const [pick, setPick] = useState<Instrument | null>(null)
  const [data, setData] = useState<StockAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // seed with the most active name so the page isn't empty on arrival
  useEffect(() => {
    defaultInstruments(1).then((r) => r[0] && setPick(r[0])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!pick) return
    let alive = true
    setBusy(true); setErr(null); setData(null)
    analyzeStock(pick.key)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setBusy(false))
    return () => { alive = false }
  }, [pick?.key])

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Analyze</h1>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Any NSE stock
          </span>
        </div>
        <p className="text-sm text-neutral-500 mt-1">
          Trader-grade read on any listed equity. Up/down percentages are{' '}
          <span className="text-neutral-300">historical base rates</span> — how often this exact
          setup resolved higher in the past, with the sample size shown. Not a forecast.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <aside className="rounded-xl border border-neutral-900 bg-neutral-950 overflow-hidden h-[75vh]">
          <SymbolSearch value={pick} onPick={setPick} maxHeight="calc(75vh - 84px)" />
        </aside>

        <section className="space-y-4 min-w-0">
          {busy && <Panel><div className="text-sm text-neutral-500">Pulling 3 years of candles and computing base rates…</div></Panel>}
          {err && <Panel><div className="text-sm text-red-400">{err}</div></Panel>}
          {data && <Report d={data} />}
          {!busy && !err && !data && <Panel><div className="text-sm text-neutral-500">Pick a stock to analyze.</div></Panel>}
        </section>
      </div>

      <Disclaimer ai />
    </div>
  )
}

function Report({ d }: { d: StockAnalysis }) {
  const t = d.technicals
  const best = d.horizon_fitness.best_fit
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-4"
    >
      {/* header */}
      <Panel>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-baseline gap-3">
              <h2 className="text-2xl font-semibold">{d.symbol}</h2>
              <span className="text-3xl font-semibold tabular">₹{d.quote.last_price.toFixed(2)}</span>
              {d.quote.day_change_pct != null && (
                <span className={`text-sm tabular ${d.quote.day_change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {d.quote.day_change_pct >= 0 ? '▲' : '▼'} {Math.abs(d.quote.day_change_pct).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="text-xs text-neutral-500 mt-1">{d.name}</div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            <div>52w ₹{d.quote.week52_low.toFixed(0)} – ₹{d.quote.week52_high.toFixed(0)}</div>
            <div className="tabular">{d.quote.position_in_52w_range_pct.toFixed(0)}% of range</div>
            {d.market_context?.pct_change != null && (
              <div className="mt-1">Nifty {d.market_context.pct_change >= 0 ? '+' : ''}{d.market_context.pct_change}%</div>
            )}
          </div>
        </div>
        {/* 52w position bar */}
        <div className="mt-4 h-1.5 rounded-full bg-neutral-900 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 bg-violet-600 rounded-full"
               style={{ width: `${Math.min(100, Math.max(0, d.quote.position_in_52w_range_pct))}%` }} />
        </div>
      </Panel>

      {/* THE CALL */}
      <VerdictCard v={d.verdict} />

      {/* verdict */}
      <Panel>
        <SectionTitle>Best-fit horizon</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {(['intraday', 'swing_delivery', 'long_term'] as const).map((h) => {
            const block = d.horizon_fitness[h]
            const isBest = h === best
            return (
              <div key={h} className={`rounded-lg border p-3 ${isBest ? 'border-violet-500/50 bg-violet-600/[0.06]' : 'border-neutral-900'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{HORIZON_LABEL[h]}</span>
                  <span className={`text-lg font-semibold tabular ${isBest ? 'text-violet-300' : 'text-neutral-400'}`}>
                    {block.score}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">{block.reads}</p>
                {isBest && <div className="text-[10px] text-violet-400 mt-2">← best fit right now</div>}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* base rates */}
      <Panel>
        <SectionTitle>Historical base rates</SectionTitle>
        <p className="text-xs text-neutral-500 mt-1">
          Current state: <span className="text-neutral-200">{d.base_rates.current_state}</span> ·
          matched <span className="text-neutral-200">{d.base_rates.matched_days}</span> of{' '}
          {d.base_rates.history_sessions} past sessions
        </p>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm min-w-[620px]">
            <thead className="text-[10px] uppercase tracking-wider text-neutral-500">
              <tr>
                <Th>Horizon</Th><Th align="right">Closed higher</Th><Th align="right">Sample</Th>
                <Th align="right">Median move</Th><Th align="right">10th–90th</Th><Th align="right">Edge</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(d.base_rates.horizons).map(([k, v]) => <RateRow key={k} label={k} v={v} />)}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-neutral-600 mt-3 leading-relaxed border-t border-neutral-900 pt-3">
          “Edge” compares this setup against the stock's own all-days rate. Near zero means the setup
          carries no historical signal. Samples end 60 sessions before today so every matched day has
          complete forward data — no look-ahead.
        </p>
      </Panel>

      {/* technicals + risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <SectionTitle>Technicals</SectionTitle>
          <dl className="mt-3 space-y-1.5 text-xs">
            <KV k="RSI (14)" v={t.rsi14.toFixed(1)} tone={t.rsi14 > 70 ? 'neg' : t.rsi14 < 30 ? 'pos' : undefined} />
            <KV k="vs SMA20" v={`${t.vs_sma20_pct >= 0 ? '+' : ''}${t.vs_sma20_pct}%`} tone={t.vs_sma20_pct >= 0 ? 'pos' : 'neg'} />
            <KV k="vs SMA50" v={`${t.vs_sma50_pct >= 0 ? '+' : ''}${t.vs_sma50_pct}%`} tone={t.vs_sma50_pct >= 0 ? 'pos' : 'neg'} />
            <KV k="vs SMA200" v={`${t.vs_sma200_pct >= 0 ? '+' : ''}${t.vs_sma200_pct}%`} tone={t.vs_sma200_pct >= 0 ? 'pos' : 'neg'} />
            <KV k="ATR (14)" v={`₹${t.atr14} · ${t.atr_pct}% of price`} />
            <KV k="Volume vs 20d avg" v={`${t.volume_vs_20d_avg}×`} />
            <div className="pt-2 mt-2 border-t border-neutral-900" />
            {(['w1', 'm1', 'm3', 'm6', 'y1'] as const).map((p) => (
              <KV key={p}
                  k={{ w1: '1 week', m1: '1 month', m3: '3 months', m6: '6 months', y1: '1 year' }[p]}
                  v={t.returns_pct[p] != null ? `${t.returns_pct[p]! >= 0 ? '+' : ''}${t.returns_pct[p]}%` : '—'}
                  tone={t.returns_pct[p] == null ? undefined : t.returns_pct[p]! >= 0 ? 'pos' : 'neg'} />
            ))}
          </dl>
        </Panel>

        <Panel>
          <SectionTitle>Risk frame</SectionTitle>
          <dl className="mt-3 space-y-1.5 text-xs">
            <KV k="Stop — 1× ATR" v={`₹${d.risk.atr_stop_1x}`} />
            <KV k="Stop — 2× ATR" v={`₹${d.risk.atr_stop_2x}`} />
            <KV k="20-session support" v={`₹${d.risk.recent_support_20d}`} />
            <KV k="20-session resistance" v={`₹${d.risk.recent_resistance_20d}`} />
            <div className="pt-2 mt-2 border-t border-neutral-900" />
            <KV k="Upside to resistance" v={`${d.risk.upside_to_resistance_pct}%`} tone="pos" />
            <KV k="Downside to support" v={`${d.risk.downside_to_support_pct}%`} tone="neg" />
          </dl>
          <p className="text-[10px] text-neutral-600 mt-3 leading-relaxed border-t border-neutral-900 pt-3">
            {d.risk.note}
          </p>
        </Panel>
      </div>

      <details className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
        <summary className="text-sm font-medium cursor-pointer">How every number here was computed</summary>
        <dl className="mt-3 space-y-2 text-xs">
          {Object.entries(d.methodology).map(([k, v]) => (
            <div key={k}>
              <dt className="text-neutral-300 capitalize">{k.replace(/_/g, ' ')}</dt>
              <dd className="text-neutral-500 leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </details>
    </motion.div>
  )
}

function VerdictCard({ v }: { v: Verdict }) {
  const tone = v.call === 'FAVOURABLE'
    ? { ring: 'border-emerald-500/40', bg: 'bg-emerald-500/[0.06]', text: 'text-emerald-400', bar: 'bg-emerald-500' }
    : v.call === 'NEUTRAL'
    ? { ring: 'border-amber-500/40', bg: 'bg-amber-500/[0.06]', text: 'text-amber-400', bar: 'bg-amber-500' }
    : { ring: 'border-red-500/40', bg: 'bg-red-500/[0.06]', text: 'text-red-400', bar: 'bg-red-500' }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl border-2 ${tone.ring} ${tone.bg} p-5`}
    >
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">The call</div>
          <div className={`text-2xl font-semibold mt-0.5 ${tone.text}`}>{v.call}</div>
          <p className="text-sm text-neutral-200 mt-1.5 max-w-xl">{v.headline}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500">Conviction</div>
          <div className={`text-4xl font-semibold tabular ${tone.text}`}>{v.conviction}</div>
          <div className="text-[10px] text-neutral-500">out of 100</div>
        </div>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-neutral-900 overflow-hidden">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, v.conviction))}%` }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 text-xs">
        <Mini label="Horizon" value={HORIZON_LABEL[v.recommended_horizon]} />
        <Mini label="Risk : reward" value={`${v.risk_reward_ratio} : 1`} />
        <Mini label="Suggested stop" value={`₹${v.suggested_stop}`} />
      </div>

      <div className="mt-4 space-y-1.5">
        {v.reasons.map((r, i) => (
          <div key={i} className="flex gap-2 text-xs text-neutral-300">
            <span className={`mt-1.5 size-1 rounded-full shrink-0 ${tone.bar}`} />
            <span>{r}</span>
          </div>
        ))}
      </div>

      {v.what_would_change_it.length > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-800/60">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">What would change this</div>
          {v.what_would_change_it.map((w, i) => (
            <div key={i} className="text-xs text-neutral-400 leading-relaxed">• {w}</div>
          ))}
        </div>
      )}

      <details className="mt-3">
        <summary className="text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-300">
          How this call was computed
        </summary>
        <div className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            {Object.entries(v.components).map(([k, val]) => (
              <span key={k} className="tabular">
                {k.replace(/_/g, ' ')}: <span className="text-neutral-300">{val}</span>
                <span className="text-neutral-600"> ×{v.weights[k]}</span>
              </span>
            ))}
          </div>
          {v.how}
        </div>
      </details>
    </motion.div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-950/60 border border-neutral-900 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-sm font-medium tabular mt-0.5">{value}</div>
    </div>
  )
}

function RateRow({ label, v }: { label: string; v: BaseRate }) {
  const up = v.prob_up_pct
  const tone = up == null ? 'text-neutral-500' : up >= 55 ? 'text-emerald-400' : up <= 45 ? 'text-red-400' : 'text-neutral-200'
  const edge = v.edge_vs_unconditional_pp
  return (
    <tr className="border-t border-neutral-900">
      <Td>{{ '1d': '1 session', '5d': '1 week', '20d': '1 month', '60d': '3 months' }[label] ?? label}</Td>
      <Td align="right">
        <span className={`tabular font-medium ${tone}`}>{up != null ? `${up}%` : '—'}</span>
      </Td>
      <Td align="right">
        <span className="tabular">{v.sample_size}</span>
        {v.reliability === 'low' && (
          <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">thin</span>
        )}
      </Td>
      <Td align="right" className={`tabular ${(v.median_move_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {v.median_move_pct != null ? `${v.median_move_pct >= 0 ? '+' : ''}${v.median_move_pct}%` : '—'}
      </Td>
      <Td align="right" className="tabular text-neutral-500">
        {v.worst_case_pct != null ? `${v.worst_case_pct}% … +${v.best_case_pct}%` : '—'}
      </Td>
      <Td align="right" className={`tabular ${edge == null ? 'text-neutral-500' : Math.abs(edge) < 3 ? 'text-neutral-500' : edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {edge != null ? `${edge >= 0 ? '+' : ''}${edge}pp` : '—'}
      </Td>
    </tr>
  )
}

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">{children}</div>
)
const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm font-medium">{children}</div>
)
function KV({ k, v, tone }: { k: string; v: string; tone?: 'pos' | 'neg' }) {
  const c = tone === 'pos' ? 'text-emerald-400' : tone === 'neg' ? 'text-red-400' : 'text-neutral-200'
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-neutral-500">{k}</dt>
      <dd className={`tabular ${c}`}>{v}</dd>
    </div>
  )
}
function Th({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-2 py-2 font-normal text-${align}`}>{children}</th>
}
function Td({ children, align = 'left', className = '' }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return <td className={`px-2 py-2.5 text-${align} ${className}`}>{children}</td>
}

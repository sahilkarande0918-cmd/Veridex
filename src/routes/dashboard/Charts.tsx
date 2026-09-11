import { useEffect, useState } from 'react'
import { defaultInstruments, type Instrument } from '@/lib/instruments'
import { fetchCandles, fetchQuote, type Candle, type Interval } from '@/lib/upstox'
import CandleChart from '@/components/CandleChart'
import SymbolSearch from '@/components/SymbolSearch'

const INTERVALS: Interval[] = ['30minute', 'day', 'week', 'month']

export default function Charts() {
  const [pick, setPick] = useState<Instrument | null>(null)
  const [interval, setInterval_] = useState<Interval>('day')
  const [candles, setCandles] = useState<Candle[]>([])
  const [price, setPrice] = useState<number | null>(null)
  const [prevClose, setPrevClose] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // seed with the most actively traded name
  useEffect(() => {
    defaultInstruments(1).then((r) => r[0] && setPick(r[0])).catch(() => {})
  }, [])

  // history
  useEffect(() => {
    if (!pick) return
    let alive = true
    setErr(null); setCandles([])
    fetchCandles(pick.key, interval, interval === 'day' ? 180 : interval === 'week' ? 730 : 30)
      .then((r) => {
        if (!alive) return
        setCandles(r.candles)
        const last = r.candles.at(-1)
        const prev = r.candles.at(-2)
        setPrevClose(prev?.close ?? null)
        setPrice(last?.close ?? null)
      })
      .catch((e) => alive && setErr(String(e.message ?? e)))
    return () => { alive = false }
  }, [pick?.key, interval])

  // live quote poll (5s)
  useEffect(() => {
    if (!pick) return
    let alive = true
    const tick = () =>
      fetchQuote(pick.key)
        .then((r) => alive && r.price != null && setPrice(r.price))
        .catch(() => {})
    tick()
    const id = window.setInterval(tick, 5_000)
    return () => { alive = false; window.clearInterval(id) }
  }, [pick?.key])

  const change = price != null && prevClose != null ? price - prevClose : null
  const changePct = change != null && prevClose ? (change / prevClose) * 100 : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Charts</h1>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Live · Upstox
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* symbol picker — full NSE universe */}
        <aside className="rounded-xl border border-neutral-900 bg-neutral-950 overflow-hidden h-[44vh] lg:h-[70vh]">
          <SymbolSearch value={pick} onPick={setPick} />
        </aside>

        {/* chart */}
        <section className="rounded-xl border border-neutral-900 bg-neutral-950 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 border-b border-neutral-900">
            <div>
              <div className="text-sm text-neutral-400">{pick?.name ?? 'Loading…'}</div>
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold tabular">
                  {price != null ? `₹${price.toFixed(2)}` : '—'}
                </span>
                {change != null && changePct != null && (
                  <span className={`text-sm tabular ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct.toFixed(2)}%)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1 p-1 rounded-md bg-neutral-900 border border-neutral-800">
              {INTERVALS.map((iv) => (
                <button
                  key={iv} onClick={() => setInterval_(iv)}
                  className={`px-3 h-7 rounded text-xs transition ${
                    interval === iv ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-100'
                  }`}
                >
                  {iv === '30minute' ? '30m' : iv === 'day' ? '1D' : iv === 'week' ? '1W' : '1M'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] sm:h-[420px] relative">
            {err && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-2">
                  <div className="text-sm text-red-400">Couldn't load candles</div>
                  <div className="text-xs text-neutral-500 break-all">{err}</div>
                  <div className="text-xs text-neutral-600">
                    Deploy the Edge Functions: <code className="text-neutral-400">supabase functions deploy upstox-quote upstox-candles</code>,
                    then set the <code className="text-neutral-400">UPSTOX_ACCESS_TOKEN</code> secret.
                  </div>
                </div>
              </div>
            )}
            {!err && candles.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
                Loading…
              </div>
            )}
            {candles.length > 0 && <CandleChart candles={candles} />}
          </div>
        </section>
      </div>
    </div>
  )
}

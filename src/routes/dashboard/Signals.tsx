import { useEffect, useMemo, useState } from 'react'
import { INSTRUMENTS, type Instrument } from '@/lib/instruments'
import { fetchCandles, type Candle } from '@/lib/upstox'
import { analyze, type AnomalyReport } from '@/lib/anomaly'
import { fetchSentiment, type SentimentReport } from '@/lib/sentiment'
import { relTime } from '@/lib/news'
import Disclaimer from '@/components/Disclaimer'

export default function Signals() {
  const [pick, setPick] = useState<Instrument>(INSTRUMENTS[0])
  const [q, setQ] = useState('')
  const [candles, setCandles] = useState<Candle[]>([])
  const [anomaly, setAnomaly] = useState<AnomalyReport | null>(null)
  const [sentiment, setSentiment] = useState<SentimentReport | null>(null)
  const [errC, setErrC] = useState<string | null>(null)
  const [errS, setErrS] = useState<string | null>(null)
  const [busyS, setBusyS] = useState(false)

  const results = useMemo(() => {
    if (!q.trim()) return INSTRUMENTS
    const needle = q.trim().toLowerCase()
    return INSTRUMENTS.filter((i) =>
      i.symbol.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle),
    )
  }, [q])

  // Candles + anomaly whenever the pick changes
  useEffect(() => {
    let alive = true
    setErrC(null); setCandles([]); setAnomaly(null)
    fetchCandles(pick.key, 'day', 45)
      .then((r) => {
        if (!alive) return
        setCandles(r.candles)
        setAnomaly(analyze(r.candles, 20))
      })
      .catch((e) => alive && setErrC(e instanceof Error ? e.message : String(e)))
    return () => { alive = false }
  }, [pick.key])

  // Sentiment on demand (Groq calls aren't free of latency; don't auto-fire)
  const loadSentiment = async () => {
    setBusyS(true); setErrS(null)
    try {
      const r = await fetchSentiment(pick.symbol)
      setSentiment(r)
    } catch (e) {
      setErrS(e instanceof Error ? e.message : String(e))
    } finally { setBusyS(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Signals</h1>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800">
          Historical patterns
        </span>
      </div>
      <p className="text-sm text-neutral-500 -mt-2">
        Volume/price anomalies from 20-day statistics, and headline-tone counts from Groq (Llama 3.3).
        <span className="text-neutral-600"> Signals describe recent behavior — they do not predict future prices.</span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* symbol picker */}
        <aside className="rounded-xl border border-neutral-900 bg-neutral-950 flex flex-col overflow-hidden max-h-[70vh]">
          <div className="p-3 border-b border-neutral-900">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search RELIANCE, TCS…"
              className="w-full h-9 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-xs outline-none focus:border-violet-600"
            />
          </div>
          <ul className="overflow-y-auto flex-1">
            {results.map((i) => (
              <li key={i.key}>
                <button
                  onClick={() => setPick(i)}
                  className={`w-full text-left px-3 py-2 border-b border-neutral-900 hover:bg-neutral-900/60 transition ${
                    pick.key === i.key ? 'bg-violet-600/10' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{i.symbol}</div>
                  <div className="text-[11px] text-neutral-500 truncate">{i.name}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-4">
          {/* Anomaly card */}
          <section className="rounded-xl border border-neutral-900 bg-neutral-950 p-5 space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Volume / price anomaly</div>
                <div className="text-[11px] text-neutral-500">20-day z-score · |z| ≥ 2 flagged</div>
              </div>
              <span className="text-xs text-neutral-500">{pick.symbol}</span>
            </header>

            {errC && <div className="text-xs text-red-400">{errC}</div>}
            {!errC && candles.length === 0 && <div className="text-xs text-neutral-500">Loading candles…</div>}
            {anomaly && (
              <div className="grid grid-cols-2 gap-3">
                <ZCard
                  label="Volume z-score"
                  z={anomaly.volume.z}
                  flag={anomaly.volume.flag}
                  detail={`Latest ${fmt(anomaly.volume.latest)} vs mean ${fmt(anomaly.volume.mean)} (σ ${fmt(anomaly.volume.std)})`}
                />
                <ZCard
                  label="Price move z-score"
                  z={anomaly.price.z}
                  flag={anomaly.price.flag}
                  detail={`Latest ret ${(anomaly.price.ret * 100).toFixed(2)}% · mean ${(anomaly.price.mean_ret * 100).toFixed(2)}% · σ ${(anomaly.price.std_ret * 100).toFixed(2)}%`}
                />
              </div>
            )}
            <div className="text-[10px] text-neutral-600 border-t border-neutral-900 pt-3">
              Method: today's volume/return standardized against the trailing 20 daily observations
              (today excluded from the reference window). No forecasting — descriptive only.
            </div>
          </section>

          {/* Sentiment card */}
          <section className="rounded-xl border border-neutral-900 bg-neutral-950 p-5 space-y-4">
            <header className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Recent headline tone</div>
                <div className="text-[11px] text-neutral-500">
                  Groq · Llama 3.3 70B · <span className="text-amber-400">AI-generated</span>
                </div>
              </div>
              <button
                onClick={loadSentiment} disabled={busyS}
                className="h-8 px-3 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-xs font-medium"
              >
                {busyS ? 'Classifying…' : sentiment ? 'Re-run' : 'Analyze'}
              </button>
            </header>

            {errS && <div className="text-xs text-red-400">{errS}</div>}
            {sentiment && sentiment.labeled.length === 0 && (
              <div className="text-xs text-neutral-500">{sentiment.note ?? 'No recent headlines.'}</div>
            )}
            {sentiment && sentiment.labeled.length > 0 && (
              <>
                <div className="flex gap-2 text-xs">
                  <Badge tone="pos">{sentiment.counts.positive} positive</Badge>
                  <Badge tone="neu">{sentiment.counts.neutral} neutral</Badge>
                  <Badge tone="neg">{sentiment.counts.negative} negative</Badge>
                </div>
                <ul className="space-y-2">
                  {sentiment.labeled.map((h, i) => (
                    <li key={`${h.link}-${i}`} className="rounded-md border border-neutral-900 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                        <span className="text-violet-400">{h.source}</span> · <span>{relTime(h.published_at)}</span>
                        <span className="ml-auto"><LabelPill label={h.label} /></span>
                      </div>
                      <a href={h.link} target="_blank" rel="noopener noreferrer" className="block text-sm hover:text-violet-300">
                        {h.title}
                      </a>
                      {h.why && <div className="text-neutral-500 italic">"{h.why}"</div>}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="text-[10px] text-neutral-600 border-t border-neutral-900 pt-3">
              Method: NewsData.io returns up to 10 recent India-business headlines matching the ticker.
              Groq classifies each as positive/negative/neutral based only on the headline text.
              Rationale strings are the model's — verify against the linked article before acting.
            </div>
          </section>

          <Disclaimer ai />
        </div>
      </div>
    </div>
  )
}

function ZCard({ label, z, flag, detail }: { label: string; z: number | null; flag: boolean; detail: string }) {
  const tone = flag ? 'border-amber-500/30 bg-amber-500/5 text-amber-300'
    : z == null ? 'border-neutral-800 text-neutral-500'
    : 'border-neutral-800 text-neutral-100'
  return (
    <div className={`rounded-md border p-3 ${tone}`}>
      <div className="text-[11px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-2xl font-semibold tabular mt-1">{z == null ? '—' : z.toFixed(2)}</div>
      <div className="text-[10px] mt-1 opacity-70 leading-relaxed tabular">{detail}</div>
      {flag && <div className="text-[10px] mt-2 font-medium">↑ flagged (|z| ≥ 2)</div>}
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'pos' | 'neu' | 'neg' }) {
  const cls = tone === 'pos' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : tone === 'neg' ? 'bg-red-500/10 text-red-300 border-red-500/20'
    : 'bg-neutral-800/40 text-neutral-300 border-neutral-800'
  return <span className={`px-2 py-0.5 rounded border ${cls}`}>{children}</span>
}
function LabelPill({ label }: { label: 'positive' | 'neutral' | 'negative' }) {
  const cls = label === 'positive' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : label === 'negative' ? 'bg-red-500/10 text-red-300 border-red-500/20'
    : 'bg-neutral-800/40 text-neutral-400 border-neutral-800'
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
}
function fmt(n: number) {
  if (n >= 1e7) return (n / 1e7).toFixed(2) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(2) + ' L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}

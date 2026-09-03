import Onboarding from '@/components/Onboarding'

const stubs: { title: string; body: string; phase: string }[] = [
  { title: 'Portfolio',   body: 'Manual entry, live P&L, allocation pie.',     phase: 'Phase 4' },
  { title: 'Live charts', body: 'Candlesticks via Upstox, 5-sec polling.',      phase: 'Phase 3' },
  { title: 'Screener',    body: 'Fundamentals ranking, capital-aware filter.',  phase: 'Phase 5' },
  { title: 'News + IPO',  body: 'RSS feed + company search + IPO tag view.',    phase: 'Phase 6' },
  { title: 'Signals',     body: 'Sentiment + anomaly detector, methodology in.', phase: 'Phase 7' },
  { title: 'Grounded AI', body: 'Chat that fetches live data before answering.', phase: 'Phase 8' },
]

export default function Overview() {
  return (
    <>
      <Onboarding />
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-neutral-400 mt-1">Auth is online. Data + analysis features roll in over the next phases.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {stubs.map((s) => (
            <div key={s.title} className="rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{s.title}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800">
                  {s.phase}
                </span>
              </div>
              <div className="text-xs text-neutral-500">{s.body}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

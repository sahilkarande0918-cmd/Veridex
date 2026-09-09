// Debounced search over the full NSE universe (~2,900 equities).
// Used by Charts, Signals, Analyze and the add-position modal.

import { useEffect, useMemo, useRef, useState } from 'react'
import { searchInstruments, type Instrument } from '@/lib/instruments'

export default function SymbolSearch({
  value, onPick, placeholder = 'Search any NSE stock — RELIANCE, IRFC, Suzlon…',
  autoFocus = false, maxHeight = '60vh',
}: {
  value?: Instrument | null
  onPick: (i: Instrument) => void
  placeholder?: string
  autoFocus?: boolean
  maxHeight?: string
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Instrument[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setBusy(true)
    const t = setTimeout(() => {
      searchInstruments(q, 25)
        .then((r) => { if (id === reqId.current) { setResults(r); setErr(null) } })
        .catch((e) => { if (id === reqId.current) setErr(e instanceof Error ? e.message : String(e)) })
        .finally(() => { if (id === reqId.current) setBusy(false) })
    }, q ? 220 : 0)
    return () => clearTimeout(t)
  }, [q])

  const heading = useMemo(() => (q.trim() ? 'Results' : 'Most active today'), [q])

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b border-neutral-900">
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-xs outline-none focus:border-violet-600"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">{heading}</span>
          {busy && <span className="text-[10px] text-neutral-500">searching…</span>}
        </div>
      </div>

      <ul className="overflow-y-auto flex-1" style={{ maxHeight }}>
        {err && <li className="p-4 text-xs text-red-400">{err}</li>}
        {!err && !busy && results.length === 0 && (
          <li className="p-4 text-xs text-neutral-500">
            No match for “{q}”. Try the NSE ticker (e.g. <span className="text-neutral-300">TATAMOTORS</span>) or company name.
          </li>
        )}
        {results.map((i) => (
          <li key={i.key}>
            <button
              onClick={() => onPick(i)}
              className={`w-full text-left px-3 py-2 border-b border-neutral-900 hover:bg-neutral-900/60 transition ${
                value?.key === i.key ? 'bg-violet-600/10' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{i.symbol}</span>
                {i.last_price != null && (
                  <span className="text-xs tabular shrink-0">
                    ₹{i.last_price.toFixed(2)}
                    {i.pct_change != null && (
                      <span className={i.pct_change >= 0 ? ' text-emerald-400' : ' text-red-400'}>
                        {' '}{i.pct_change >= 0 ? '+' : ''}{i.pct_change.toFixed(2)}%
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-neutral-500 truncate">{i.name}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

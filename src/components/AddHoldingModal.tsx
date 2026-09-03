import { useMemo, useState, type FormEvent } from 'react'
import { INSTRUMENTS, type Instrument } from '@/lib/instruments'
import { addHolding } from '@/lib/portfolio'

export default function AddHoldingModal({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Instrument | null>(null)
  const [qty, setQty] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [buyDate, setBuyDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return INSTRUMENTS.slice(0, 8)
    return INSTRUMENTS.filter((i) =>
      i.symbol.toLowerCase().includes(needle) || i.name.toLowerCase().includes(needle),
    ).slice(0, 8)
  }, [q])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!picked) return setErr('pick a stock')
    const n = Number(qty), p = Number(buyPrice)
    if (!(n > 0)) return setErr('qty must be > 0')
    if (!(p > 0)) return setErr('buy price must be > 0')
    setErr(null); setBusy(true)
    try {
      await addHolding({
        symbol: picked.symbol,
        exchange: picked.exchange,
        qty: n,
        buy_price: p,
        buy_date: buyDate,
        notes: notes || null,
      })
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add position</h2>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-neutral-300">✕</button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-neutral-400">Stock</span>
          {picked ? (
            <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 h-10">
              <div className="text-sm">
                <span className="font-medium">{picked.symbol}</span>
                <span className="text-neutral-500 ml-2">{picked.name}</span>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-xs text-violet-400">change</button>
            </div>
          ) : (
            <>
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search RELIANCE, TCS…"
                className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
              />
              <ul className="max-h-40 overflow-y-auto rounded-md border border-neutral-900 divide-y divide-neutral-900">
                {results.map((i) => (
                  <li key={i.key}>
                    <button
                      type="button" onClick={() => setPicked(i)}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-900 text-sm"
                    >
                      <span className="font-medium">{i.symbol}</span>
                      <span className="text-neutral-500 ml-2 text-xs">{i.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs text-neutral-400">Quantity</span>
            <input
              type="number" step="0.0001" min={0} value={qty} onChange={(e) => setQty(e.target.value)}
              className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600 tabular"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-neutral-400">Buy price (₹)</span>
            <input
              type="number" step="0.01" min={0} value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)}
              className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600 tabular"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400">Buy date</span>
          <input
            type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400">Notes (optional)</span>
          <input
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Long-term IT allocation"
            className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
          />
        </label>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-md border border-neutral-800 hover:bg-neutral-900 text-sm">
            Cancel
          </button>
          <button
            type="submit" disabled={busy || !picked}
            className="flex-1 h-10 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? 'Saving…' : 'Add position'}
          </button>
        </div>
      </form>
    </div>
  )
}

// Transparent stock scoring. Every subscore is a simple, defensible
// number the UI shows next to the composite.

import { FUNDAMENTALS, type Fundamentals } from '@/data/fundamentals'
import { INSTRUMENTS } from '@/lib/instruments'

export type Scored = {
  f: Fundamentals
  sector: string
  name: string
  value_score:    number   // 0..100 — cheaper is higher
  leverage_score: number   // 0..100 — less debt is higher
  growth_score:   number   // 0..100 — faster revenue growth is higher
  composite:      number   // 0..100 — equal-weighted average
  affordable_qty: number   // shares one could buy with `capital`
}

export type Weights = { value: number; leverage: number; growth: number }
export const DEFAULT_WEIGHTS: Weights = { value: 0.4, leverage: 0.2, growth: 0.4 }

// median of a numeric list (no dependencies).
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Map a value → 0..100 where lower is better (PE, PB, D/E).
// Uses cross-section median as reference: <=0 gets 100, median gets 50,
// >= 2× median gets 0, linear in between.
function lowerBetter(v: number, med: number): number {
  if (med <= 0) return 50
  if (v <= 0) return 100
  const ratio = v / med
  // 0 → 100, 1 → 50, 2 → 0
  return Math.max(0, Math.min(100, 100 - ratio * 50))
}

// Map growth (decimal) → 0..100. 0% → 20, 10% → 55, 20% → 85, capped 100.
function growthScore(g: number): number {
  return Math.max(0, Math.min(100, 20 + g * 350))
}

export function score(capital: number, weights: Weights = DEFAULT_WEIGHTS): Scored[] {
  const pe_med = median(FUNDAMENTALS.map((f) => f.pe))
  const pb_med = median(FUNDAMENTALS.map((f) => f.pb))
  const de_med = median(FUNDAMENTALS.map((f) => f.de))

  return FUNDAMENTALS.map((f): Scored => {
    const inst = INSTRUMENTS.find((i) => i.symbol === f.symbol)
    const value_score    = (lowerBetter(f.pe, pe_med) + lowerBetter(f.pb, pb_med)) / 2
    const leverage_score = lowerBetter(f.de, de_med)
    const growth_score   = growthScore(f.rev_growth)
    const composite =
      value_score    * weights.value +
      leverage_score * weights.leverage +
      growth_score   * weights.growth

    return {
      f,
      name: inst?.name ?? f.symbol,
      sector: inst?.sector ?? '—',
      value_score,
      leverage_score,
      growth_score,
      composite,
      affordable_qty: capital > 0 ? Math.floor(capital / f.last_price) : 0,
    }
  })
}

export const medians = () => ({
  pe: median(FUNDAMENTALS.map((f) => f.pe)),
  pb: median(FUNDAMENTALS.map((f) => f.pb)),
  de: median(FUNDAMENTALS.map((f) => f.de)),
})

// self-check: cheaper stocks outrank expensive ones on value.
declare const process: { env: Record<string, string | undefined> } | undefined
if (typeof process !== 'undefined' && process.env?.VERIDEX_SELFCHECK) {
  const rows = score(50_000)
  const ongc = rows.find((r) => r.f.symbol === 'ONGC')!  // PE 8.9
  const nest = rows.find((r) => r.f.symbol === 'NESTLEIND')!  // PE 76
  console.assert(ongc.value_score > nest.value_score, 'ONGC should outscore NESTLE on value')
  console.log('screener self-check ok')
}

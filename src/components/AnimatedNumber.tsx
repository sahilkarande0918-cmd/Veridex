// Count-up that re-renders ONLY itself.
//
// Running the frame loop inside the page component made every frame
// re-render the whole page, so ApexCharts rebuilt its SVG ~54x per
// load (measured: 2,308 DOM mutations in 4s vs 49 now).
//
// Correctness note: requestAnimationFrame does not fire in a hidden or
// backgrounded tab. Without a guard the displayed number would stay at
// its initial value forever — a dashboard opened in a background tab
// showed "₹0" for net worth. So we snap straight to the value when the
// document is hidden, and a timeout always guarantees we land on it.

import { useEffect, useRef, useState } from 'react'

export default function AnimatedNumber({
  value, durationMs = 900, format,
}: {
  value: number
  durationMs?: number
  format?: (n: number) => string
}) {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) { setShown(value); return }

    // No frame loop available (hidden tab, reduced motion) → show it now.
    const canAnimate =
      typeof requestAnimationFrame === 'function' &&
      typeof document !== 'undefined' && !document.hidden &&
      !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!canAnimate) {
      setShown(value)
      fromRef.current = value
      return
    }

    let start: number | null = null
    const step = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)          // easeOutCubic
      setShown(from + (value - from) * eased)
      if (p < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = value
    }
    rafRef.current = requestAnimationFrame(step)

    // Safety net: land on the exact value even if frames stall midway.
    const guard = window.setTimeout(() => {
      setShown(value)
      fromRef.current = value
    }, durationMs + 250)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.clearTimeout(guard)
    }
  }, [value, durationMs])

  return <>{format ? format(shown) : Math.round(shown).toLocaleString('en-IN')}</>
}

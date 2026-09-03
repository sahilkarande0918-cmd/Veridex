import { useEffect, useRef, useState } from 'react'

// Animated number ramp. Uses requestAnimationFrame; ease-out for a natural feel.
export function useCountUp(target: number, durationMs = 800): number {
  const [n, setN] = useState(target)
  const from = useRef(target)
  const start = useRef<number | null>(null)

  useEffect(() => {
    from.current = n
    start.current = null
    let raf = 0
    const step = (t: number) => {
      if (start.current == null) start.current = t
      const p = Math.min(1, (t - start.current) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic
      setN(from.current + (target - from.current) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  return n
}

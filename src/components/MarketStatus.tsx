import { useEffect, useState } from 'react'
import { nseStatus } from '@/lib/marketStatus'

export default function MarketStatus() {
  const [s, setS] = useState(() => nseStatus())
  useEffect(() => {
    const id = setInterval(() => setS(nseStatus()), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-neutral-500 tabular">{s.dateLabel}</span>
      <span className="flex items-center gap-1.5">
        <span className={`size-1.5 rounded-full ${s.open ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-600'}`} />
        <span className={s.open ? 'text-emerald-400' : 'text-neutral-500'}>{s.label}</span>
      </span>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Profile = {
  capital_available: number | null
  risk_tolerance: 'low' | 'medium' | 'high' | null
  goal_horizon: 'short' | 'medium' | 'long' | null
  onboarded_at: string | null
}

export default function Onboarding() {
  const { user } = useAuth()
  const [needs, setNeeds] = useState<boolean | null>(null)
  const [capital, setCapital] = useState('')
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [horizon, setHorizon] = useState<'short' | 'medium' | 'long'>('medium')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('capital_available, risk_tolerance, goal_horizon, onboarded_at')
      .eq('id', user.id)
      .maybeSingle<Profile>()
      .then(({ data }) => setNeeds(!data?.onboarded_at))
  }, [user])

  if (!user || needs !== true) return null

  const save = async () => {
    setBusy(true)
    await supabase.from('profiles').update({
      capital_available: Number(capital) || null,
      risk_tolerance: risk,
      goal_horizon: horizon,
      onboarded_at: new Date().toISOString(),
    }).eq('id', user.id)
    setBusy(false)
    setNeeds(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6 space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Welcome to Veridex</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Three quick answers so the screener knows what to filter for.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs text-neutral-400">Capital available (₹)</span>
          <input
            type="number" min={0} value={capital} onChange={(e) => setCapital(e.target.value)}
            placeholder="50000"
            className="w-full h-10 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600 tabular"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-xs text-neutral-400">Risk tolerance</span>
          <SegmentedControl
            value={risk}
            onChange={(v) => setRisk(v as 'low' | 'medium' | 'high')}
            options={[
              { v: 'low',    label: 'Low' },
              { v: 'medium', label: 'Medium' },
              { v: 'high',   label: 'High' },
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-neutral-400">Goal horizon</span>
          <SegmentedControl
            value={horizon}
            onChange={(v) => setHorizon(v as 'short' | 'medium' | 'long')}
            options={[
              { v: 'short',  label: '< 1 yr' },
              { v: 'medium', label: '1–3 yr' },
              { v: 'long',   label: '3+ yr' },
            ]}
          />
        </div>

        <button
          onClick={save} disabled={busy}
          className="w-full h-11 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium transition"
        >
          {busy ? 'Saving…' : 'Continue to dashboard'}
        </button>
      </div>
    </div>
  )
}

function SegmentedControl({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string }[]
}) {
  return (
    <div className="grid grid-cols-3 gap-1 p-1 rounded-md bg-neutral-900 border border-neutral-800">
      {options.map((o) => (
        <button
          key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`h-8 rounded text-xs transition ${
            value === o.v ? 'bg-violet-600 text-white' : 'text-neutral-400 hover:text-neutral-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

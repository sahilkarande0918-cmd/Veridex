import { useState, type FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import AuthBackdrop from '@/components/AuthBackdrop'

export default function Login() {
  const { user, loading, signInEmail, signUpEmail, signInGoogle } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setBusy(true)
    const { error } = mode === 'signin'
      ? await signInEmail(email, password)
      : await signUpEmail(email, password)
    setBusy(false)
    if (error) setError(error)
    else nav('/dashboard')
  }

  const google = async () => {
    setError(null)
    const { error } = await signInGoogle()
    if (error) setError(error)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 relative">
      <AuthBackdrop />
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Veridex</h1>
          <p className="text-sm text-neutral-400">
            {mode === 'signin' ? 'Sign in to your dashboard' : 'Create your account'}
          </p>
        </div>

        <button
          onClick={google}
          className="w-full h-11 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800/60 text-sm font-medium transition flex items-center justify-center gap-2"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-900" /></div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-neutral-950 px-2 text-neutral-500">or</span>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com" autoComplete="email"
            className="w-full h-11 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
          />
          <input
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            className="w-full h-11 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full h-11 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium transition"
          >
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-500">
          {mode === 'signin' ? "No account?" : 'Already registered?'}{' '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-violet-400 hover:text-violet-300"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

        <p className="text-[10px] leading-relaxed text-center text-neutral-600 pt-4 border-t border-neutral-900">
          Not SEBI-registered investment advice. Educational/analytical tool only.
          Investments in securities are subject to market risk.
        </p>
      </div>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.87l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
    </svg>
  )
}

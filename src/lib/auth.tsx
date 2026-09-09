import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { cached, invalidate } from './cache'

type AuthCtx = {
  user: User | null
  session: Session | null
  loading: boolean
  signInEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signInEmail: AuthCtx['signInEmail'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }
  const signUpEmail: AuthCtx['signUpEmail'] = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }
  const signInGoogle: AuthCtx['signInGoogle'] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    return { error: error?.message ?? null }
  }
  const signOut = async () => { await supabase.auth.signOut() }

  const value: AuthCtx = {
    user: session?.user ?? null,
    session,
    loading,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>')
  return v
}

/** Shared profile row read. AlertsBell, Onboarding and Profile all want
 *  the same row on mount; without this they each fired their own query. */
export function fetchProfileRow<T = Record<string, unknown>>(userId: string, columns: string): Promise<T | null> {
  return cached(`profile:${userId}:${columns}`, 30_000, async () => {
    const { data } = await supabase.from('profiles').select(columns).eq('id', userId).maybeSingle()
    return (data ?? null) as T | null
  })
}

export function invalidateProfile(userId: string) { invalidate(`profile:${userId}`) }

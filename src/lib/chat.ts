import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export type ChatMsg = { role: 'user' | 'assistant'; content: string }

export type ChatResponse = {
  reply: string
  resolved_symbol?: string | null
  analysis?: unknown
  screen?: unknown
  grounded_on: Record<string, boolean>
  fetched_at: string
}

export async function sendChat(message: string, history: ChatMsg[]): Promise<ChatResponse> {
  const url = `${SUPABASE_URL}/functions/v1/chat`
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${session?.access_token ?? ANON}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ message, history }),
  })
  if (!res.ok) throw new Error(`chat failed: ${res.status} ${await res.text()}`)
  return res.json()
}

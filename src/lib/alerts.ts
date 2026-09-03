import { supabase } from './supabase'

export type Alert = {
  id: string
  user_id: string
  type: string
  symbol: string | null
  title: string
  message: string | null
  sent_at: string
  read_at: string | null
}

export async function listAlerts(unreadOnly = false): Promise<Alert[]> {
  let q = supabase.from('alerts').select('*').order('sent_at', { ascending: false }).limit(50)
  if (unreadOnly) q = q.is('read_at', null)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Alert[]
}

export async function markAllRead() {
  const { error } = await supabase.from('alerts').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (error) throw error
}

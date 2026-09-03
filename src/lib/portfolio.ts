import { supabase } from './supabase'

export type Holding = {
  id: string
  user_id: string
  symbol: string
  exchange: string
  qty: number
  buy_price: number
  buy_date: string
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewHolding = Pick<Holding, 'symbol' | 'exchange' | 'qty' | 'buy_price' | 'buy_date'> & {
  notes?: string | null
}

export async function listHoldings() {
  const { data, error } = await supabase
    .from('holdings')
    .select('*')
    .order('buy_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as Holding[]
}

export async function addHolding(h: NewHolding) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('not signed in')
  const { data, error } = await supabase
    .from('holdings')
    .insert({ ...h, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data as Holding
}

export async function deleteHolding(id: string) {
  const { error } = await supabase.from('holdings').delete().eq('id', id)
  if (error) throw error
}

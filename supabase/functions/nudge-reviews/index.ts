// Position-review nudger.
//
// Finds holdings older than 30 days that haven't been nudged yet,
// writes an alert row for each (idempotent via dedupe_key), and pushes
// via FCM to users who enabled it.
//
// Run manually or via pg_cron; POST/GET both work. Uses the Supabase
// service-role key to bypass RLS for the batch scan.

import { corsHeaders } from '../_shared/cors.ts'
import { fcmSend } from '../_shared/fcm.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

const NUDGE_DAYS = 30

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!SUPABASE_URL || !SR) return json({ error: 'supabase env unset' }, 500)

  // 1) Fetch old holdings + their user's push_token.
  const cutoff = new Date(Date.now() - NUDGE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const holdingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/holdings?select=id,user_id,symbol,buy_date,qty,buy_price&buy_date=lte.${cutoff}`,
    { headers: { apikey: SR, Authorization: `Bearer ${SR}` } },
  )
  if (!holdingsRes.ok) return json({ error: 'holdings fetch', detail: await holdingsRes.text() }, 500)
  type Holding = { id: string; user_id: string; symbol: string; buy_date: string; qty: number; buy_price: number }
  const holdings: Holding[] = await holdingsRes.json()
  if (holdings.length === 0) return json({ inserted: 0, pushed: 0, checked: 0 })

  // 2) Insert one alert per holding, dedupe_key = review:<holding_id>
  const rows = holdings.map((h) => {
    const days = Math.floor((Date.now() - +new Date(h.buy_date)) / (24 * 60 * 60 * 1000))
    return {
      user_id: h.user_id,
      type: 'review',
      symbol: h.symbol,
      title: `Review your ${h.symbol} position`,
      message: `You've held ${h.qty} share(s) of ${h.symbol} since ${h.buy_date} (${days} days). Worth a fundamentals + signal check.`,
      dedupe_key: `review:${h.id}`,
    }
  })

  const insRes = await fetch(`${SUPABASE_URL}/rest/v1/alerts?on_conflict=user_id,dedupe_key`, {
    method: 'POST',
    headers: {
      apikey: SR, Authorization: `Bearer ${SR}`,
      'content-type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  })
  const inserted: { user_id: string; symbol: string; title: string; message: string }[] =
    insRes.ok ? await insRes.json() : []

  // 3) Push newly-inserted alerts to users with a push_token.
  const userIds = Array.from(new Set(inserted.map((r) => r.user_id)))
  let pushed = 0
  if (userIds.length > 0) {
    const tokRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,push_token&id=in.(${userIds.join(',')})&push_token=not.is.null`,
      { headers: { apikey: SR, Authorization: `Bearer ${SR}` } },
    )
    type Prof = { id: string; push_token: string }
    const profiles: Prof[] = tokRes.ok ? await tokRes.json() : []
    const tokenBy: Record<string, string> = Object.fromEntries(profiles.map((p) => [p.id, p.push_token]))
    await Promise.allSettled(
      inserted.map(async (r) => {
        const token = tokenBy[r.user_id]
        if (!token) return
        await fcmSend({
          token,
          title: r.title,
          body:  r.message,
          url:   `/dashboard/signals`,
        })
        pushed++
      }),
    )
  }

  return json({ checked: holdings.length, inserted: inserted.length, pushed })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

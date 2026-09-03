// Company/ticker news search via NewsData.io.
//
// GET  ?q=RELIANCE
// Env: NEWSAPI_KEY  (the NewsData.io API key — starts with `pub_`)

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const key = Deno.env.get('NEWSAPI_KEY')
  if (!key) return json({ error: 'NEWSAPI_KEY unset' }, 500)

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q) return json({ error: 'missing ?q=<query>' }, 400)

  const nd = `https://newsdata.io/api/1/latest?apikey=${key}&q=${encodeURIComponent(q)}&country=in&language=en&category=business`
  const res = await fetch(nd)
  const body = await res.json()
  if (!res.ok || body?.status === 'error') return json({ error: 'newsdata error', detail: body }, res.status || 502)

  type Raw = { title: string; link: string; source_id?: string; source_name?: string; pubDate?: string; description?: string; image_url?: string }
  const items = (body.results ?? []).map((r: Raw) => ({
    title: r.title,
    link:  r.link,
    source: r.source_name ?? r.source_id ?? 'unknown',
    published_at: r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString(),
    summary: (r.description ?? '').slice(0, 240),
    image:  r.image_url ?? null,
  }))

  return json({ q, items, fetched_at: new Date().toISOString() })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

// Sentiment classifier for recent headlines about a stock.
//
// GET  ?q=RELIANCE
// Env: NEWSAPI_KEY, GROQ_API_KEY
//
// Pipeline:
//   1. Search NewsData.io for `q` (business, India, English)
//   2. Send the top 10 headlines to Groq (Llama-3.3-70b) with a
//      structured JSON output schema: [{i, label, why}].
//   3. Aggregate label counts. Return counts + labeled headlines.
//
// The LLM is told to answer ONLY from headlines given (grounded).

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

type Label = 'positive' | 'negative' | 'neutral'
type Item = { title: string; link: string; source: string; published_at: string; summary?: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const NEWSAPI = Deno.env.get('NEWSAPI_KEY')
  const GROQ    = Deno.env.get('GROQ_API_KEY')
  if (!NEWSAPI) return json({ error: 'NEWSAPI_KEY unset' }, 500)
  if (!GROQ)    return json({ error: 'GROQ_API_KEY unset' }, 500)

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q) return json({ error: 'missing ?q=<symbol or name>' }, 400)

  // 1) headlines
  const nd = `https://newsdata.io/api/1/latest?apikey=${NEWSAPI}&q=${encodeURIComponent(q)}&country=in&language=en&category=business`
  const ndRes = await fetch(nd)
  const ndBody = await ndRes.json()
  if (!ndRes.ok || ndBody?.status === 'error') return json({ error: 'newsdata error', detail: ndBody }, 502)

  type Raw = { title: string; link: string; source_name?: string; source_id?: string; pubDate?: string; description?: string }
  const items: Item[] = (ndBody.results ?? []).slice(0, 10).map((r: Raw) => ({
    title: r.title,
    link:  r.link,
    source: r.source_name ?? r.source_id ?? 'unknown',
    published_at: r.pubDate ? new Date(r.pubDate).toISOString() : new Date().toISOString(),
    summary: (r.description ?? '').slice(0, 220),
  }))

  if (items.length === 0) {
    return json({ q, items: [], counts: { positive: 0, neutral: 0, negative: 0 }, labeled: [], note: 'no recent headlines found' })
  }

  // 2) classify via Groq structured output
  const prompt = [
    { role: 'system' as const, content:
      'You are a financial-news sentiment classifier. You classify each headline ' +
      'strictly by the tone toward the company/subject: "positive" (good for shareholders), ' +
      '"negative" (bad for shareholders), or "neutral" (informational, no directional tone).\n\n' +
      'Rules:\n' +
      '- Base your label ONLY on the headline text supplied. No outside knowledge.\n' +
      '- If a headline is not about the queried company, label it "neutral".\n' +
      '- Return valid JSON matching the schema exactly. No prose.'
    },
    { role: 'user' as const, content:
      `Company/query: ${q}\n\nHeadlines:\n` +
      items.map((h, i) => `${i}. ${h.title}`).join('\n') +
      `\n\nReturn JSON of shape: { "labels": [{ "i": <index>, "label": "positive"|"negative"|"neutral", "why": "<10 words max>" }] }`
    },
  ]

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: prompt,
    }),
  })
  const groqBody = await groqRes.json()
  if (!groqRes.ok) return json({ error: 'groq error', detail: groqBody }, 502)

  let labels: { i: number; label: Label; why: string }[] = []
  try {
    const raw = groqBody?.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw)
    labels = Array.isArray(parsed?.labels) ? parsed.labels : []
  } catch {
    labels = []
  }

  const counts = { positive: 0, neutral: 0, negative: 0 }
  const labeled = items.map((it, i) => {
    const lab = labels.find((l) => l.i === i)
    const label = (['positive', 'negative', 'neutral'] as const).includes(lab?.label ?? 'neutral')
      ? (lab!.label as Label)
      : 'neutral'
    counts[label]++
    return { ...it, label, why: lab?.why ?? '' }
  })

  return json({ q, counts, labeled, fetched_at: new Date().toISOString() })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}

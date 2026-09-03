// Aggregates market-news RSS feeds → JSON.
// ponytail: no cache layer. RSS providers tolerate the request volume
// of a hackathon; add a Supabase `news_cache` table with TTL only when
// you actually see 429s from a source.
//
// GET → { items: [{ title, link, source, published_at, summary }] }

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

type Source = { name: string; url: string }

const FEEDS: Source[] = [
  { name: 'Economic Times',  url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'Moneycontrol',    url: 'https://www.moneycontrol.com/rss/business.xml' },
  { name: 'LiveMint',        url: 'https://www.livemint.com/rss/markets' },
]

type Item = { title: string; link: string; source: string; published_at: string; summary: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const settled = await Promise.allSettled(
    FEEDS.map(async (s): Promise<Item[]> => {
      const res = await fetch(s.url, {
        headers: { 'user-agent': 'VeridexBot/0.1 (contact: sahilkarande0918@gmail.com)' },
      })
      if (!res.ok) throw new Error(`${s.name}: ${res.status}`)
      const xml = await res.text()
      return parseRss(xml, s.name)
    }),
  )

  const items: Item[] = settled
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
    .slice(0, 60)

  const errors = settled
    .map((r, i) => (r.status === 'rejected' ? { source: FEEDS[i].name, error: String(r.reason) } : null))
    .filter(Boolean)

  return new Response(JSON.stringify({ items, errors, fetched_at: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})

function parseRss(xml: string, source: string): Item[] {
  const items: Item[] = []
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml))) {
    const chunk = m[1]
    const title = pick(chunk, 'title')
    const link  = pick(chunk, 'link') || pick(chunk, 'guid')
    const desc  = pick(chunk, 'description')
    const pub   = pick(chunk, 'pubDate') || pick(chunk, 'dc:date') || pick(chunk, 'published')
    if (!title || !link) continue
    items.push({
      title:  strip(title),
      link:   link.trim(),
      source,
      published_at: parseDate(pub),
      summary: strip(desc).slice(0, 240),
    })
  }
  return items
}

function pick(chunk: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(chunk)
  if (cdata) return cdata[1]
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(chunk)
  return plain ? plain[1] : ''
}
function strip(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim()
}
function parseDate(s: string): string {
  if (!s) return new Date().toISOString()
  const d = new Date(s.trim())
  return isNaN(+d) ? new Date().toISOString() : d.toISOString()
}

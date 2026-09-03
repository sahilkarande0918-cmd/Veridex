// Grounded AI chat.
//
// POST { message: string, history?: [{role,content}] }
//
// Pipeline:
//   1. Intent-route the user's message (keyword rules; no LLM router).
//   2. Fire the live fetches that intent needs — market snapshot,
//      news search, screener top-3, portfolio read — BEFORE calling
//      the model.
//   3. Prompt Groq with a strict system message: answer only from
//      the supplied context; say "I don't have that" for anything
//      not present. Never originate a market number.
//
// Env: UPSTOX_ACCESS_TOKEN, NEWSAPI_KEY, GROQ_API_KEY

import { corsHeaders } from '../_shared/cors.ts'

declare const Deno: { env: { get: (k: string) => string | undefined }; serve: (h: (r: Request) => Response | Promise<Response>) => void }

const NIFTY_KEY = 'NSE_INDEX|Nifty 50'

// Same curated set as the frontend so movers make sense.
const UNIVERSE: { symbol: string; key: string }[] = [
  { symbol: 'RELIANCE',   key: 'NSE_EQ|INE002A01018' },
  { symbol: 'TCS',        key: 'NSE_EQ|INE467B01029' },
  { symbol: 'HDFCBANK',   key: 'NSE_EQ|INE040A01034' },
  { symbol: 'INFY',       key: 'NSE_EQ|INE009A01021' },
  { symbol: 'ICICIBANK',  key: 'NSE_EQ|INE090A01021' },
  { symbol: 'HINDUNILVR', key: 'NSE_EQ|INE030A01027' },
  { symbol: 'ITC',        key: 'NSE_EQ|INE154A01025' },
  { symbol: 'SBIN',       key: 'NSE_EQ|INE062A01020' },
  { symbol: 'BHARTIARTL', key: 'NSE_EQ|INE397D01024' },
  { symbol: 'KOTAKBANK',  key: 'NSE_EQ|INE237A01028' },
  { symbol: 'LT',         key: 'NSE_EQ|INE018A01030' },
  { symbol: 'AXISBANK',   key: 'NSE_EQ|INE238A01034' },
  { symbol: 'MARUTI',     key: 'NSE_EQ|INE585B01010' },
  { symbol: 'BAJFINANCE', key: 'NSE_EQ|INE296A01024' },
  { symbol: 'SUNPHARMA',  key: 'NSE_EQ|INE044A01036' },
  { symbol: 'TATAMOTORS', key: 'NSE_EQ|INE155A01022' },
  { symbol: 'TATASTEEL',  key: 'NSE_EQ|INE081A01020' },
  { symbol: 'ONGC',       key: 'NSE_EQ|INE213A01029' },
  { symbol: 'ADANIENT',   key: 'NSE_EQ|INE423A01024' },
  { symbol: 'COALINDIA',  key: 'NSE_EQ|INE522F01014' },
]

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const GROQ = Deno.env.get('GROQ_API_KEY')
  const UPSTOX = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  const NEWSAPI = Deno.env.get('NEWSAPI_KEY')
  if (!GROQ)   return json({ error: 'GROQ_API_KEY unset' }, 500)

  let payload: { message?: string; history?: Msg[] } = {}
  try { payload = await req.json() } catch { /* ignore */ }
  const message = (payload.message ?? '').trim()
  if (!message) return json({ error: 'missing "message"' }, 400)

  // Intent routing (keyword rules).
  const lower = message.toLowerCase()
  const askMarket   = /\b(nifty|sensex|market|trend|today|movers?|top gainers?|top losers?)\b/.test(lower)
  const askNews     = /\bnews|headlines?|announcement/.test(lower)
  const askPortfolio= /\bmy (portfolio|holdings|positions)\b|how am i doing|my pnl|profit/.test(lower)
  const askRecomm   = /\b(what should i buy|screener|pick|recommend|best stock)/.test(lower)
  const symMatch    = lower.match(/\b([a-z]{3,10})\b/g)?.filter((w) =>
    UNIVERSE.some((u) => u.symbol.toLowerCase() === w),
  ) ?? []

  // ---- collect grounding context in parallel ----
  const [marketCtx, newsCtx, portfolioCtx] = await Promise.all([
    askMarket && UPSTOX ? marketSnapshot(UPSTOX).catch(err) : Promise.resolve(null),
    askNews && NEWSAPI ? newsSearch(NEWSAPI, symMatch[0] ?? extractQuery(message)).catch(err) : Promise.resolve(null),
    askPortfolio ? portfolioSnapshot(req).catch(err) : Promise.resolve(null),
  ])

  const screenerCtx = askRecomm ? screenerTop3() : null

  // Assemble context block for the LLM.
  const context = renderContext({ marketCtx, newsCtx, portfolioCtx, screenerCtx })

  const system = [
    'You are Veridex, an assistant for Indian retail investors. Follow these rules strictly:',
    '',
    '1. Every specific number (price, %, ratio, count, date) MUST come from the CONTEXT block below.',
    '   If a number is not in the context, say "I don\'t have that right now — I can pull it if you\'d like."',
    '   NEVER estimate, recall, or invent a market number from your training data.',
    '2. When the user asks for a buy/sell recommendation, do not originate one. Point them to Veridex\'s',
    '   own screener or signals output as shown in the context, and remind them methodology is visible in those pages.',
    '3. Keep answers under 6 sentences unless the user asks for detail.',
    '4. End every substantive answer with: "Not SEBI-registered advice."',
    '',
    '=== CONTEXT (only ground truth you may cite) ===',
    context || '(no live context fetched for this question)',
    '=== END CONTEXT ===',
  ].join('\n')

  const messages: Msg[] = [
    { role: 'system', content: system },
    ...(payload.history ?? []).slice(-8),   // last 8 turns of history
    { role: 'user', content: message },
  ]

  const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      messages,
    }),
  })
  const gBody = await gRes.json()
  if (!gRes.ok) return json({ error: 'groq error', detail: gBody }, 502)

  const reply = gBody?.choices?.[0]?.message?.content ?? ''
  return json({
    reply,
    grounded_on: {
      market: !!marketCtx,
      news: !!newsCtx,
      portfolio: !!portfolioCtx,
      screener: !!screenerCtx,
    },
    fetched_at: new Date().toISOString(),
  })
})

// ---------------- helpers ----------------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}
function err(e: unknown) { return { error: e instanceof Error ? e.message : String(e) } }

function extractQuery(m: string): string {
  // pull a plausible company name / ticker from the message.
  const m2 = m.match(/\b([A-Z][A-Za-z]{2,})\b/)
  return m2?.[1] ?? m.split(/\s+/).slice(-1)[0]
}

async function marketSnapshot(token: string) {
  const keys = [NIFTY_KEY, ...UNIVERSE.map((u) => u.key)].join(',')
  const res = await fetch(
    `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(keys)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  const body = await res.json()
  if (!res.ok) throw new Error('upstox quote failed: ' + JSON.stringify(body).slice(0, 200))

  type Quote = { last_price?: number; net_change?: number; close_price?: number }
  const data: Record<string, Quote> = body.data ?? {}
  const universeQuotes = UNIVERSE.map((u) => {
    // Upstox keys quotes by `EXCH:SYMBOL`, not the instrument_key we sent.
    const entry = Object.entries(data).find(([, q]) =>
      (q as Quote & { instrument_token?: string })?.instrument_token != null,
    )?.[1] // fallback if lookup fails
    const q = data[`NSE_EQ:${u.symbol}`] ?? entry ?? {}
    const last  = q.last_price ?? 0
    const prev  = q.close_price ?? (last - (q.net_change ?? 0))
    const pct   = prev > 0 ? ((last - prev) / prev) * 100 : 0
    return { symbol: u.symbol, last, pct }
  })
  const gainers = [...universeQuotes].sort((a, b) => b.pct - a.pct).slice(0, 5)
  const losers  = [...universeQuotes].sort((a, b) => a.pct - b.pct).slice(0, 5)

  const nifty = data['NSE_INDEX:Nifty 50'] ?? data[NIFTY_KEY] ?? {}
  const niftyLast = nifty.last_price ?? null
  const niftyPrev = nifty.close_price ?? (niftyLast != null && nifty.net_change != null ? niftyLast - nifty.net_change : null)
  const niftyPct  = niftyLast != null && niftyPrev ? ((niftyLast - niftyPrev) / niftyPrev) * 100 : null

  return { nifty: { last: niftyLast, pct: niftyPct }, gainers, losers }
}

async function newsSearch(apiKey: string, q: string) {
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}&country=in&language=en&category=business`
  const res = await fetch(url)
  const body = await res.json()
  type Raw = { title: string; link: string; source_name?: string; source_id?: string; pubDate?: string }
  if (!res.ok) throw new Error('newsdata: ' + JSON.stringify(body).slice(0, 200))
  const items = (body.results ?? []).slice(0, 6).map((r: Raw) => ({
    title: r.title,
    source: r.source_name ?? r.source_id ?? 'unknown',
    published_at: r.pubDate ? new Date(r.pubDate).toISOString() : null,
  }))
  return { q, items }
}

async function portfolioSnapshot(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')
  if (!SUPABASE_URL || !ANON) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/holdings?select=symbol,qty,buy_price,buy_date`, {
    headers: { apikey: ANON, Authorization: auth },
  })
  if (!res.ok) throw new Error('holdings read failed: ' + res.status)
  const rows: { symbol: string; qty: number; buy_price: number; buy_date: string }[] = await res.json()
  return { count: rows.length, holdings: rows.slice(0, 30) }
}

// Small hardcoded top-3 from the same illustrative fundamentals shipped
// with the frontend — the chat isn't the source of truth for the screener
// (that page is), just a pointer. When live fundamentals wire in, this
// gets replaced with a call into the same source the screener uses.
function screenerTop3() {
  return {
    note: 'Top-3 by composite score using SAMPLE fundamentals (see Screener page for methodology).',
    picks: [
      { symbol: 'ONGC',       composite: 81, why: 'Cheapest P/E in set + low D/E' },
      { symbol: 'SBIN',       composite: 76, why: 'Strong growth, low P/B' },
      { symbol: 'COALINDIA',  composite: 74, why: 'Cheap P/E + debt-light' },
    ],
  }
}

function renderContext(bag: {
  marketCtx: unknown; newsCtx: unknown; portfolioCtx: unknown; screenerCtx: unknown
}): string {
  const parts: string[] = []
  if (bag.marketCtx) parts.push('MARKET:\n' + JSON.stringify(bag.marketCtx, null, 2))
  if (bag.newsCtx)   parts.push('NEWS:\n'   + JSON.stringify(bag.newsCtx, null, 2))
  if (bag.portfolioCtx) parts.push('PORTFOLIO:\n' + JSON.stringify(bag.portfolioCtx, null, 2))
  if (bag.screenerCtx)  parts.push('SCREENER:\n'  + JSON.stringify(bag.screenerCtx, null, 2))
  return parts.join('\n\n')
}

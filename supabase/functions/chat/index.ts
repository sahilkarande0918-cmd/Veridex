// Grounded AI chat with a professional-trader persona.
//
// POST { message, history? }
//
// The model never answers from memory. We route the message, run the
// relevant live fetches, and hand the results over as a CONTEXT block.
// Probabilities always come from analyze-stock's historical base rates
// (with sample size), never from the model.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
//      UPSTOX_ACCESS_TOKEN, NEWSAPI_KEY, GROQ_API_KEY

import { corsHeaders } from '../_shared/cors.ts'

const MODEL = 'openai/gpt-oss-20b'
const STOPWORDS = new Set([
  'SHOULD', 'I', 'BUY', 'SELL', 'THE', 'A', 'AN', 'IN', 'ON', 'FOR', 'IS', 'IT',
  'THIS', 'THAT', 'AND', 'OR', 'TO', 'OF', 'MY', 'ME', 'DO', 'CAN', 'WHAT',
  'WHICH', 'STOCK', 'STOCKS', 'SHARE', 'SHARES', 'PRICE', 'INTRADAY',
  'DELIVERY', 'HOLD', 'LONG', 'TERM', 'SHORT', 'INVEST', 'GOOD', 'BAD',
  'NOW', 'TODAY', 'RUPEES', 'RS', 'INR', 'UNDER', 'BELOW', 'ABOUT', 'ANY',
  'NEWS', 'MARKET', 'PORTFOLIO', 'HOW', 'WHY', 'WHEN', 'BEST', 'TOP',
])

type Msg = { role: 'system' | 'user' | 'assistant'; content: string }

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const GROQ = Deno.env.get('GROQ_API_KEY')
  const UPSTOX = Deno.env.get('UPSTOX_ACCESS_TOKEN')
  const NEWSAPI = Deno.env.get('NEWSAPI_KEY')
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!GROQ) return json({ error: 'GROQ_API_KEY unset' }, 500)

  let payload: { message?: string; history?: Msg[] } = {}
  try { payload = await req.json() } catch { /* ignore */ }
  const message = (payload.message ?? '').trim()
  if (!message) return json({ error: 'missing "message"' }, 400)
  const lower = message.toLowerCase()

  // ---- intent ------------------------------------------------------
  const askAnalysis = /\b(should i (buy|sell|invest|hold|enter)|analys|analyz|worth (buying|holding)|good (to )?buy|intraday or|delivery or|entry|stop ?loss|target|hold (it )?(for )?(long|short))\b/.test(lower)
  const askRecommend = /\b(what should i buy|recommend|suggest|which stocks?|best stocks?|top stocks?|under\s*(₹|rs\.?|inr)?\s*\d|below\s*(₹|rs\.?|inr)?\s*\d|budget)\b/.test(lower)
  const askMarket = /\b(nifty|sensex|market|trend|movers?|gainers?|losers?)\b/.test(lower)
  const askNews = /\b(news|headlines?|announcement)\b/.test(lower)
  const askPortfolio = /\bmy (portfolio|holdings|positions)\b|how am i doing|my p&?l|my pnl/.test(lower)

  // ---- resolve a ticker mentioned in the message --------------------
  const resolved = await resolveSymbol(message, SUPABASE_URL, SR)

  // ---- gather grounding in parallel --------------------------------
  const maxPrice = parseBudget(lower)

  const [analysis, recommendation, market, news, portfolio] = await Promise.all([
    (askAnalysis || (resolved && !askRecommend && !askNews)) && resolved
      ? callFn(SUPABASE_URL, SR, `analyze-stock?key=${encodeURIComponent(resolved.instrument_key)}`).catch(errOf)
      : Promise.resolve(null),
    askRecommend
      ? callFn(SUPABASE_URL, SR, `recommend?max_price=${maxPrice ?? 500}&count=5`).catch(errOf)
      : Promise.resolve(null),
    askMarket && UPSTOX ? marketSnapshot(UPSTOX).catch(errOf) : Promise.resolve(null),
    askNews && NEWSAPI ? newsSearch(NEWSAPI, resolved?.trading_symbol ?? extractQuery(message)).catch(errOf) : Promise.resolve(null),
    askPortfolio ? portfolioSnapshot(req, SUPABASE_URL).catch(errOf) : Promise.resolve(null),
  ])

  const parts: string[] = []
  if (analysis)       parts.push('STOCK_ANALYSIS:\n' + JSON.stringify(analysis, null, 1))
  if (recommendation) parts.push('SCREEN_RESULTS:\n' + JSON.stringify(recommendation, null, 1))
  if (market)         parts.push('MARKET:\n' + JSON.stringify(market, null, 1))
  if (news)           parts.push('NEWS:\n' + JSON.stringify(news, null, 1))
  if (portfolio)      parts.push('PORTFOLIO:\n' + JSON.stringify(portfolio, null, 1))
  const context = parts.join('\n\n')

  const system = [
    'You are Veridex Desk — an experienced Indian equity trading assistant. You speak like a',
    'professional on a trading desk: direct, risk-first, unhyped. You never cheerlead a stock.',
    '',
    'ABSOLUTE RULES',
    '1. Every number you state (price, %, RSI, probability, level, sample size) MUST be copied from',
    '   the CONTEXT block below. If a number is not there, say "I don\'t have that — want me to pull it?"',
    '   NEVER estimate or recall a market number from training data.',
    '2. NEVER say a stock "will" go up or down. Express direction ONLY as the historical base rate',
    '   from base_rates, and ALWAYS quote the sample size alongside it. Example phrasing:',
    '   "In the 103 past sessions where this stock sat in the same RSI/SMA50 state, price was higher',
    '   20 sessions later 29% of the time." Then state what that does and does not imply.',
    '3. If base_rates.reliability is "low", say the sample is too thin to lean on.',
    '4. Point out when edge_vs_unconditional_pp is near zero — that means the setup carries no',
    '   historical signal and the honest answer is "no edge here".',
    '',
    'HOW TO ANSWER "SHOULD I BUY / INTRADAY OR DELIVERY"',
    '- Open with a one-line read of the setup (trend vs SMA20/50/200, RSI, where it sits in the 52w range).',
    '- Give the base rates for 1d / 5d / 20d / 60d with sample sizes.',
    '- Recommend a horizon using horizon_fitness. Say WHY using its component numbers',
    '  (daily range % for intraday, trend alignment for swing, SMA200 + 1y return for long term).',
    '- Give the risk frame: ATR stop levels, 20-session support and resistance, and the',
    '  upside-to-resistance vs downside-to-support ratio.',
    '- ALWAYS CLOSE WITH THE VERDICT. STOCK_ANALYSIS.verdict already contains a computed call',
    '  (FAVOURABLE / NEUTRAL / UNFAVOURABLE), a conviction score out of 100, the recommended',
    '  horizon, a suggested stop and a risk:reward ratio. Finish every stock answer with a short',
    '  bolded bottom-line paragraph that states verdict.call and verdict.conviction plainly, names',
    '  the horizon, and gives the entry-and-stop in rupees. Be decisive — the user wants a clear',
    '  answer, not a shrug. Examples of the right tone:',
    '    "**Bottom line: FAVOURABLE (conviction 62/100).** Best odds are on an intraday trade —',
    '     the 1-session base rate is 55.9% over 34 samples, +11.2pp above its all-days rate. If you',
    '     take it, keep a stop at ₹78.66 and respect ₹88.60 as resistance."',
    '    "**Bottom line: UNFAVOURABLE (conviction 31/100).** Price is under all three averages and',
    '     the 1-month base rate is 29% over 103 samples. Wait for a close back above ₹87.35."',
    '  Use verdict.what_would_change_it to tell them what to watch for. NEVER invent a call or a',
    '  conviction number — copy them from verdict.',
    '- If the setup is poor, say so plainly. "Not a good entry here" is a valid, useful answer.',
    '',
    'HOW TO ANSWER "WHAT SHOULD I BUY UNDER X"',
    '- Use SCREEN_RESULTS. Name the top picks with their composite score and the raw numbers behind it.',
    '- State the screen\'s methodology limits: it is price-momentum based, uses no fundamentals,',
    '  and only ranks within the liquid shortlist it analysed.',
    '',
    'STYLE',
    '- Under 200 words unless asked for depth. Use short paragraphs or tight bullets.',
    '- Rupee amounts as ₹1,284.40. Percentages to one decimal.',
    '- End every substantive answer with: "Not SEBI-registered advice."',
    '',
    '=== CONTEXT (the only ground truth you may cite) ===',
    context || '(no live data was fetched for this question)',
    '=== END CONTEXT ===',
  ].join('\n')

  const messages: Msg[] = [
    { role: 'system', content: system },
    ...(payload.history ?? []).slice(-6),
    { role: 'user', content: message },
  ]

  const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature: 0.2, max_tokens: 900, messages }),
  })
  const gBody = await gRes.json()
  if (!gRes.ok) return json({ error: 'groq error', detail: gBody }, 502)

  return json({
    reply: gBody?.choices?.[0]?.message?.content ?? '',
    resolved_symbol: resolved?.trading_symbol ?? null,
    grounded_on: {
      analysis: !!analysis && !(analysis as { error?: unknown }).error,
      screen: !!recommendation && !(recommendation as { error?: unknown }).error,
      market: !!market, news: !!news, portfolio: !!portfolio,
    },
    analysis: analysis ?? null,
    fetched_at: new Date().toISOString(),
  })
})

// ---------------- helpers ----------------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })
}
const errOf = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })

// Call a sibling edge function server-to-server with the service role.
async function callFn(base: string, sr: string, path: string) {
  const r = await fetch(`${base}/functions/v1/${path}`, {
    headers: { apikey: sr, Authorization: `Bearer ${sr}` },
  })
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json()
}

// Find a real NSE ticker mentioned anywhere in the message.
async function resolveSymbol(msg: string, base: string, sr: string):
  Promise<{ instrument_key: string; trading_symbol: string; name: string } | null> {
  const tokens = Array.from(new Set(
    (msg.toUpperCase().match(/[A-Z][A-Z0-9&-]{1,14}/g) ?? []).filter((t) => !STOPWORDS.has(t)),
  )).slice(0, 12)
  if (tokens.length === 0) return null

  // exact ticker match first
  const inList = tokens.map((t) => `"${t}"`).join(',')
  const r = await fetch(
    `${base}/rest/v1/instruments?select=instrument_key,trading_symbol,name&trading_symbol=in.(${encodeURIComponent(inList)})&limit=1`,
    { headers: { apikey: sr, Authorization: `Bearer ${sr}` } },
  )
  if (r.ok) {
    const hit = await r.json()
    if (hit.length) return hit[0]
  }

  // fall back to a name search on the longest meaningful token
  const longest = tokens.sort((a, b) => b.length - a.length)[0]
  if (!longest || longest.length < 4) return null
  const r2 = await fetch(
    `${base}/rest/v1/rpc/search_instruments`,
    {
      method: 'POST',
      headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'content-type': 'application/json' },
      body: JSON.stringify({ q: longest, lim: 1 }),
    },
  )
  if (!r2.ok) return null
  const hit2 = await r2.json()
  return hit2?.length ? hit2[0] : null
}

// "under 500", "below ₹250", "budget of 1000"
function parseBudget(lower: string): number | null {
  const m = lower.match(/(?:under|below|less than|upto|up to|within|budget(?: of)?)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function extractQuery(m: string): string {
  const m2 = m.match(/\b([A-Z][A-Za-z]{2,})\b/)
  return m2?.[1] ?? m.split(/\s+/).slice(-1)[0]
}

async function marketSnapshot(token: string) {
  const NIFTY = 'NSE_INDEX|Nifty 50'
  const res = await fetch(
    `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(NIFTY)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`upstox ${res.status}`)
  const body = await res.json()
  const q = Object.values(body?.data ?? {})[0] as
    { last_price?: number; net_change?: number; ohlc?: { close?: number } } | undefined
  const last = q?.last_price ?? null
  const prev = q?.ohlc?.close ?? (last != null && q?.net_change != null ? last - q.net_change : null)
  const pct = last != null && prev ? ((last - prev) / prev) * 100 : null
  return { index: 'Nifty 50', last, pct_change: pct != null ? Math.round(pct * 100) / 100 : null }
}

async function newsSearch(apiKey: string, q: string) {
  const url = `https://newsdata.io/api/1/latest?apikey=${apiKey}&q=${encodeURIComponent(q)}&country=in&language=en&category=business`
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error('newsdata: ' + JSON.stringify(body).slice(0, 160))
  type Raw = { title: string; source_name?: string; source_id?: string; pubDate?: string }
  return {
    q,
    items: (body.results ?? []).slice(0, 6).map((r: Raw) => ({
      title: r.title,
      source: r.source_name ?? r.source_id ?? 'unknown',
      published_at: r.pubDate ? new Date(r.pubDate).toISOString() : null,
    })),
  }
}

async function portfolioSnapshot(req: Request, base: string) {
  const auth = req.headers.get('authorization') ?? ''
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')
  if (!ANON) return null
  const res = await fetch(`${base}/rest/v1/holdings?select=symbol,qty,buy_price,buy_date`, {
    headers: { apikey: ANON, Authorization: auth },
  })
  if (!res.ok) throw new Error('holdings read failed: ' + res.status)
  const rows: { symbol: string; qty: number; buy_price: number; buy_date: string }[] = await res.json()
  return { count: rows.length, holdings: rows.slice(0, 30) }
}

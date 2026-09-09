import { useEffect, useRef, useState } from 'react'
import { sendChat, type ChatMsg, type ChatResponse } from '@/lib/chat'
import Disclaimer from '@/components/Disclaimer'
import ChatMarkdown from '@/components/ChatMarkdown'
import ScreenPicks, { type ScreenResult } from '@/components/ScreenPicks'

type Turn = ChatMsg & {
  grounded_on?: ChatResponse['grounded_on']
  screen?: ScreenResult | null
  verdict?: { call: string; conviction: number; recommended_horizon: string; suggested_stop: number } | null
  symbol?: string | null
}

const SUGGESTIONS = [
  'What is Nifty doing today?',
  'How is my portfolio doing?',
  'Any news on RELIANCE?',
  'What should I buy with 50000?',
]

export default function Chat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const send = async (msg: string) => {
    const trimmed = msg.trim()
    if (!trimmed || busy) return
    setInput(''); setErr(null); setBusy(true)
    const history: ChatMsg[] = turns.map(({ role, content }) => ({ role, content }))
    setTurns((t) => [...t, { role: 'user', content: trimmed }])
    try {
      const lastSymbol = [...turns].reverse().find((t) => t.symbol)?.symbol ?? null
      const r = await sendChat(trimmed, history, lastSymbol)
      const a = r.analysis as { verdict?: Turn['verdict'] } | null
      setTurns((t) => [...t, {
        role: 'assistant', content: r.reply, grounded_on: r.grounded_on,
        screen: (r.screen as ScreenResult | null) ?? null,
        verdict: a?.verdict ?? null,
        symbol: r.resolved_symbol ?? null,
      }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3 flex flex-col h-[calc(100vh-11rem)] min-h-[26rem]">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">AI Chat</h1>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          AI-generated · grounded on live data
        </span>
      </div>
      <p className="text-xs text-neutral-500 -mt-1">
        Numbers come from a live fetch made before the model replies — if it wasn't fetched, the model says so instead of guessing.
      </p>

      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-neutral-900 bg-neutral-950 p-4 space-y-3">
        {turns.length === 0 && (
          <div className="text-center space-y-3 py-8">
            <div className="text-sm text-neutral-500">Try one of these:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s} onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-neutral-800 hover:bg-neutral-900 hover:border-violet-600 text-neutral-300 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => <Bubble key={i} turn={t} />)}
        {busy && (
          <div className="text-xs text-neutral-500 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
            Fetching live data and generating…
          </div>
        )}
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="flex gap-2"
      >
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the market, your holdings, or a specific stock…"
          disabled={busy}
          className="flex-1 h-11 rounded-md bg-neutral-900 border border-neutral-800 px-3 text-sm outline-none focus:border-violet-600 disabled:opacity-50"
        />
        <button
          type="submit" disabled={busy || !input.trim()}
          className="h-11 px-5 rounded-md bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-sm font-medium"
        >
          Send
        </button>
      </form>

      <Disclaimer only="ai" />
    </div>
  )
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? 'bg-violet-600 text-white' : 'bg-neutral-900 border border-neutral-800 text-neutral-100'
      }`}>
        {isUser
          ? <div className="whitespace-pre-wrap leading-relaxed">{turn.content}</div>
          : <ChatMarkdown text={turn.content} />}
        {!isUser && turn.verdict && <VerdictChip v={turn.verdict} symbol={turn.symbol} />}
        {!isUser && turn.screen && <ScreenPicks data={turn.screen} />}
        {!isUser && turn.grounded_on && <GroundingTags g={turn.grounded_on} />}
      </div>
    </div>
  )
}

function VerdictChip({ v, symbol }: { v: NonNullable<Turn['verdict']>; symbol?: string | null }) {
  const tone = v.call === 'FAVOURABLE'
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    : v.call === 'NEUTRAL'
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
    : 'border-red-500/40 bg-red-500/10 text-red-300'
  const horizon = { intraday: 'Intraday', swing_delivery: 'Swing / delivery', long_term: 'Long term' }[v.recommended_horizon] ?? v.recommended_horizon
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2.5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{symbol ? `${symbol} · ` : ''}{v.call}</span>
        <span className="text-xs tabular opacity-80">{v.conviction}/100</span>
      </div>
      <div className="h-1 rounded-full bg-black/30 mt-2 overflow-hidden">
        <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${Math.min(100, Math.max(0, v.conviction))}%` }} />
      </div>
      <div className="text-[11px] mt-2 opacity-85">
        Best horizon: {horizon} · suggested stop ₹{v.suggested_stop}
      </div>
    </div>
  )
}

function GroundingTags({ g }: { g: NonNullable<Turn['grounded_on']> }) {
  const tags: string[] = []
  if (g.market)    tags.push('live market')
  if (g.news)      tags.push('news fetch')
  if (g.portfolio) tags.push('your holdings')
  if (g.screener)  tags.push('screener')
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 pt-2 mt-2 border-t border-neutral-800/60">
      {tags.map((t) => (
        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          grounded: {t}
        </span>
      ))}
    </div>
  )
}

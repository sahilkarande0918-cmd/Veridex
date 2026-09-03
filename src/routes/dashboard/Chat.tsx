import { useEffect, useRef, useState } from 'react'
import { sendChat, type ChatMsg, type ChatResponse } from '@/lib/chat'
import Disclaimer from '@/components/Disclaimer'

type Turn = ChatMsg & { grounded_on?: ChatResponse['grounded_on'] }

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
      const r = await sendChat(trimmed, history)
      setTurns((t) => [...t, { role: 'assistant', content: r.reply, grounded_on: r.grounded_on }])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-14rem)]">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">AI Chat</h1>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
          AI-generated · grounded on live data
        </span>
      </div>
      <p className="text-sm text-neutral-500 -mt-2">
        Each answer's specific numbers come from a live fetch made before the model replies. If a fact wasn't fetched, the model refuses instead of guessing.
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

      <Disclaimer ai />
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
        <div className="whitespace-pre-wrap leading-relaxed">{turn.content}</div>
        {!isUser && turn.grounded_on && <GroundingTags g={turn.grounded_on} />}
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

import { useEffect, useState } from 'react'
import { listAlerts, markAllRead, type Alert } from '@/lib/alerts'
import { requestFcmToken, onForegroundMessage } from '@/lib/firebase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function AlertsBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [busyPush, setBusyPush] = useState(false)
  const unread = alerts.filter((a) => !a.read_at).length

  const load = () => listAlerts().then(setAlerts).catch(() => {})

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('push_token').eq('id', user.id).maybeSingle<{ push_token: string | null }>()
      .then(({ data }) => setPushOn(!!data?.push_token))
    return onForegroundMessage(() => load())
  }, [user])

  const enablePush = async () => {
    if (!user) return
    setBusyPush(true)
    try {
      const token = await requestFcmToken()
      if (token) {
        await supabase.from('profiles').update({ push_token: token }).eq('id', user.id)
        setPushOn(true)
      } else {
        alert('Notification permission was declined or unsupported in this browser.')
      }
    } catch (e) {
      alert(String(e))
    } finally { setBusyPush(false) }
  }

  const disablePush = async () => {
    if (!user) return
    await supabase.from('profiles').update({ push_token: null }).eq('id', user.id)
    setPushOn(false)
  }

  const clearAll = async () => {
    await markAllRead()
    load()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative h-8 w-8 flex items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900 text-neutral-400 hover:text-neutral-100"
        title="Alerts"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center tabular">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl z-50">
            <div className="p-3 border-b border-neutral-900 flex items-center justify-between">
              <div className="text-sm font-medium">Alerts</div>
              {unread > 0 && (
                <button onClick={clearAll} className="text-xs text-violet-400 hover:text-violet-300">
                  Mark all read
                </button>
              )}
            </div>
            <div className="p-3 border-b border-neutral-900 flex items-center justify-between text-xs">
              <span className="text-neutral-400">Web push {pushOn ? '· on' : '· off'}</span>
              {pushOn
                ? <button onClick={disablePush} className="text-neutral-500 hover:text-neutral-300">Turn off</button>
                : <button disabled={busyPush} onClick={enablePush} className="text-violet-400 hover:text-violet-300 disabled:opacity-50">
                    {busyPush ? 'Enabling…' : 'Enable'}
                  </button>}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {alerts.length === 0 && (
                <li className="p-4 text-xs text-neutral-500 text-center">
                  Nothing yet. Review nudges appear here 30 days after you add a position.
                </li>
              )}
              {alerts.map((a) => (
                <li key={a.id} className={`p-3 border-b border-neutral-900 last:border-b-0 ${!a.read_at ? 'bg-violet-600/[0.03]' : ''}`}>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="uppercase tracking-wider">{a.type}</span>
                    {a.symbol && <span className="text-violet-400">{a.symbol}</span>}
                    <span className="ml-auto">{new Date(a.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{a.title}</div>
                  {a.message && <div className="text-xs text-neutral-400 mt-1">{a.message}</div>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import MarketStatus from './MarketStatus'
import Disclaimer from './Disclaimer'
import AlertsBell from './AlertsBell'
import TickerTape from './TickerTape'

type NavItem = { to: string; label: string; icon: string }

const navItems: NavItem[] = [
  { to: '/dashboard',           label: 'Overview',  icon: '⬢' },
  { to: '/dashboard/profile',   label: 'Profile',   icon: '◉' },
  { to: '/dashboard/charts',    label: 'Charts',    icon: '⌁' },
  { to: '/dashboard/portfolio', label: 'Portfolio', icon: '◫' },
  { to: '/dashboard/screener',  label: 'Screener',  icon: '⧉' },
  { to: '/dashboard/signals',   label: 'Signals',   icon: '⌾' },
  { to: '/dashboard/news',      label: 'News',      icon: '⌘' },
  { to: '/dashboard/chat',      label: 'AI Chat',   icon: '⌬' },
]

export default function DashboardShell() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const doSignOut = async () => { await signOut(); nav('/') }

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr] bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.04)_0%,_transparent_50%)]">
      <aside className="border-r border-neutral-900 bg-neutral-950/60 backdrop-blur p-4 flex flex-col gap-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2 font-semibold tracking-tight px-2">
          <span className="size-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
          Veridex
        </div>

        <nav className="flex flex-col gap-0.5 text-sm">
          {navItems.map((i) => (
            <NavLink
              key={i.to} to={i.to} end={i.to === '/dashboard'}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 px-3 py-2 rounded-md transition ${
                  isActive
                    ? 'bg-violet-600/10 text-violet-300 border border-violet-500/20'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 border border-transparent'
                }`
              }
            >
              <span className="text-neutral-600 group-hover:text-violet-400 transition text-xs">{i.icon}</span>
              {i.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2 text-xs">
          <div className="text-neutral-500 truncate px-2">{user?.email}</div>
          <button
            onClick={doSignOut}
            className="w-full h-8 rounded-md border border-neutral-800 hover:bg-neutral-900 transition"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex flex-col min-w-0">
        <TickerTape />
        <header className="h-14 border-b border-neutral-900 flex items-center justify-between px-6 bg-neutral-950/40 backdrop-blur sticky top-8 z-20">
          <div className="text-sm text-neutral-400">Dashboard</div>
          <div className="flex items-center gap-4">
            <MarketStatus />
            <AlertsBell />
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
        <footer className="px-6 pb-4">
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}

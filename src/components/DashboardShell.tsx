import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import MarketStatus from './MarketStatus'
import Disclaimer from './Disclaimer'
import AlertsBell from './AlertsBell'
import TickerTape from './TickerTape'
import ThemeToggle from './ThemeToggle'

type NavItem = { to: string; label: string; icon: string }

const navItems: NavItem[] = [
  { to: '/dashboard',           label: 'Overview',  icon: '⬢' },
  { to: '/dashboard/profile',   label: 'Profile',   icon: '◉' },
  { to: '/dashboard/charts',    label: 'Charts',    icon: '⌁' },
  { to: '/dashboard/analyze',   label: 'Analyze',   icon: '◈' },
  { to: '/dashboard/portfolio', label: 'Portfolio', icon: '◫' },
  { to: '/dashboard/screener',  label: 'Screener',  icon: '⧉' },
  { to: '/dashboard/signals',   label: 'Signals',   icon: '⌾' },
  { to: '/dashboard/news',      label: 'News',      icon: '⌘' },
  { to: '/dashboard/chat',      label: 'AI Chat',   icon: '⌬' },
]

export default function DashboardShell() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()
  // Below lg the sidebar is an overlay drawer — a 220px rail would eat
  // more than half of a 375px screen. At lg+ it is always open and the
  // `open` state is ignored entirely.
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const doSignOut = async () => { await signOut(); nav('/') }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr] bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.04)_0%,_transparent_50%)]">
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      <aside
        className={`vx-sidebar border-r border-neutral-900 bg-neutral-950 lg:bg-neutral-950/60 backdrop-blur p-4 flex flex-col gap-6
          sticky top-0 h-screen
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-[260px] max-lg:max-w-[82vw]
          max-lg:transition-transform max-lg:duration-200 max-lg:ease-out
          ${open ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="size-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(124,58,237,0.8)]" />
            Veridex
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="lg:hidden size-8 -mr-1 rounded-md text-neutral-400 hover:bg-neutral-900 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 text-sm overflow-y-auto">
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
        {/* Ticker + header pin together. Previously only the header was
            sticky (at top-8), so scrolling took the ticker away and left
            a transparent 32px window that page content showed through. */}
        <div className="vx-appbar sticky top-0 z-30">
          <TickerTape />
          <header className="h-14 border-b border-neutral-900 flex items-center justify-between gap-2 px-4 sm:px-6">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                className="lg:hidden size-9 -ml-1.5 shrink-0 rounded-md text-neutral-300 hover:bg-neutral-900 flex flex-col items-center justify-center gap-[3px]"
              >
                <span className="block w-4 h-px bg-current" />
                <span className="block w-4 h-px bg-current" />
                <span className="block w-4 h-px bg-current" />
              </button>
              <div className="text-sm text-neutral-400 truncate">Dashboard</div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="hidden sm:block"><MarketStatus /></div>
              <ThemeToggle />
              <AlertsBell />
            </div>
          </header>
        </div>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
        <footer className="px-4 sm:px-6 pb-4">
          <Disclaimer />
        </footer>
      </div>
    </div>
  )
}

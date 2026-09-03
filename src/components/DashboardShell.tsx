import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import MarketStatus from './MarketStatus'
import Disclaimer from './Disclaimer'

const navItems: { to: string; label: string }[] = [
  { to: '/dashboard',           label: 'Overview' },
  { to: '/dashboard/portfolio', label: 'Portfolio' },
  { to: '/dashboard/screener',  label: 'Screener' },
  { to: '/dashboard/news',      label: 'News' },
  { to: '/dashboard/chat',      label: 'AI Chat' },
]

export default function DashboardShell() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const doSignOut = async () => { await signOut(); nav('/') }

  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-neutral-900 bg-neutral-950 p-4 flex flex-col gap-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight px-2">
          <span className="size-2 rounded-full bg-violet-500" /> Veridex
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          {navItems.map((i) => (
            <NavLink
              key={i.to} to={i.to} end={i.to === '/dashboard'}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md transition ${
                  isActive
                    ? 'bg-violet-600/10 text-violet-300 border border-violet-500/20'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900'
                }`
              }
            >
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
        <header className="h-14 border-b border-neutral-900 flex items-center justify-between px-6">
          <div className="text-sm text-neutral-400">Dashboard</div>
          <MarketStatus />
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

// re-exported for legacy imports before Phase 2
export function DashboardPage({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>
}

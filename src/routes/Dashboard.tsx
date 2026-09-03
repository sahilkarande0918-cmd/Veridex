import { useAuth } from '@/lib/auth'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  return (
    <main className="min-h-screen">
      <header className="max-w-6xl mx-auto flex items-center justify-between p-6 border-b border-neutral-900">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-violet-500" /> Veridex
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-400">{user?.email}</span>
          <button
            onClick={signOut}
            className="h-9 px-3 rounded-lg border border-neutral-800 hover:bg-neutral-900 transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-neutral-400">
          Signed in. Portfolio, charts, and signals ship in Phase 2 onward.
        </p>
        <div className="text-xs text-neutral-600 pt-8 border-t border-neutral-900">
          Not SEBI-registered investment advice. Educational/analytical tool only.
        </div>
      </section>
    </main>
  )
}

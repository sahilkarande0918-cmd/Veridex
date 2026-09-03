import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main className="min-h-screen">
      <nav className="max-w-6xl mx-auto flex items-center justify-between p-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-violet-500" /> Veridex
        </div>
        <Link
          to="/login"
          className="text-sm px-4 h-9 inline-flex items-center rounded-lg bg-violet-600 hover:bg-violet-500 transition"
        >
          Sign in
        </Link>
      </nav>

      <section className="max-w-3xl mx-auto text-center px-6 pt-20 pb-16 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-800 text-xs text-neutral-400">
          <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
          Phase 1 — auth online
        </div>
        <h1 className="text-6xl font-semibold tracking-tight leading-none">
          Stock analysis you<br />can actually verify.
        </h1>
        <p className="text-neutral-400 text-lg max-w-xl mx-auto">
          Live Indian-market data, transparent backtested signal accuracy,
          and AI explanations grounded in real computed numbers.
          Never a bare "buy this" tip.
        </p>
        <div className="pt-4">
          <Link
            to="/login"
            className="inline-flex h-12 px-6 items-center rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition"
          >
            Get started — free
          </Link>
        </div>
      </section>

      <footer className="max-w-3xl mx-auto text-center px-6 py-16 border-t border-neutral-900">
        <p className="text-xs text-neutral-600">
          Not SEBI-registered investment advice. Educational/analytical tool only.
          Investments in securities are subject to market risk.
        </p>
      </footer>
    </main>
  )
}

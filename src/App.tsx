export default function App() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-800 text-xs text-neutral-400">
          <span className="size-1.5 rounded-full bg-violet-500" />
          Phase 0 — scaffold live
        </div>
        <h1 className="text-5xl font-semibold tracking-tight">
          Veridex
        </h1>
        <p className="text-neutral-400 text-lg">
          Stock analysis you can actually verify.
        </p>
        <p className="text-neutral-500 text-xs pt-8 border-t border-neutral-900">
          Not SEBI-registered investment advice. Educational/analytical tool only.
          Investments in securities are subject to market risk.
        </p>
      </div>
    </main>
  )
}

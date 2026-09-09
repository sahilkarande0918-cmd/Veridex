export default function Disclaimer({
  ai = false, only,
}: {
  ai?: boolean
  /** "ai" renders ONLY the AI caveat — use on pages inside DashboardShell,
   *  whose footer already carries the SEBI line. Avoids two disclaimers
   *  stacked on the same screen. */
  only?: 'ai'
}) {
  if (only === 'ai') {
    return (
      <div className="text-[10px] leading-relaxed text-neutral-600">
        AI-generated — may be inaccurate. Verify against the computed data before acting.
      </div>
    )
  }
  return (
    <div className="text-[10px] leading-relaxed text-neutral-600 border-t border-neutral-900 pt-3">
      Not SEBI-registered investment advice. Educational/analytical tool only.
      Investments in securities are subject to market risk.
      {ai && ' AI-generated summaries may be inaccurate — verify against the underlying computed data before acting.'}
    </div>
  )
}

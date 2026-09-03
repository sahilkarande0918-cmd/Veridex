export default function Disclaimer({ ai = false }: { ai?: boolean }) {
  return (
    <div className="text-[10px] leading-relaxed text-neutral-600 border-t border-neutral-900 pt-3">
      Not SEBI-registered investment advice. Educational/analytical tool only.
      Investments in securities are subject to market risk.
      {ai && ' AI-generated summaries may be inaccurate — verify against the underlying computed data before acting.'}
    </div>
  )
}

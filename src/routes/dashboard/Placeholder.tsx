export default function Placeholder({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-500 border border-neutral-800">
          {phase}
        </span>
      </div>
      <p className="text-sm text-neutral-500">
        Ships in {phase}. Route is reserved so nav links resolve cleanly.
      </p>
    </div>
  )
}

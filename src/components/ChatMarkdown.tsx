// Minimal markdown for chat replies.
//
// The model only ever emits **bold**, "- " bullets and paragraphs, so a
// full markdown library would be far more weight than the job needs.
// Tables are deliberately NOT supported — the prompt forbids them, and
// if one slips through we flatten it to readable lines rather than
// printing raw pipes.

import type { ReactNode } from 'react'

export default function ChatMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  const lines = text.replace(/\r/g, '').split('\n')

  let para: string[] = []
  let bullets: string[] = []

  const flushPara = () => {
    if (!para.length) return
    blocks.push(
      <p key={`p${blocks.length}`} className="leading-relaxed">{inline(para.join(' '))}</p>,
    )
    para = []
  }
  const flushBullets = () => {
    if (!bullets.length) return
    blocks.push(
      <ul key={`u${blocks.length}`} className="space-y-1 my-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="mt-[7px] size-1 rounded-full bg-current opacity-50 shrink-0" />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    // Drop table separator rows entirely (|---|---|)
    if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue

    // A stray table row → render as "first · second · third"
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushPara()
      const cells = line.split('|').map((c) => c.trim()).filter(Boolean)
      if (cells.length) bullets.push(cells.join(' · '))
      continue
    }

    if (!line.trim()) { flushBullets(); flushPara(); continue }

    if (/^\s*[-*•]\s+/.test(line)) {
      flushPara()
      bullets.push(line.replace(/^\s*[-*•]\s+/, ''))
      continue
    }

    // Headings → just a bold line, no oversized type in a chat bubble
    if (/^#{1,6}\s+/.test(line)) {
      flushBullets(); flushPara()
      blocks.push(
        <p key={`h${blocks.length}`} className="font-semibold">
          {inline(line.replace(/^#{1,6}\s+/, ''))}
        </p>,
      )
      continue
    }

    flushBullets()
    para.push(line.trim())
  }
  flushBullets()
  flushPara()

  return <div className="space-y-2">{blocks}</div>
}

/** **bold** and `code` inside a line. */
function inline(s: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={k++} className="font-semibold">{m[1]}</strong>)
    else out.push(<code key={k++} className="px-1 py-0.5 rounded bg-black/25 text-[0.92em]">{m[2]}</code>)
    last = m.index + m[0].length
  }
  if (last < s.length) out.push(s.slice(last))
  return out
}

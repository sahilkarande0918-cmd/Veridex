// Full-screen looping video backdrop for the /login page with a
// U-shaped cut carved out of the top-center. The cut is done with a
// CSS mask (radial-gradient) — no JS, no reflow, no lag.

import { useEffect, useRef } from 'react'

export default function AuthBackdrop() {
  const ref = useRef<HTMLVideoElement | null>(null)

  // React sets `muted` as a property, not the initial HTML attribute,
  // so Chrome's autoplay policy blocks it. Force-mute + play on mount.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    v.setAttribute('muted', '')
    // Nudge the play. Catch silently on the rare browsers that still refuse.
    const tryPlay = () => v.play().catch(() => {})
    tryPlay()
    // Resume if the browser pauses on tab-refocus
    const onVis = () => document.visibilityState === 'visible' && v.paused && tryPlay()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const uCutMask =
    'radial-gradient(circle 220px at 50% 0%, transparent 0, transparent 216px, black 220px)'

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      <video
        ref={ref}
        src="/login-bg.mp4"
        autoPlay muted loop playsInline
        preload="auto"
        disablePictureInPicture
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          maskImage: uCutMask,
          WebkitMaskImage: uCutMask,
        }}
      />

      {/* soft vignette so the form reads clearly over motion */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.15) 70%, transparent 100%)',
        }}
      />
      {/* subtle top-fade so the U-cut edge blends into pure black */}
      <div
        className="absolute inset-x-0 top-0 h-64 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, #000 0%, transparent 100%)' }}
      />
    </div>
  )
}

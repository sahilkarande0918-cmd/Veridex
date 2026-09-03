// Full-screen looping video backdrop for /login with a visible
// U-shaped cut at the top-center. A soft violet glow sits BEHIND
// the video so the transparent cut area shows the glow through.

import { useEffect, useRef } from 'react'

export default function AuthBackdrop() {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    v.defaultMuted = true
    v.setAttribute('muted', '')
    v.playsInline = true
    v.loop = true

    let tries = 0
    const tryPlay = () => {
      v.play().then(() => { /* playing */ }).catch(() => {
        if (tries++ < 20) setTimeout(tryPlay, 250)
      })
    }
    if (v.readyState >= 2) tryPlay()
    else v.addEventListener('canplay', tryPlay, { once: true })

    // one-time page-click fallback for any browser that still refuses
    const kick = () => { if (v.paused) tryPlay() }
    document.addEventListener('pointerdown', kick, { once: true })

    const onVis = () => document.visibilityState === 'visible' && v.paused && tryPlay()
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('pointerdown', kick)
    }
  }, [])

  // 260px radius circle at top-center. Transparent inside → the glow
  // behind the video shines through the U-cut.
  const uCutMask =
    'radial-gradient(circle 260px at 50% 0%, transparent 0, transparent 256px, black 260px)'

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      {/* Layer 1: violet glow BEHIND the video, visible through the U-cut */}
      <div
        className="absolute inset-x-0 top-0 h-96 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 500px 300px at 50% -20%, rgba(139, 92, 246, 0.55), rgba(139, 92, 246, 0.15) 40%, transparent 70%)',
        }}
      />

      {/* Layer 2: the video with the U cut */}
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

      {/* Layer 3: gentle center vignette so the form reads clearly */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.15) 70%, transparent 100%)',
        }}
      />
    </div>
  )
}

// Minimal /login backdrop: looping video on pitch black, with a
// U-shaped notch cut out of the top-center. No glows, no vignette.

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
      v.play().catch(() => {
        if (tries++ < 20) setTimeout(tryPlay, 250)
      })
    }
    if (v.readyState >= 2) tryPlay()
    else v.addEventListener('canplay', tryPlay, { once: true })

    const kick = () => { if (v.paused) tryPlay() }
    document.addEventListener('pointerdown', kick, { once: true })

    const onVis = () => document.visibilityState === 'visible' && v.paused && tryPlay()
    document.addEventListener('visibilitychange', onVis)

    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('pointerdown', kick)
    }
  }, [])

  // U-shaped cut at top-center. Transparent inside → pure black (the
  // parent's bg-black) shows through the notch.
  const uCutMask =
    'radial-gradient(circle 260px at 50% 0%, transparent 0, transparent 256px, black 260px)'

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
    </div>
  )
}

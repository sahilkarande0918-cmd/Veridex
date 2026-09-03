// Full-screen looping video backdrop for the landing page. No cut,
// with a uniform dark overlay so text sits legibly on top.

import { useEffect, useRef } from 'react'

export default function VideoBackdrop() {
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
      v.play().catch(() => { if (tries++ < 20) setTimeout(tryPlay, 250) })
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

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      <video
        ref={ref}
        src="/login-bg.mp4"
        autoPlay muted loop playsInline
        preload="auto"
        disablePictureInPicture
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Uniform dim so hero text is readable over the busy footage */}
      <div className="absolute inset-0 pointer-events-none bg-black/60" />
    </div>
  )
}

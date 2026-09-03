// Animated background for the auth (login) screen only.
// Four large blurred gradient orbs slowly drift, scale, and cross-fade.
// Pure CSS keyframes — no video asset, no WebGL, ~1 KB gzipped.

export default function AuthBackdrop() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
      <style>{`
        @keyframes veridex-orb-a { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(120px,-80px) scale(1.15); } }
        @keyframes veridex-orb-b { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-140px,60px) scale(0.9); } }
        @keyframes veridex-orb-c { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(80px,140px) scale(1.1); } }
        @keyframes veridex-orb-d { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-90px,-120px) scale(1.05); } }
        @keyframes veridex-grid   { from { background-position: 0 0; } to { background-position: 0 44px; } }
        .vx-orb { position:absolute; border-radius:9999px; filter: blur(80px); opacity:.55; mix-blend-mode: screen; will-change: transform; }
      `}</style>

      {/* faint grid drifts vertically for subtle motion */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          animation: 'veridex-grid 40s linear infinite',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      {/* four color orbs */}
      <div className="vx-orb" style={{ top: '-10%', left: '-10%', width: 560, height: 560, background: 'radial-gradient(circle, #7c3aed 0%, transparent 60%)', animation: 'veridex-orb-a 18s ease-in-out infinite' }} />
      <div className="vx-orb" style={{ top: '10%', right: '-10%', width: 520, height: 520, background: 'radial-gradient(circle, #06b6d4 0%, transparent 60%)', animation: 'veridex-orb-b 22s ease-in-out infinite' }} />
      <div className="vx-orb" style={{ bottom: '-15%', left: '15%', width: 640, height: 640, background: 'radial-gradient(circle, #ec4899 0%, transparent 60%)', animation: 'veridex-orb-c 26s ease-in-out infinite' }} />
      <div className="vx-orb" style={{ bottom: '-5%', right: '10%', width: 480, height: 480, background: 'radial-gradient(circle, #22d3ee 0%, transparent 60%)', animation: 'veridex-orb-d 20s ease-in-out infinite' }} />

      {/* darken the top for readability, and a bottom vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)' }} />
    </div>
  )
}

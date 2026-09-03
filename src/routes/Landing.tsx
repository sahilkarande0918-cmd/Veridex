import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import VideoBackdrop from '@/components/VideoBackdrop'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
}

const features: { title: string; body: string }[] = [
  { title: 'Every score shows its work',
    body:  'Backtested accuracy, sample size, and methodology sit next to the number. If we can\'t defend it, we don\'t show it.' },
  { title: 'AI grounded in real data',
    body:  'The chat never invents a price. It only summarizes numbers the backend just computed or freshly fetched.' },
  { title: 'No orders, no fee grabs',
    body:  'Analysis and tracking only. You place trades yourself on the broker you already use.' },
  { title: 'Walk-forward, not wishful',
    body:  'Time-series models trained on the past, tested on strictly-future windows. No look-ahead bias.' },
]

const groundRules: string[] = [
  'Never places buy or sell orders on your behalf.',
  'Every prediction or signal shows its methodology and accuracy inline.',
  'AI chat cannot originate market numbers — it summarizes computed data.',
  'Persistent disclaimer: not SEBI-registered investment advice.',
]

export default function Landing() {
  return (
    <main className="min-h-screen relative">
      <VideoBackdrop />
      <nav className="max-w-6xl mx-auto flex items-center justify-between p-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-violet-500" /> Veridex
        </div>
        <Link
          to="/login"
          className="text-sm px-4 h-9 inline-flex items-center rounded-lg bg-violet-600 hover:bg-violet-500 transition"
        >
          Sign in
        </Link>
      </nav>

      <motion.section
        initial="hidden" animate="show" variants={fadeUp}
        className="max-w-3xl mx-auto text-center px-6 pt-20 pb-24 space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neutral-800 text-xs text-neutral-400">
          <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
          For Indian retail investors
        </div>
        <h1 className="text-6xl font-semibold tracking-tight leading-none">
          Stock analysis you<br />can actually verify.
        </h1>
        <p className="text-neutral-200 text-lg max-w-xl mx-auto drop-shadow-lg">
          Live Upstox market data, transparent backtested signal accuracy,
          and AI explanations grounded in real computed numbers.
          Never a bare "buy this" tip.
        </p>
        <div className="pt-4">
          <Link
            to="/login"
            className="inline-flex h-12 px-6 items-center rounded-lg bg-violet-600 hover:bg-violet-500 font-medium transition"
          >
            Get started — free
          </Link>
        </div>
      </motion.section>

      <section className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-5">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp} transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-neutral-900 bg-neutral-950 p-6 space-y-2"
          >
            <div className="text-sm font-medium">{f.title}</div>
            <p className="text-sm text-neutral-500 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </section>

      <motion.section
        initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }}
        variants={fadeUp}
        className="max-w-3xl mx-auto px-6 py-10"
      >
        <div className="rounded-2xl border border-neutral-900 bg-neutral-950/80 backdrop-blur p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Ground rules</h2>
          <ul className="space-y-2 text-sm text-neutral-300">
            {groundRules.map((r) => (
              <li key={r} className="flex gap-3">
                <span className="mt-2 size-1.5 rounded-full bg-violet-500 shrink-0" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      <footer className="max-w-3xl mx-auto px-6 pb-10">
        <div className="rounded-xl border border-neutral-900 bg-neutral-950/80 backdrop-blur p-4 text-center">
          <p className="text-xs text-neutral-400">
            Not SEBI-registered investment advice. Educational/analytical tool only.
            Investments in securities are subject to market risk.
          </p>
        </div>
      </footer>
    </main>
  )
}

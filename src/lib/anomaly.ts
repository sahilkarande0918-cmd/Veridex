// Simple, transparent anomaly detection over OHLC candles.
//
// - Volume anomaly: z-score of today's volume vs the trailing window mean.
//   |z| >= 2 flags "unusual volume".
// - Price move:     today's close-to-close return in standard deviations
//   of the trailing daily-return series. |z| >= 2 flags "outsized move".
//
// Ponytail: no ML. Classical z-scores over a fixed window are defensible
// and every input is inspectable in the UI. If we ever need seasonality
// or regime awareness, that's a real model — different phase, different
// review bar.

import type { Candle } from './upstox'

export type AnomalyReport = {
  window: number
  volume: { latest: number; mean: number; std: number; z: number | null; flag: boolean }
  price:  { ret: number; mean_ret: number; std_ret: number; z: number | null; flag: boolean }
}

function mean(xs: number[]) { return xs.reduce((a, b) => a + b, 0) / xs.length }
function stddev(xs: number[], mu: number) {
  return Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, xs.length - 1))
}

export function analyze(candles: Candle[], window = 20): AnomalyReport | null {
  if (candles.length < window + 2) return null
  const sorted = [...candles].sort((a, b) => a.time - b.time)
  const latest = sorted.at(-1)!
  const prev   = sorted.at(-2)!

  // --- volume z-score (excludes latest bar from the reference set)
  const volWin = sorted.slice(-window - 1, -1).map((c) => c.volume)
  const muV = mean(volWin)
  const sdV = stddev(volWin, muV)
  const zV = sdV > 0 ? (latest.volume - muV) / sdV : null

  // --- price z-score on daily returns
  const rets = sorted.slice(-window - 2, -1).map((c, i, arr) => {
    if (i === 0) return null
    const p = arr[i - 1].close
    return p > 0 ? (c.close - p) / p : null
  }).filter((x): x is number => x !== null)
  const latestRet = prev.close > 0 ? (latest.close - prev.close) / prev.close : 0
  const muR = mean(rets)
  const sdR = stddev(rets, muR)
  const zR = sdR > 0 ? (latestRet - muR) / sdR : null

  return {
    window,
    volume: { latest: latest.volume, mean: muV, std: sdV, z: zV, flag: zV != null && Math.abs(zV) >= 2 },
    price:  { ret: latestRet, mean_ret: muR, std_ret: sdR, z: zR, flag: zR != null && Math.abs(zR) >= 2 },
  }
}

// self-check
declare const process: { env: Record<string, string | undefined> } | undefined
if (typeof process !== 'undefined' && process.env?.VERIDEX_SELFCHECK) {
  const flat: Candle[] = Array.from({ length: 25 }, (_, i) => ({
    time: i, open: 100, high: 100, low: 100, close: 100, volume: 1_000,
  }))
  // stable prior + a spike
  const spike: Candle[] = [...flat.slice(0, -1), { ...flat.at(-1)!, close: 110, volume: 10_000 }]
  const r = analyze(spike)!
  console.assert(r.volume.flag, 'spike should flag volume')
  console.assert(r.price.flag,  'spike should flag price')
  console.log('anomaly self-check ok')
}

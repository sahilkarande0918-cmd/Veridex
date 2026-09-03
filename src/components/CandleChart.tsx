import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, type IChartApi, type ISeriesApi, type Time } from 'lightweight-charts'
import type { Candle } from '@/lib/upstox'

export default function CandleChart({ candles }: { candles: Candle[] }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!wrapRef.current) return
    const chart = createChart(wrapRef.current, {
      layout:  { background: { color: '#0a0a0a' }, textColor: '#a3a3a3', fontSize: 11 },
      grid:    { vertLines: { color: '#1a1a1c' }, horzLines: { color: '#1a1a1c' } },
      rightPriceScale: { borderColor: '#26262a' },
      timeScale: { borderColor: '#26262a', timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: '#7c3aed' }, horzLine: { color: '#7c3aed' } },
      autoSize: true,
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      borderVisible: false,
    })
    chartRef.current = chart
    seriesRef.current = series
    return () => { chart.remove(); chartRef.current = null; seriesRef.current = null }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(
      candles.map((c) => ({
        time: c.time as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })),
    )
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  return <div ref={wrapRef} className="h-full w-full" />
}

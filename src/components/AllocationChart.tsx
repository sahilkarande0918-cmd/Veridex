import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'

export default function AllocationChart({
  slices,
}: {
  slices: { label: string; value: number }[]
}) {
  const options: ApexOptions = {
    chart: { type: 'donut', background: 'transparent' },
    theme: { mode: 'dark' },
    labels: slices.map((s) => s.label),
    colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#22c55e', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6', '#eab308', '#6366f1'],
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      labels: { colors: '#a3a3a3' },
      markers: { size: 5 },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            name:  { color: '#a3a3a3', fontSize: '11px' },
            value: { color: '#fafafa', fontSize: '18px', fontFamily: 'JetBrains Mono, ui-monospace, monospace' },
            total: {
              show: true,
              label: 'Total invested',
              color: '#a3a3a3',
              fontSize: '11px',
              formatter: (w) =>
                '₹' + w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
            },
          },
        },
      },
    },
    tooltip: {
      theme: 'dark',
      y: { formatter: (v: number) => '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
    },
  }
  const series = slices.map((s) => s.value)
  return <Chart options={options} series={series} type="donut" height={340} />
}

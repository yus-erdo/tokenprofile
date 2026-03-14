'use client'

import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface Props {
  data: {
    hourly: { hour: number; completions: number; tokens: number; cost: number }[]
    daily: { day: number; completions: number; tokens: number; cost: number }[]
  }
}

export function PeakHoursChart({ data }: Props) {
  const hourLabels = Array.from({ length: 24 }, (_, i) => String(i))
  const dayLabels = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

  const hourlyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 220 },
    plotOptions: { bar: { borderRadius: 2, columnWidth: '70%' } },
    xaxis: { categories: hourLabels },
    yaxis: { title: { text: '' } },
    dataLabels: { enabled: false },
  }

  const dailyOptions: ApexCharts.ApexOptions = {
    chart: { type: 'bar', height: 180 },
    plotOptions: { bar: { borderRadius: 2, horizontal: true, barHeight: '60%' } },
    xaxis: { categories: dayLabels },
    yaxis: { labels: { style: { fontSize: '10px' } } },
    dataLabels: { enabled: false },
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">~ activity by hour</h3>
        <ChartWrapper
          type="bar"
          height={220}
          options={hourlyOptions}
          series={[{ name: 'completions', data: data.hourly.map(h => h.completions) }]}
        />
      </div>
      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-600 font-mono-accent mb-2">~ activity by day</h3>
        <ChartWrapper
          type="bar"
          height={180}
          options={dailyOptions}
          series={[{ name: 'completions', data: data.daily.map(d => d.completions) }]}
        />
      </div>
    </div>
  )
}

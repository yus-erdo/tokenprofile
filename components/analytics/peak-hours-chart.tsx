'use client'

import { useEffect, useState } from 'react'
import { ChartWrapper } from '@/lib/charts/apex-wrapper'

interface PeakHoursData {
  hourly: { hour: number; completions: number; tokens: number; cost: number }[]
  daily: { day: number; completions: number; tokens: number; cost: number }[]
}

export function PeakHoursChart({ year }: { year: number }) {
  const [data, setData] = useState<PeakHoursData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/me/analytics/peak-hours?year=${year}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [year])

  if (loading || !data) return <div className="h-64 animate-pulse bg-gray-100 dark:bg-gray-900 rounded-lg" />

  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '0' : i < 10 ? `${i}` : `${i}`
  )

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
    xaxis: {},
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
          options={{
            ...dailyOptions,
            xaxis: { ...dailyOptions.xaxis, categories: dayLabels },
          }}
          series={[{ name: 'completions', data: data.daily.map(d => d.completions) }]}
        />
      </div>
    </div>
  )
}

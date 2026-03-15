'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { chartColors } from './chart-colors'
import type { Props as ApexChartProps } from 'react-apexcharts'

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false })

const MONO_FONT = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'

interface ChartWrapperProps extends Omit<ApexChartProps, 'options'> {
  options: ApexCharts.ApexOptions
}

export function ChartWrapper({ options, ...props }: ChartWrapperProps) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const colors = isDark ? chartColors.dark : chartColors.light

  const themedOptions: ApexCharts.ApexOptions = {
    ...options,
    theme: { mode: isDark ? 'dark' : 'light' },
    chart: {
      ...options.chart,
      background: 'transparent',
      toolbar: { show: false, ...options.chart?.toolbar },
      foreColor: colors.foreground,
      fontFamily: MONO_FONT,
    },
    grid: {
      borderColor: colors.gridLine,
      strokeDashArray: 3,
      ...options.grid,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      style: { fontFamily: MONO_FONT, fontSize: '11px' },
      ...options.tooltip,
    },
    xaxis: {
      ...options.xaxis,
      labels: {
        ...options.xaxis?.labels,
        style: {
          fontFamily: MONO_FONT,
          fontSize: '10px',
          colors: colors.muted,
          ...options.xaxis?.labels?.style,
        },
      },
      axisBorder: { color: colors.gridLine, ...options.xaxis?.axisBorder },
      axisTicks: { color: colors.gridLine, ...options.xaxis?.axisTicks },
    },
    yaxis: Array.isArray(options.yaxis) ? options.yaxis.map(y => ({
      ...y,
      labels: {
        ...y.labels,
        style: { fontFamily: MONO_FONT, fontSize: '10px', colors: [colors.muted], ...y.labels?.style },
      },
      title: y.title ? { ...y.title, style: { fontFamily: MONO_FONT, fontSize: '10px', color: colors.muted } } : undefined,
    })) : options.yaxis ? {
      ...(options.yaxis as ApexCharts.ApexYAxis),
      labels: {
        ...(options.yaxis as ApexCharts.ApexYAxis).labels,
        style: { fontFamily: MONO_FONT, fontSize: '10px', colors: [colors.muted], ...(options.yaxis as ApexCharts.ApexYAxis).labels?.style },
      },
    } : undefined,
    legend: {
      fontFamily: MONO_FONT,
      fontSize: '11px',
      labels: { colors: colors.muted },
      ...options.legend,
    },
    colors: options.colors || [...colors.series],
  }

  return <ReactApexChart options={themedOptions} {...props} />
}

export default ChartWrapper

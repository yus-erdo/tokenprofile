export const chartColors = {
  light: {
    primary: '#374151',
    secondary: '#6b7280',
    success: '#059669',
    warning: '#9ca3af',
    danger: '#d1d5db',
    muted: '#9ca3af',
    background: '#ffffff',
    foreground: '#374151',
    gridLine: '#f3f4f6',
    series: ['#374151', '#059669', '#6b7280', '#9ca3af', '#d1d5db'],
  },
  dark: {
    primary: '#d1d5db',
    secondary: '#9ca3af',
    success: '#34d399',
    warning: '#6b7280',
    danger: '#4b5563',
    muted: '#4b5563',
    background: '#0a0a0a',
    foreground: '#d1d5db',
    gridLine: '#1f2937',
    series: ['#d1d5db', '#34d399', '#9ca3af', '#6b7280', '#4b5563'],
  },
} as const

export type ThemeColors = typeof chartColors.light

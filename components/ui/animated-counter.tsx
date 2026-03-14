'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  format?: (value: number) => string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 1000,
  format = (v) => v.toLocaleString(),
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)
  const prevValue = useRef(0)
  const hasAnimated = useRef(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (hasAnimated.current && prevValue.current === value) return

    const start = hasAnimated.current ? prevValue.current : 0
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = start + (value - start) * eased
      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setDisplayValue(value)
        prevValue.current = value
        hasAnimated.current = true
      }
    }

    requestAnimationFrame(animate)
  }, [value, duration])

  return (
    <span ref={ref} className={className}>
      {format(Math.round(displayValue))}
    </span>
  )
}

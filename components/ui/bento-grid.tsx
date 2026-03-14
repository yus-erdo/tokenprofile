interface BentoGridProps {
  children: React.ReactNode
  className?: string
  cols?: 2 | 3 | 4
}

export function BentoGrid({ children, className = '', cols = 3 }: BentoGridProps) {
  const colsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid gap-4 ${colsClass[cols]} ${className}`}>
      {children}
    </div>
  )
}

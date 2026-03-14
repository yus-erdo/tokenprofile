interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function HeatmapSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="grid grid-cols-[repeat(53,1fr)] gap-[3px]">
        {Array.from({ length: 371 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full min-w-[8px]" />
        ))}
      </div>
    </div>
  )
}

export function CompletionItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-800">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  )
}

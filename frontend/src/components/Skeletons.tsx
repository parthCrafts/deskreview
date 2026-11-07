import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading documents">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  )
}

/** Placeholder layout while a document loads. */
export function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading document">
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Skeleton className="h-96 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}

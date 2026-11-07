import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { forwardRef, type ReactNode, useCallback } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ListSkeleton } from '@/components/Skeletons'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatRelative } from '@/lib/format'
import { STATUS_LABEL } from '@/lib/status'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { SearchBox } from './SearchBox'
import { StatusTabs } from './StatusTabs'
import { type StatusFilter, useDocuments, useListParams } from './useDocuments'

interface DocumentListProps {
  scope: 'mine' | 'all'
  basePath: '/documents' | '/review'
  emptyState: ReactNode
  defaultStatus?: StatusFilter
  selectedIndex?: number
}

/** A relative timestamp with the absolute time on hover. */
function When({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">—</span>
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </time>
  )
}

/** Status tabs, search, results (table or cards) and paging for a document list. */
export const DocumentList = forwardRef<HTMLInputElement, DocumentListProps>(function DocumentList(
  { scope, basePath, emptyState, defaultStatus = 'all', selectedIndex = -1 },
  searchRef,
) {
  const params = useListParams(defaultStatus)
  const navigate = useNavigate()
  const wide = useMediaQuery('(min-width: 640px)')
  const query = useDocuments({
    scope,
    status: params.status === 'all' ? undefined : params.status,
    q: params.q,
    page: params.page,
  })
  const setQ = useCallback((q: string) => params.set({ q }), [params])
  const data = query.data

  let body: ReactNode
  if (query.isPending) body = <ListSkeleton />
  else if (query.isError && !data) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else if (data && data.results.length === 0) {
    if (data.count > 0) {
      body = (
        <EmptyState
          title="Nothing on this page"
          description="The list changed since you opened this page."
          action={
            <Button variant="outline" onClick={() => params.set({ page: 1 })}>
              Back to first page
            </Button>
          }
        />
      )
    } else if (params.q) {
      body = (
        <EmptyState
          icon={SearchX}
          title={`No documents match “${params.q}”`}
          description="Try a different title or name."
          action={
            <Button variant="outline" onClick={() => params.set({ q: '' })}>
              Clear search
            </Button>
          }
        />
      )
    } else if (params.status !== 'all' && params.status !== defaultStatus) {
      body = <EmptyState title={`No ${STATUS_LABEL[params.status].toLowerCase()} documents`} />
    } else body = emptyState
  } else if (data) {
    const showSubmitter = scope === 'all'
    body = wide ? (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              {showSubmitter && <TableHead>Submitted by</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {!showSubmitter && <TableHead>Decided</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.results.map((doc, index) => (
              <TableRow
                key={doc.id}
                aria-selected={index === selectedIndex || undefined}
                data-selected={index === selectedIndex || undefined}
                className="cursor-pointer data-[selected]:bg-primary/5 data-[selected]:outline data-[selected]:outline-2 data-[selected]:-outline-offset-2 data-[selected]:outline-primary/40"
                onClick={() => navigate(`${basePath}/${doc.id}`)}
              >
                <TableCell className="max-w-0 w-full">
                  <Link
                    to={`${basePath}/${doc.id}`}
                    className="block truncate font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {doc.title}
                  </Link>
                  {doc.file && <span className="block truncate text-xs text-muted-foreground">{doc.file.name}</span>}
                </TableCell>
                {showSubmitter && <TableCell className="whitespace-nowrap">{doc.submitter.display_name}</TableCell>}
                <TableCell>
                  <StatusBadge status={doc.status} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <When iso={doc.created_at} />
                </TableCell>
                {!showSubmitter && (
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <When iso={doc.decided_at} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <ul className="space-y-2">
        {data.results.map((doc, index) => (
          <li key={doc.id}>
            <Link
              to={`${basePath}/${doc.id}`}
              className={cn(
                'block rounded-lg border p-3 hover:bg-muted/50',
                index === selectedIndex && 'border-primary/50 bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-medium break-words">{doc.title}</span>
                <StatusBadge status={doc.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {showSubmitter ? `${doc.submitter.display_name}, ` : 'Submitted '}
                <When iso={doc.created_at} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  const pageStart = data ? (data.page - 1) * data.page_size + 1 : 0
  const pageEnd = data ? pageStart + data.results.length - 1 : 0
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 overflow-x-auto px-1">
          <StatusTabs value={params.status} counts={data?.counts} onChange={(status) => params.set({ status })} />
        </div>
        <SearchBox ref={searchRef} value={params.q} onChange={setQ} />
      </div>
      <div className={cn(query.isFetching && !query.isPending && 'opacity-70 transition-opacity')}>{body}</div>
      {data && data.results.length > 0 && (data.next || data.previous) && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {pageStart}–{pageEnd} of {data.count}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous page"
              disabled={!data.previous}
              onClick={() => params.set({ page: data.previous ?? 1 })}
            >
              <ChevronLeft aria-hidden /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next page"
              disabled={!data.next}
              onClick={() => params.set({ page: data.next ?? params.page })}
            >
              Next <ChevronRight aria-hidden />
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
})

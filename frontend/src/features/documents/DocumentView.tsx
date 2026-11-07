import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/api/client'
import type { DocumentDetail } from '@/api/types'
import { DecisionStamp } from '@/components/DecisionStamp'
import { ErrorState } from '@/components/ErrorState'
import { FilePreview } from '@/components/FilePreview'
import { NotFoundPage } from '@/components/NotFoundPage'
import { DetailSkeleton } from '@/components/Skeletons'
import { StatusBadge } from '@/components/StatusBadge'
import { Timeline } from '@/components/Timeline'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useDocument } from './useDocument'

/** Back link, header, preview and side panel shared by the submitter and reviewer pages. */
export function DocumentLayout({
  doc,
  back,
  aside,
  below,
}: {
  doc: DocumentDetail
  back: { to: string; label: string }
  aside?: ReactNode
  below?: ReactNode
}) {
  return (
    <article className="space-y-6">
      <div>
        <Link to={back.to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {back.label}
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-x-3 gap-y-2">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{doc.title}</h1>
          <StatusBadge status={doc.status} className="mt-1.5" />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Submitted by {doc.submitter.display_name},{' '}
          <time dateTime={doc.created_at} title={formatDateTime(doc.created_at)}>
            {formatRelative(doc.created_at)}
          </time>
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section aria-label="Preview" className="overflow-hidden rounded-lg border bg-card">
            <FilePreview doc={doc} />
          </section>
          {below}
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6">
          {aside}
          <DecisionStamp doc={doc} />
          <Timeline events={doc.events} />
        </aside>
      </div>
    </article>
  )
}

/** Load a document and render loading, not-found and error states around `children`. */
export function DocumentLoader({ id, children }: { id: string; children: (doc: DocumentDetail) => ReactNode }) {
  const query = useDocument(id)
  if (query.isPending) return <DetailSkeleton />
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return <NotFoundPage title="Document not found" />
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  }
  return <>{children(query.data)}</>
}

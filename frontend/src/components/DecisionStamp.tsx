import { Clock } from 'lucide-react'
import type { DocumentDetail } from '@/api/types'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The decision rendered as an ink stamp, or a quiet waiting note while pending. */
export function DecisionStamp({ doc }: { doc: DocumentDetail }) {
  if (doc.status === 'pending') {
    return (
      <section aria-label="Decision" className="flex items-start gap-3 rounded-lg border border-dashed p-4">
        <Clock className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden />
        <p className="text-sm text-muted-foreground">Waiting for a reviewer's decision.</p>
      </section>
    )
  }
  const approved = doc.status === 'approved'
  return (
    <section aria-label="Decision" className="rounded-lg border p-4">
      <div
        className={cn(
          'inline-block -rotate-3 rounded-md border-[3px] px-3 py-1 text-lg font-bold tracking-[0.2em] uppercase opacity-90',
          approved ? 'border-approved text-approved' : 'border-rejected text-rejected',
        )}
        aria-hidden
      >
        {approved ? 'Approved' : 'Rejected'}
      </div>
      <p className="mt-3 text-sm">
        <span className="sr-only">{approved ? 'Approved' : 'Rejected'} </span>
        <span className="text-muted-foreground">{approved ? 'Approved' : 'Rejected'} by </span>
        <span className="font-medium">{doc.decided_by?.display_name ?? 'a reviewer'}</span>
      </p>
      {doc.decided_at && (
        <time dateTime={doc.decided_at} className="text-xs text-muted-foreground">
          {formatDateTime(doc.decided_at)}
        </time>
      )}
      {doc.decision_comment && (
        <blockquote className="mt-3 border-l-2 pl-3 text-sm whitespace-pre-wrap break-words">
          {doc.decision_comment}
        </blockquote>
      )}
    </section>
  )
}

import { AlertTriangle, Info, Loader2, OctagonAlert, RotateCw, Sparkles } from 'lucide-react'
import type { AssistReport, DocumentDetail, RiskFlag } from '@/api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { describeError } from '@/lib/errors'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildRejectionNote } from './note'
import { useAssist } from './useAssist'

const SEVERITY: Record<RiskFlag['severity'], { label: string; icon: typeof Info; className: string }> = {
  high: { label: 'High', icon: OctagonAlert, className: 'bg-rejected-bg text-rejected' },
  medium: { label: 'Medium', icon: AlertTriangle, className: 'bg-pending-bg text-pending' },
  low: { label: 'Low', icon: Info, className: 'bg-muted text-muted-foreground' },
}

const DECISION_LABEL: Record<AssistReport['suggested_decision'], string> = {
  approve: 'Approve',
  reject: 'Reject',
  needs_more_info: 'Needs more info',
}

/** A short titled list, omitted when empty. */
function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** The model's report, rendered strictly as text. */
function ReportView({ report }: { report: AssistReport }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">{report.summary}</p>
      <div className="rounded-md bg-muted/60 p-3 text-sm">
        <p>
          <span className="text-muted-foreground">Suggests: </span>
          <span className="font-medium">{DECISION_LABEL[report.suggested_decision]}</span>
        </p>
        <p className="mt-1 text-muted-foreground">{report.rationale}</p>
      </div>
      {report.risk_flags.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Risk flags</h3>
          <ul className="mt-1.5 space-y-2">
            {report.risk_flags.map((flag, i) => {
              const { label, icon: Icon, className } = SEVERITY[flag.severity]
              return (
                <li key={i} className="text-sm">
                  <span className={cn('mr-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)}>
                    <Icon className="size-3" aria-hidden />
                    {label}
                  </span>
                  <span className="font-medium">{flag.label}</span>
                  {flag.evidence && <span className="block pl-1 text-muted-foreground">{flag.evidence}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <ListBlock title="Missing" items={report.missing_items} />
      <ListBlock title="Key points" items={report.key_points} />
    </div>
  )
}

/** Advisory AI summary for reviewers; it can prefill a rejection note but never decides. */
export function AssistPanel({
  doc,
  onUseAsRejectionNote,
}: {
  doc: DocumentDetail
  onUseAsRejectionNote: (note: string) => void
}) {
  const { data, generate } = useAssist(doc.id)
  if (doc.status !== 'pending') return null
  const pending = generate.isPending

  let body
  if (pending) {
    body = (
      <div className="space-y-2" aria-busy="true">
        <p className="text-sm text-muted-foreground">Reading the document. This can take up to half a minute.</p>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  } else if (generate.isError) {
    body = (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>{describeError(generate.error)}</AlertDescription>
      </Alert>
    )
  } else if (data?.status === 'unavailable') {
    body = (
      <Alert>
        <Info aria-hidden />
        <AlertDescription>{data.message}</AlertDescription>
      </Alert>
    )
  } else if (data?.status === 'ok') {
    body = <ReportView report={data.report} />
  } else {
    body = (
      <p className="text-sm text-muted-foreground">
        Get a summary, missing items and risks to look at. It never approves or rejects anything.
      </p>
    )
  }

  const retryable = !data || data.status === 'ok' || !['not_configured', 'unsupported_content'].includes(data.reason)
  return (
    <section aria-labelledby="assist-heading" className="rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="assist-heading" className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI Assist
        </h2>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Advisory</span>
      </div>
      <div className="mt-3" aria-live="polite">
        {body}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!data && !pending && (
          <Button variant="outline" onClick={() => generate.mutate({})}>
            <Sparkles aria-hidden /> Generate summary
          </Button>
        )}
        {data?.status === 'ok' && doc.can_review && (
          <Button variant="outline" onClick={() => onUseAsRejectionNote(buildRejectionNote(data.report))}>
            Use as rejection note
          </Button>
        )}
        {data && retryable && !pending && (
          <Button variant="ghost" size="sm" onClick={() => generate.mutate({ refresh: data.status === 'ok' })}>
            <RotateCw aria-hidden /> {data.status === 'ok' ? 'Regenerate' : 'Try again'}
          </Button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {data?.status === 'ok' && (
        <div className="mt-3 space-y-0.5 text-xs text-muted-foreground">
          <p className="font-medium">{data.notice}</p>
          <p>
            Generated by {data.model}
            {data.cached ? ', saved ' : ' '}
            {formatRelative(data.generated_at)}.
          </p>
        </div>
      )}
    </section>
  )
}

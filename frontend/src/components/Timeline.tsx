import { CheckCircle2, FileUp, XCircle } from 'lucide-react'
import type { DocEvent } from '@/api/types'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const EVENT_STYLE = {
  submitted: { verb: 'submitted', icon: FileUp, tone: 'text-muted-foreground bg-muted' },
  approved: { verb: 'approved', icon: CheckCircle2, tone: 'text-approved bg-approved-bg' },
  rejected: { verb: 'rejected', icon: XCircle, tone: 'text-rejected bg-rejected-bg' },
} as const

/** The document's append-only history, oldest first. */
export function Timeline({ events }: { events: DocEvent[] }) {
  return (
    <section aria-labelledby="history-heading">
      <h2 id="history-heading" className="mb-3 text-sm font-medium">
        History
      </h2>
      <ol aria-labelledby="history-heading" className="relative space-y-4">
        {events.map((event, index) => {
          const { verb, icon: Icon, tone } = EVENT_STYLE[event.type]
          return (
            <li key={event.id} className="relative flex gap-3">
              {index < events.length - 1 && (
                <span className="absolute left-3.5 top-8 bottom-[-1rem] w-px bg-border" aria-hidden />
              )}
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', tone)}>
                <Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm">
                  <span className="font-medium">{event.actor?.display_name ?? 'System'}</span> {verb}
                </p>
                <time dateTime={event.created_at} title={formatDateTime(event.created_at)} className="text-xs text-muted-foreground">
                  {formatRelative(event.created_at)}
                </time>
                {event.comment && (
                  <blockquote className="mt-2 border-l-2 pl-3 text-sm whitespace-pre-wrap break-words text-muted-foreground">
                    {event.comment}
                  </blockquote>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

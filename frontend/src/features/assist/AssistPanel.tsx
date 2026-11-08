import { ChevronRight, Info, RotateCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AssistReport, AssistResponse, DocumentDetail, RiskFlag } from '@/api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/useMe'
import { describeError } from '@/lib/errors'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { buildApprovalNote, buildRejectionNote } from './note'
import { THINKING_WORDS } from './thinking'
import { useAssist } from './useAssist'

const SEVERITY: Record<RiskFlag['severity'], { label: string; dot: string; className: string }> = {
  high: { label: 'High', dot: '🔴', className: 'bg-rejected-bg text-rejected' },
  medium: { label: 'Medium', dot: '🟠', className: 'bg-pending-bg text-pending' },
  low: { label: 'Low', dot: '🟡', className: 'bg-muted text-muted-foreground' },
}

const DECISION: Record<
  AssistReport['suggested_decision'],
  { emoji: string; label: string; past: string; chip: string; box: string }
> = {
  approve: {
    emoji: '✅',
    label: 'Leans approve',
    past: 'Leaned approve',
    chip: 'border-approved/30 bg-approved-bg text-approved',
    box: 'border-approved/30 bg-approved-bg',
  },
  reject: {
    emoji: '⛔',
    label: 'Leans reject',
    past: 'Leaned reject',
    chip: 'border-rejected/30 bg-rejected-bg text-rejected',
    box: 'border-rejected/30 bg-rejected-bg',
  },
  needs_more_info: {
    emoji: '🤔',
    label: 'Needs more info',
    past: 'Needed more info',
    chip: 'border-pending/30 bg-pending-bg text-pending',
    box: 'border-pending/30 bg-pending-bg',
  },
}

/** After this long, the server has started its faster backup model (AI_HEDGE_SECONDS + a beat). */
const BACKUP_HINT_SECONDS = 5

export type NoteDecision = 'approve' | 'reject'
type OkResponse = Extract<AssistResponse, { status: 'ok' }>

/** Which decision the AI's note belongs to: an approve suggestion approves, anything else rejects. */
function noteFor(report: AssistReport): { decision: NoteDecision; label: string; note: string } {
  return report.suggested_decision === 'approve'
    ? { decision: 'approve', label: 'Use as approval note', note: buildApprovalNote(report) }
    : { decision: 'reject', label: 'Use as rejection note', note: buildRejectionNote(report) }
}

/** A random thinking word that differs from the current one. */
function nextWord(current: string): string {
  const choices = THINKING_WORDS.filter((w) => w !== current)
  return choices[Math.floor(Math.random() * choices.length)]
}

/** Split a leading emoji off a line so it can sit in its own column: ["💵", "Fees: $4,200"]. */
function splitEmoji(text: string): [string | null, string] {
  const first = new Intl.Segmenter().segment(text)[Symbol.iterator]().next().value?.segment ?? ''
  if (first && /\p{Extended_Pictographic}/u.test(first)) return [first, text.slice(first.length).trimStart()]
  return [null, text]
}

/** Rotating "Analyzing…" status with a shimmer, an elapsed timer and a note if it runs long. */
function AssistThinking({ skeleton = true }: { skeleton?: boolean }) {
  const [word, setWord] = useState(THINKING_WORDS[0])
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const words = window.setInterval(() => setWord(nextWord), 1400)
    const clock = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250)
    return () => {
      window.clearInterval(words)
      window.clearInterval(clock)
    }
  }, [])
  return (
    <div aria-busy="true" className="space-y-2.5">
      <p className="sr-only">Generating the AI summary.</p>
      <div className="flex items-center gap-2" aria-hidden>
        <Sparkles className="assist-sparkle size-4 shrink-0 text-primary" />
        <span key={word} className="assist-shimmer fade-in slide-in-from-bottom-1 text-sm font-medium">
          {word}…
        </span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{seconds}s</span>
      </div>
      {skeleton && (
        <div className="space-y-2" aria-hidden>
          <div className="assist-skeleton h-3 w-full rounded-full" />
          <div className="assist-skeleton h-3 w-11/12 rounded-full" />
          <div className="assist-skeleton h-3 w-4/6 rounded-full" />
        </div>
      )}
      {seconds >= BACKUP_HINT_SECONDS && (
        <p className="animate-in fade-in text-xs text-muted-foreground">
          Taking a moment, so a faster backup model has joined in.
        </p>
      )}
    </div>
  )
}

/** A heading with an emoji marker for one block of the brief. */
function BlockHeading({ emoji, children }: { emoji: string; children: string }) {
  return (
    <h3 className="flex items-center gap-1.5 text-sm font-medium">
      <span aria-hidden>{emoji}</span>
      {children}
    </h3>
  )
}

/** Bullet lines, each with its own emoji (from the model) or a plain dot. */
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((item, i) => {
        const [emoji, text] = splitEmoji(item)
        return (
          <li key={i} className="flex gap-2 text-sm leading-snug">
            <span aria-hidden className="w-5 shrink-0 text-center">
              {emoji ?? '•'}
            </span>
            <span>{text}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** The one-line TL;DR with its emoji in a gutter. */
function Summary({ report, className }: { report: AssistReport; className?: string }) {
  const [emoji, summary] = splitEmoji(report.summary)
  return (
    <div className={cn('flex gap-2', className)}>
      <span aria-hidden className="leading-6">
        {emoji ?? '📄'}
      </span>
      <p className="leading-6 font-medium">{summary}</p>
    </div>
  )
}

/** A small rounded label. */
function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', className)}>
      {children}
    </span>
  )
}

/** The full brief, rendered strictly as text: TL;DR, verdict, risks, missing items, key points. */
function ReportView({ report, decided }: { report: AssistReport; decided: boolean }) {
  const decision = DECISION[report.suggested_decision]
  return (
    <div className="space-y-5">
      <Summary report={report} className="text-[0.95rem]" />
      <div className={cn('rounded-lg border p-3 text-sm', decision.box)}>
        <p className="flex items-center gap-1.5">
          <span aria-hidden>{decision.emoji}</span>
          <span className="font-semibold">{decided ? decision.past : decision.label}</span>
        </p>
        <p className="mt-1 text-foreground/80">{report.rationale}</p>
      </div>
      {report.risk_flags.length > 0 && (
        <div>
          <BlockHeading emoji="⚠️">Risks</BlockHeading>
          <ul className="mt-1.5 space-y-2">
            {report.risk_flags.map((flag, i) => {
              const { label, dot, className } = SEVERITY[flag.severity]
              return (
                <li key={i} className="text-sm leading-snug">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        className,
                      )}
                    >
                      <span aria-hidden className="text-[0.6rem]">
                        {dot}
                      </span>
                      <span>{label}</span>
                    </span>
                    <span className="font-medium">{flag.label}</span>
                  </span>
                  {flag.evidence && (
                    <span className="mt-1 block border-l-2 pl-2 text-muted-foreground italic">{flag.evidence}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {report.missing_items.length > 0 && (
        <div>
          <BlockHeading emoji="🧩">Missing</BlockHeading>
          <Bullets items={report.missing_items} />
        </div>
      )}
      {report.key_points.length > 0 && (
        <div>
          <BlockHeading emoji="📌">Key points</BlockHeading>
          <Bullets items={report.key_points} />
        </div>
      )}
    </div>
  )
}

/** "AI generated 20 minutes ago"; the model and exact time are on hover. */
function SavedLine({ data }: { data: OkResponse }) {
  const ago = formatRelative(data.generated_at)
  return (
    <p className="text-xs text-muted-foreground" title={`${data.model} · ${formatDateTime(data.generated_at)}`}>
      AI generated <time dateTime={data.generated_at}>{ago === 'now' ? 'just now' : ago}</time>
    </p>
  )
}

/** The compact brief in the decision column: TL;DR, the AI's lean and what needs a look. */
function BriefSummary({ report, decided }: { report: AssistReport; decided: boolean }) {
  const decision = DECISION[report.suggested_decision]
  const risks = report.risk_flags.length
  const highRisk = report.risk_flags.some((f) => f.severity === 'high')
  const missing = report.missing_items.length
  return (
    <div className="space-y-2.5">
      <Summary report={report} className="text-sm" />
      <div className="flex flex-wrap gap-1.5">
        <Chip className={cn('font-semibold', decision.chip)}>
          <span aria-hidden>{decision.emoji}</span> {decided ? decision.past : decision.label}
        </Chip>
        {risks > 0 && (
          <Chip className={highRisk ? 'border-rejected/30 bg-rejected-bg text-rejected' : 'bg-background'}>
            <span aria-hidden>⚠️</span> {risks} {risks === 1 ? 'risk' : 'risks'}
          </Chip>
        )}
        {missing > 0 && (
          <Chip className="bg-background">
            <span aria-hidden>🧩</span> {missing} missing
          </Chip>
        )}
      </div>
    </div>
  )
}

/**
 * Advisory AI brief for the decision column. Reviewers generate and regenerate it and can turn
 * its reason into an approval or rejection note; admins see the saved brief read-only.
 * It never approves or rejects anything itself.
 */
export function AssistPanel({
  doc,
  onUseNote,
}: {
  doc: DocumentDetail
  onUseNote?: (decision: NoteDecision, note: string) => void
}) {
  const { data: me } = useMe()
  const { saved, generate } = useAssist(doc.id)
  const [open, setOpen] = useState(false)

  const isPending = doc.status === 'pending'
  const canGenerate = me?.role === 'reviewer' && isPending
  const canUseNote = isPending && doc.can_review && !!onUseNote
  const brief = saved.data?.status === 'ok' ? saved.data : null
  const busy = generate.isPending
  const failure =
    !busy && generate.isError
      ? describeError(generate.error)
      : !busy && generate.data?.status === 'unavailable'
        ? generate.data.message
        : null
  const retryable = !(
    generate.data?.status === 'unavailable' && ['not_configured', 'unsupported_content'].includes(generate.data.reason)
  )

  if (saved.isPending) {
    return (
      <section aria-label="AI summary loading" className="space-y-2 rounded-lg border p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </section>
    )
  }
  // Nothing saved and nothing this user can do about it: stay out of the way.
  if (!brief && !canGenerate && !busy) return null

  const note = brief ? noteFor(brief.report) : null
  const regenerate = () => generate.mutate({ refresh: true })

  return (
    <section
      aria-labelledby="assist-heading"
      className="rounded-lg border border-primary/20 bg-linear-to-br from-primary/[0.07] to-card to-60% p-4"
    >
      <div className="flex items-center gap-2">
        <h2 id="assist-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden /> AI summary
        </h2>
        {brief && canGenerate && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto text-muted-foreground"
            onClick={regenerate}
            disabled={busy}
            title="Regenerate"
            aria-label="Regenerate summary"
          >
            <RotateCw className={cn(busy && 'animate-spin')} aria-hidden />
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-3" aria-live="polite">
        {brief ? (
          <>
            {busy && <AssistThinking skeleton={false} />}
            <div className={cn('transition-opacity', busy && 'pointer-events-none opacity-50')}>
              <BriefSummary report={brief.report} decided={!isPending} />
            </div>
          </>
        ) : busy ? (
          <AssistThinking />
        ) : (
          <p className="text-sm text-muted-foreground">
            A 20-second read: what it is, what's missing and what to watch for.
          </p>
        )}
        {failure && (
          <Alert>
            <Info aria-hidden />
            <AlertDescription>
              {failure}
              {brief && ' The previous summary is still shown.'}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {!brief && !busy && canGenerate && (
        <Button className="mt-3 w-full" onClick={() => generate.mutate({})} disabled={!retryable}>
          <Sparkles aria-hidden /> {failure ? 'Try again' : 'Summarize with AI'}
        </Button>
      )}

      {brief && !busy && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setOpen(true)}>
            Full summary <ChevronRight aria-hidden />
          </Button>
          {canUseNote && note && (
            <Button variant="outline" size="sm" onClick={() => onUseNote(note.decision, note.note)}>
              {note.label}
            </Button>
          )}
        </div>
      )}
      {brief && (
        <div className="mt-2">
          <SavedLine data={brief} />
        </div>
      )}

      {brief && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="top-0 right-0 left-auto flex h-dvh w-full max-w-md translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-md data-open:zoom-in-100 data-open:slide-in-from-right data-closed:zoom-out-100 data-closed:slide-out-to-right">
            <DialogHeader className="border-b p-4 pr-12">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden /> AI summary
              </DialogTitle>
              <DialogDescription>
                {doc.title} · {brief.notice}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-4">
              <ReportView report={brief.report} decided={!isPending} />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 p-4">
              <SavedLine data={brief} />
              <div className="ml-auto flex gap-2">
                {canGenerate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false)
                      regenerate()
                    }}
                  >
                    <RotateCw aria-hidden /> Regenerate
                  </Button>
                )}
                {canUseNote && note && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setOpen(false)
                      onUseNote(note.decision, note.note)
                    }}
                  >
                    {note.label}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

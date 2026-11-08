import { Check, X } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'
import { ApiError } from '@/api/client'
import type { DocumentDetail } from '@/api/types'
import { Kbd } from '@/components/Kbd'
import { Button } from '@/components/ui/button'
import { useMe } from '@/features/auth/useMe'
import { toastApiError } from '@/lib/errors'
import { useHotkeys } from '@/lib/hotkeys'
import { ApproveDialog } from './ApproveDialog'
import { RejectDialog } from './RejectDialog'
import { useReviewDocument } from './useReviewDocument'

export interface ReviewActionsHandle {
  openApprove: (prefill?: string) => void
  openReject: (prefill?: string) => void
}

/** Why the current user can't act on this document, or null if they can. */
function blockedReason(doc: DocumentDetail, meId?: number): string | null {
  if (doc.can_review) return null
  if (doc.submitter.id === meId) return "You can't review your own submission."
  return "You can't review this document."
}

/** Approve and Reject buttons with their dialogs and the a/r shortcuts. */
export const ReviewActions = forwardRef<ReviewActionsHandle, { doc: DocumentDetail; onDecided?: () => void }>(
  function ReviewActions({ doc, onDecided }, ref) {
    const { data: me } = useMe()
    const review = useReviewDocument(doc.id)
    const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
    const [prefill, setPrefill] = useState('')
    const reason = blockedReason(doc, me?.id)
    const close = () => setDialog(null)

    const open = (which: 'approve' | 'reject', note = '') => {
      if (reason) return
      setPrefill(note)
      setDialog(which)
    }
    const openApprove = (note?: string) => open('approve', note)
    const openReject = (note?: string) => open('reject', note)
    useImperativeHandle(ref, () => ({ openApprove, openReject }))
    useHotkeys({ a: () => openApprove(), r: () => openReject() }, { enabled: !reason })

    const decide = async (decision: 'approve' | 'reject', comment: string | null) => {
      try {
        await review.mutateAsync({ decision, comment })
        close()
        onDecided?.()
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) close()
        throw error
      }
    }

    if (doc.status !== 'pending') return null
    return (
      <section aria-label="Decision actions" className="space-y-3 rounded-lg border bg-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!!reason} onClick={() => openApprove()} aria-keyshortcuts="a">
            <Check aria-hidden /> Approve <Kbd>a</Kbd>
          </Button>
          <Button variant="destructive" disabled={!!reason} onClick={() => openReject()} aria-keyshortcuts="r">
            <X aria-hidden /> Reject <Kbd>r</Kbd>
          </Button>
        </div>
        {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
        <ApproveDialog
          open={dialog === 'approve'}
          onOpenChange={(open) => !open && close()}
          title={doc.title}
          initialComment={prefill}
          pending={review.isPending}
          onConfirm={(comment) =>
            decide('approve', comment).catch((error) => {
              if (!(error instanceof ApiError && error.status === 409)) toastApiError(error)
            })
          }
        />
        <RejectDialog
          open={dialog === 'reject'}
          onOpenChange={(open) => !open && close()}
          title={doc.title}
          initialComment={prefill}
          onConfirm={(comment) => decide('reject', comment)}
        />
      </section>
    )
  },
)

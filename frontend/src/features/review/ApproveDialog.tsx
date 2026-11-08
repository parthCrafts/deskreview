import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { CharCount } from '@/components/CharCount'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { hasControlChars } from '@/lib/validation'

const MAX_COMMENT = 2000

/** The approval form; mounted only while the dialog is open, so it starts empty each time. */
function ApproveForm({
  title,
  initialComment,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string
  initialComment: string
  pending: boolean
  onCancel: () => void
  onConfirm: (comment: string | null) => void
}) {
  const [comment, setComment] = useState(initialComment)
  const error = hasControlChars(comment) ? 'Comment contains control characters. Paste it as plain text.' : null
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!pending && !error) onConfirm(comment.trim() || null)
      }}
    >
      <DialogHeader>
        <DialogTitle>Approve this document?</DialogTitle>
        <DialogDescription>“{title}” will be marked approved. Decisions are final.</DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="approve-comment">Comment (optional)</Label>
        <Textarea
          id="approve-comment"
          rows={3}
          maxLength={MAX_COMMENT}
          value={comment}
          aria-invalid={!!error}
          aria-describedby={error ? 'approve-comment-error approve-comment-count' : 'approve-comment-count'}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="flex justify-between gap-4 text-sm">
          {error ? (
            <p id="approve-comment-error" className="text-destructive">
              {error}
            </p>
          ) : (
            <span />
          )}
          <CharCount id="approve-comment-count" length={comment.trim().length} max={MAX_COMMENT} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !!error}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Approving…
            </>
          ) : (
            'Approve document'
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Confirm an approval with an optional comment, optionally prefilled (e.g. from AI Assist). */
export function ApproveDialog({
  open,
  onOpenChange,
  title,
  initialComment = '',
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialComment?: string
  pending: boolean
  onConfirm: (comment: string | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ApproveForm
          title={title}
          initialComment={initialComment}
          pending={pending}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  )
}

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
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

const MAX_COMMENT = 2000

/** The approval form; mounted only while the dialog is open, so it starts empty each time. */
function ApproveForm({
  title,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string
  pending: boolean
  onCancel: () => void
  onConfirm: (comment: string | null) => void
}) {
  const [comment, setComment] = useState('')
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!pending) onConfirm(comment.trim() || null)
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
          onChange={(e) => setComment(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
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

/** Confirm an approval with an optional comment. */
export function ApproveDialog({
  open,
  onOpenChange,
  title,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  pending: boolean
  onConfirm: (comment: string | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ApproveForm title={title} pending={pending} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  )
}

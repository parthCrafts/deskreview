import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
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
import { toastApiError } from '@/lib/errors'
import { applyServerErrors } from '@/lib/forms'
import { hasControlChars } from '@/lib/validation'
import { ApiError } from '@/api/client'

export const MIN_REJECT_COMMENT = 10
export const MAX_COMMENT = 2000

const rejectSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'A comment is required to reject.')
    .min(MIN_REJECT_COMMENT, `Give the submitter a bit more detail: at least ${MIN_REJECT_COMMENT} characters.`)
    .max(MAX_COMMENT, 'Comment must be at most 2,000 characters.')
    .refine((c) => !hasControlChars(c), 'Comment contains control characters. Paste it as plain text.'),
})
type RejectValues = z.infer<typeof rejectSchema>

/** Reject with a required reason; server field errors land on the reason field. */
export function RejectDialog({
  open,
  onOpenChange,
  title,
  initialComment = '',
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  initialComment?: string
  onConfirm: (comment: string) => Promise<unknown>
}) {
  const form = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { comment: '' },
  })
  const { errors, isSubmitting } = form.formState
  const length = (useWatch({ control: form.control, name: 'comment' }) ?? '').trim().length
  useEffect(() => {
    if (open) form.reset({ comment: initialComment })
  }, [open, initialComment, form])

  const submit = async ({ comment }: RejectValues) => {
    try {
      await onConfirm(comment)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) return
      if (!applyServerErrors(error, form.setError, ['comment'])) toastApiError(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form noValidate className="space-y-4" onSubmit={(e) => form.handleSubmit(submit)(e)}>
          <DialogHeader>
            <DialogTitle>Reject this document?</DialogTitle>
            <DialogDescription>
              Tell the submitter what to fix in “{title}”. They'll see your reason on the document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-comment">Reason</Label>
            <Textarea
              id="reject-comment"
              rows={5}
              aria-invalid={!!errors.comment}
              placeholder="e.g. Please attach the signed data processing addendum."
              aria-describedby={errors.comment ? 'reject-comment-error reject-comment-count' : 'reject-comment-count'}
              {...form.register('comment')}
            />
            <div className="flex justify-between gap-4 text-sm">
              {errors.comment ? (
                <p id="reject-comment-error" className="text-destructive">
                  {errors.comment.message}
                </p>
              ) : (
                <span />
              )}
              <CharCount id="reject-comment-count" length={length} max={MAX_COMMENT} min={MIN_REJECT_COMMENT} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Rejecting…
                </>
              ) : (
                'Reject document'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

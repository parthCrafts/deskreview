import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
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
import { ApiError } from '@/api/client'

const rejectSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, 'A comment is required to reject.')
    .max(2000, 'Comment must be at most 2,000 characters.'),
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
  const form = useForm<RejectValues>({ resolver: zodResolver(rejectSchema), defaultValues: { comment: '' } })
  const { errors, isSubmitting } = form.formState
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
              aria-describedby={errors.comment ? 'reject-comment-error' : undefined}
              {...form.register('comment')}
            />
            {errors.comment && (
              <p id="reject-comment-error" className="text-sm text-destructive">
                {errors.comment.message}
              </p>
            )}
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

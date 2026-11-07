import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useRef } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toastApiError } from '@/lib/errors'
import { applyServerErrors } from '@/lib/forms'
import { FileDropzone } from './FileDropzone'
import { MAX_TEXT, submitSchema, type SubmitValues } from './schema'
import { useSubmitDocument } from './useSubmitDocument'

const FIELDS = ['title', 'text', 'file'] as const

/** Submit a document as an uploaded file or written text. */
export function SubmitPage() {
  const submit = useSubmitDocument()
  const inFlight = useRef(false)
  const form = useForm<SubmitValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: { title: '', mode: 'file', text: '', file: null },
  })
  const { errors, isSubmitting } = form.formState
  const mode = useWatch({ control: form.control, name: 'mode' })
  const textLength = useWatch({ control: form.control, name: 'text' }).length
  const busy = isSubmitting || submit.isPending

  const onSubmit = async (values: SubmitValues) => {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await submit.mutateAsync(values)
    } catch (error) {
      if (!applyServerErrors(error, form.setError, FIELDS, 'file')) toastApiError(error)
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Submit a document" description="It goes straight into the review queue." />
      <form
        noValidate
        onSubmit={(event) => form.handleSubmit(onSubmit)(event)}
        className="space-y-6 rounded-xl border bg-card p-5 sm:p-6"
      >
        {errors.root?.server && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.server.message}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="e.g. Q3 vendor contract"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
            {...form.register('title')}
          />
          {errors.title && (
            <p id="title-error" className="text-sm text-destructive">
              {errors.title.message}
            </p>
          )}
        </div>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            form.setValue('mode', value as SubmitValues['mode'])
            form.clearErrors(['text', 'file'])
          }}
        >
          <TabsList>
            <TabsTrigger value="file">Upload file</TabsTrigger>
            <TabsTrigger value="text">Write text</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="pt-3">
            <Controller
              control={form.control}
              name="file"
              render={({ field }) => (
                <FileDropzone
                  value={field.value}
                  onChange={(file) => {
                    field.onChange(file)
                    if (file) form.trigger('file')
                    else form.clearErrors('file')
                  }}
                  error={errors.file?.message}
                />
              )}
            />
          </TabsContent>
          <TabsContent value="text" className="space-y-1.5 pt-3">
            <Label htmlFor="text">Text</Label>
            <Textarea
              id="text"
              rows={10}
              placeholder="Paste or write the document here."
              aria-invalid={!!errors.text}
              aria-describedby={errors.text ? 'text-error' : 'text-count'}
              {...form.register('text')}
            />
            <div className="flex justify-between gap-4 text-sm">
              {errors.text ? (
                <p id="text-error" className="text-destructive">
                  {errors.text.message}
                </p>
              ) : (
                <span />
              )}
              <span id="text-count" className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {textLength.toLocaleString()} / {MAX_TEXT.toLocaleString()}
              </span>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" aria-hidden /> Submitting…
              </>
            ) : (
              'Submit for review'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

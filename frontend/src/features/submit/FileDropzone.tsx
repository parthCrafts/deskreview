import { FileText, UploadCloud, X } from 'lucide-react'
import { type DragEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ALLOWED_EXTENSIONS } from './schema'

interface FileDropzoneProps {
  value: File | null
  onChange: (file: File | null) => void
  error?: string
  id?: string
}

/** Drag-and-drop or click-to-browse file picker with native events only. */
export function FileDropzone({ value, onChange, error, id = 'file' }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const errorId = `${id}-error`

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onChange(file)
  }

  return (
    <div className="space-y-1.5">
      {value ? (
        <div
          className={cn('flex items-center gap-3 rounded-lg border bg-muted/40 p-3', error && 'border-destructive')}
          aria-describedby={error ? errorId : undefined}
        >
          <FileText className="size-8 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{value.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(value.size)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${value.name}`}
            onClick={() => {
              onChange(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <div
          data-testid="dropzone"
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          }}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border',
            error && !dragging && 'border-destructive/60',
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm">
            <span className="font-medium">Drag a file here</span> or{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              aria-describedby={error ? errorId : `${id}-hint`}
              onClick={() => inputRef.current?.click()}
            >
              browse your computer
            </Button>
          </p>
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            PDF, PNG, JPEG, TXT or Markdown, up to 5 MB
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        id={id}
        type="file"
        aria-label="Choose file"
        className="sr-only"
        tabIndex={-1}
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onChange(file)
        }}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

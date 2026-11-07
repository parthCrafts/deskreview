import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { apiFetch } from '@/api/client'
import type { DocumentDetail } from '@/api/types'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBytes } from '@/lib/format'

const preClass = 'max-h-[70vh] overflow-auto p-4 text-sm leading-relaxed whitespace-pre-wrap break-words font-sans'

/** A .txt or .md file fetched as plain text (never rendered as HTML or markdown). */
function TextFile({ url }: { url: string }) {
  const text = useQuery({
    queryKey: ['file-text', url],
    queryFn: ({ signal }) => apiFetch<string>(`${url}?disposition=inline`, { signal, responseType: 'text' }),
  })
  if (text.isPending) return <Skeleton className="m-4 h-40" />
  if (text.isError) return <ErrorState error={text.error} onRetry={() => text.refetch()} />
  return <pre className={preClass}>{text.data}</pre>
}

/** Inline preview by content type, plus a download link for files. */
export function FilePreview({ doc }: { doc: DocumentDetail }) {
  if (doc.kind === 'text' || !doc.file) return <pre className={preClass}>{doc.text}</pre>
  const { file } = doc
  const inline = `${file.url}?disposition=inline`
  let preview
  if (file.content_type.startsWith('text/')) preview = <TextFile url={file.url} />
  else if (file.content_type.startsWith('image/'))
    preview = <img src={inline} alt={doc.title} className="mx-auto max-h-[70vh] object-contain p-4" />
  else
    preview = (
      <>
        <iframe src={inline} title={doc.title} className="h-[70vh] w-full bg-muted" />
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          If the PDF doesn't display on your device, download it instead.
        </p>
      </>
    )
  return (
    <div>
      {preview}
      <div className="flex items-center justify-between gap-3 border-t p-3">
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {file.name}, {formatBytes(file.size)}
        </span>
        <a
          href={file.url}
          download={file.name}
          aria-label={`Download ${file.name}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Download className="size-4" aria-hidden /> Download
        </a>
      </div>
    </div>
  )
}

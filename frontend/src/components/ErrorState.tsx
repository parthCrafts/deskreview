import { AlertTriangle, RotateCw } from 'lucide-react'
import { ApiError } from '@/api/client'
import { Button } from '@/components/ui/button'

/** Inline error with the reason and a retry button. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null
  const title = apiError?.code === 'network_error' ? "Can't reach the server" : "Couldn't load this"
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{apiError?.message ?? 'Something went wrong.'}</p>
          {apiError && apiError.status >= 500 && apiError.requestId && (
            <p className="mt-1 text-xs text-muted-foreground">Reference: {apiError.requestId}</p>
          )}
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
              <RotateCw aria-hidden /> Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

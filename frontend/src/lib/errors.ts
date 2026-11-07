import { toast } from 'sonner'
import { ApiError } from '@/api/client'

/** Describe an API error for a toast, adding the request id for server errors. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong.'
  if (error.status >= 500 && error.requestId) return `${error.message} (ref ${error.requestId})`
  return error.message
}

/** Show an error toast for an API failure. */
export function toastApiError(error: unknown): void {
  const isNetwork = error instanceof ApiError && error.code === 'network_error'
  toast.error(describeError(error), isNetwork ? { id: 'network-error' } : undefined)
}

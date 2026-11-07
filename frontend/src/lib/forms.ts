import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError } from '@/api/client'

/** Put server validation errors onto form fields; returns false if the error isn't field-shaped. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
  fileField?: Path<T>,
): boolean {
  if (!(error instanceof ApiError)) return false
  if (fileField && (error.status === 413 || error.status === 415)) {
    setError(fileField, { type: 'server', message: error.message })
    return true
  }
  const entries = Object.entries(error.fields)
  if (error.status !== 400 || entries.length === 0) return false
  let focused = false
  const unknown: string[] = []
  for (const [name, messages] of entries) {
    if ((fieldNames as readonly string[]).includes(name)) {
      setError(name as Path<T>, { type: 'server', message: messages.join(' ') }, { shouldFocus: !focused })
      focused = true
    } else {
      unknown.push(...messages)
    }
  }
  if (unknown.length) setError('root.server' as Path<T>, { type: 'server', message: unknown.join(' ') })
  return true
}

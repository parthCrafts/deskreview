import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { DocumentDetail } from '@/api/types'

/** Fetch one document with its timeline. */
export function useDocument(id: string) {
  return useQuery({
    queryKey: qk.document(id),
    queryFn: ({ signal }) => apiFetch<DocumentDetail>(`/api/v1/documents/${encodeURIComponent(id)}`, { signal }),
  })
}

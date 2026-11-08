import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { AssistResponse } from '@/api/types'

const url = (id: string) => `/api/v1/documents/${encodeURIComponent(id)}/assist`

/**
 * The document's saved AI brief, loaded with the page, plus a generate/regenerate action.
 * A successful regenerate replaces the saved brief; a failed one leaves it in place and is
 * reported through `generate.data` / `generate.error` instead.
 */
export function useAssist(id: string) {
  const queryClient = useQueryClient()
  const saved = useQuery({
    queryKey: qk.assist(id),
    queryFn: () => apiFetch<AssistResponse>(url(id)),
    staleTime: Infinity,
  })
  const generate = useMutation({
    mutationFn: ({ refresh = false }: { refresh?: boolean } = {}) =>
      apiFetch<AssistResponse>(`${url(id)}${refresh ? '?refresh=true' : ''}`, { method: 'POST' }),
    onSuccess: (data) => {
      if (data.status === 'ok') queryClient.setQueryData(qk.assist(id), data)
    },
  })
  return { saved, generate }
}

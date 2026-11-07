import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { AssistResponse } from '@/api/types'

/** Generate (or fetch the cached) AI report on demand and keep the latest in the query cache. */
export function useAssist(id: string) {
  const queryClient = useQueryClient()
  const latest = useQuery<AssistResponse | null>({
    queryKey: qk.assist(id),
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  })
  const generate = useMutation({
    mutationFn: ({ refresh = false }: { refresh?: boolean } = {}) =>
      apiFetch<AssistResponse>(
        `/api/v1/documents/${encodeURIComponent(id)}/assist${refresh ? '?refresh=true' : ''}`,
        { method: 'POST' },
      ),
    onSuccess: (data) => queryClient.setQueryData(qk.assist(id), data),
  })
  return { data: latest.data ?? null, generate }
}

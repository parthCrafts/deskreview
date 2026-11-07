import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError, apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { Decision, DocumentDetail } from '@/api/types'

/** Approve or reject a document; a 409 toasts who won and refreshes the document. */
export function useReviewDocument(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { decision: Decision; comment: string | null }) =>
      apiFetch<DocumentDetail>(`/api/v1/documents/${encodeURIComponent(id)}/review`, { method: 'POST', json: body }),
    onSuccess: (doc, { decision }) => {
      queryClient.setQueryData(qk.document(id), doc)
      queryClient.invalidateQueries({ queryKey: qk.documents() })
      toast.success(decision === 'approve' ? 'Approved' : 'Rejected')
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(error.message)
        queryClient.invalidateQueries({ queryKey: qk.document(id) })
        queryClient.invalidateQueries({ queryKey: qk.documents() })
      }
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { DocumentDetail } from '@/api/types'
import type { SubmitValues } from './schema'

/** Post a submission as multipart, then open the new document. */
export function useSubmitDocument() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (values: SubmitValues) => {
      const form = new FormData()
      form.append('title', values.title.trim())
      if (values.mode === 'text') form.append('text', values.text)
      else if (values.file) form.append('file', values.file)
      return apiFetch<DocumentDetail>('/api/v1/documents', { method: 'POST', form })
    },
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: qk.documents() })
      queryClient.setQueryData(qk.document(doc.id), doc)
      toast.success('Document submitted')
      navigate(`/documents/${doc.id}`)
    },
  })
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { apiFetch } from '@/api/client'
import { type ListQuery, qk } from '@/api/keys'
import type { DocumentList, Status } from '@/api/types'

export type StatusFilter = Status | 'all'
const STATUS_VALUES: StatusFilter[] = ['all', 'pending', 'approved', 'rejected']

interface ListParams {
  status: StatusFilter
  q: string
  page: number
}

/** Read and write list filters in the URL; changing status or search resets to page 1. */
export function useListParams(defaultStatus: StatusFilter = 'all') {
  const [params, setParams] = useSearchParams()
  const rawStatus = params.get('status') as StatusFilter | null
  const status = rawStatus && STATUS_VALUES.includes(rawStatus) ? rawStatus : defaultStatus
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  const set = (patch: Partial<ListParams>) => {
    const next = new URLSearchParams(params)
    if (patch.status !== undefined) {
      if (patch.status === defaultStatus) next.delete('status')
      else next.set('status', patch.status)
    }
    if (patch.q !== undefined) {
      if (patch.q) next.set('q', patch.q)
      else next.delete('q')
    }
    const resetPage = patch.status !== undefined || patch.q !== undefined
    const newPage = resetPage ? 1 : (patch.page ?? page)
    if (newPage > 1) next.set('page', String(newPage))
    else next.delete('page')
    setParams(next, { replace: patch.q !== undefined })
  }

  return { status, q, page, set }
}

/** Fetch one page of documents, keeping the previous page visible while the next loads. */
export function useDocuments(query: ListQuery) {
  return useQuery({
    queryKey: qk.documents(query),
    placeholderData: keepPreviousData,
    queryFn: ({ signal }) => {
      const search = new URLSearchParams({ scope: query.scope, page: String(query.page), page_size: '20' })
      if (query.status) search.set('status', query.status)
      if (query.q) search.set('q', query.q)
      return apiFetch<DocumentList>(`/api/v1/documents?${search}`, { signal })
    },
  })
}

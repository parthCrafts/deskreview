import type { Status } from './types'

export interface ListQuery {
  scope: 'mine' | 'all'
  status?: Status
  q: string
  page: number
}

export const qk = {
  me: ['me'] as const,
  documents: (params?: ListQuery) => (params ? (['documents', params] as const) : (['documents'] as const)),
  document: (id: string) => ['document', id] as const,
  assist: (id: string) => ['assist', id] as const,
}

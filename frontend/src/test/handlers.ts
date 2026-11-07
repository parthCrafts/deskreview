import { http, HttpResponse } from 'msw'
import type { DocumentDetail, DocumentList, User } from '@/api/types'

export const alice: User = { id: 1, username: 'alice', display_name: 'Alice Chen', role: 'submitter' }
export const rita: User = { id: 3, username: 'rita', display_name: 'Rita Shah', role: 'reviewer' }

export const demoUsers = [
  { username: 'rita', display_name: 'Rita Shah', role: 'reviewer' },
  { username: 'sam', display_name: 'Sam Lee', role: 'reviewer' },
  { username: 'alice', display_name: 'Alice Chen', role: 'submitter' },
  { username: 'ben', display_name: 'Ben Okafor', role: 'submitter' },
]

/** Build a document detail fixture. */
export function makeDoc(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  return {
    id: 'd1',
    title: 'Vendor contract',
    kind: 'text',
    status: 'pending',
    submitter: { id: 1, username: 'alice', display_name: 'Alice Chen' },
    file: null,
    created_at: '2026-11-07T10:00:00Z',
    decided_at: null,
    decided_by: null,
    text: 'Contract body',
    decision_comment: null,
    can_review: true,
    events: [
      {
        id: 1,
        type: 'submitted',
        actor: { id: 1, username: 'alice', display_name: 'Alice Chen' },
        from_status: null,
        to_status: 'pending',
        comment: null,
        created_at: '2026-11-07T10:00:00Z',
      },
    ],
    ...overrides,
  }
}

/** Build a list response fixture. */
export function makeList(overrides: Partial<DocumentList> = {}): DocumentList {
  const results = overrides.results ?? [makeDoc()]
  return {
    count: results.length,
    page: 1,
    page_size: 20,
    next: null,
    previous: null,
    counts: { all: results.length, pending: results.length, approved: 0, rejected: 0 },
    results,
    ...overrides,
  }
}

/** Respond with the standard error envelope. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra: { fields?: Record<string, string[]>; details?: Record<string, unknown> } = {},
) {
  return HttpResponse.json(
    { error: { code, message, fields: extra.fields ?? {}, details: extra.details ?? {}, request_id: 'req-1' } },
    { status },
  )
}

export const handlers = [
  http.get('/api/v1/auth/me', () => errorResponse(401, 'not_authenticated', 'Please log in.')),
  http.get('/api/v1/auth/demo-users', () => HttpResponse.json(demoUsers)),
  http.get('/api/v1/documents', () => HttpResponse.json(makeList())),
]

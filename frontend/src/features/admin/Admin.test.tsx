import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, avery, errorResponse, makeAdminUser, makeDoc, makeList, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

/** Sign in as the admin and stub the admin endpoints. */
function asAdmin() {
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(avery)),
    http.get('/api/v1/admin/users', () =>
      HttpResponse.json([
        makeAdminUser({
          id: 5,
          username: 'admin',
          display_name: 'Avery Morgan',
          role: 'admin',
          submissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
        }),
        makeAdminUser({
          id: 3,
          username: 'rita',
          display_name: 'Rita Shah',
          role: 'reviewer',
          submissions: { total: 0, pending: 0, approved: 0, rejected: 0 },
          reviews: { total: 2, approved: 1, rejected: 1 },
        }),
        makeAdminUser(),
      ]),
    ),
  )
}

describe('Admin', () => {
  it('lands on all documents with reviewer and decision note columns', async () => {
    asAdmin()
    const rejected = makeDoc({
      id: 'd2',
      title: 'Marketing budget',
      status: 'rejected',
      decided_by: { id: 3, username: 'rita', display_name: 'Rita Shah' },
      decided_at: '2026-11-07T11:00:00Z',
      decision_comment: 'Please add expected ROI per channel.',
    })
    server.use(http.get('/api/v1/documents', () => HttpResponse.json(makeList({ results: [makeDoc(), rejected] }))))
    renderWithProviders(<App />, { route: '/' })
    expect(await screen.findByRole('heading', { name: 'All documents' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Documents' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: 'Users' })).toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: /submit|^reviews$/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('columnheader', { name: 'Reviewed by' })).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /marketing budget/i })
    expect(within(row).getByText('Rita Shah')).toBeInTheDocument()
    expect(within(row).getByText('Please add expected ROI per channel.')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /vendor contract/i })).toHaveTextContent('Awaiting review')
    expect(screen.getByRole('link', { name: 'Marketing budget' })).toHaveAttribute('href', '/manage/documents/d2')
  })

  it('opens any document read-only with its timeline', async () => {
    asAdmin()
    server.use(http.get('/api/v1/documents/d1', () => HttpResponse.json(makeDoc({ can_review: false }))))
    renderWithProviders(<App />, { route: '/manage/documents/d1' })
    expect(await screen.findByRole('heading', { name: 'Vendor contract' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /all documents/i })).toHaveAttribute('href', '/manage/documents')
    expect(screen.queryByRole('button', { name: /^approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /ai assist/i })).not.toBeInTheDocument()
  })

  it('lists users with role badges, submissions and reviews', async () => {
    asAdmin()
    renderWithProviders(<App />, { route: '/manage/users' })
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument()
    const alice = await screen.findByRole('row', { name: /alice chen/i })
    expect(within(alice).getByText('Submitter')).toBeInTheDocument()
    expect(within(alice).getByText('1 pending')).toBeInTheDocument()
    expect(within(alice).getByText('1 approved')).toBeInTheDocument()
    const rita = screen.getByRole('row', { name: /rita shah/i })
    expect(within(rita).getByText('Reviewer')).toBeInTheDocument()
    expect(within(rita).getByText('1 approved, 1 rejected')).toBeInTheDocument()
    expect(screen.getByText('People').nextSibling).toHaveTextContent('3')
  })

  it.each([
    ['submitter', alice, '/documents', /my submissions/i],
    ['reviewer', rita, '/review', /^reviews$/i],
  ])('sends a %s away from admin pages', async (_role, user, _home, heading) => {
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json(user)),
      http.get('/api/v1/admin/users', () => errorResponse(403, 'permission_denied', 'Not allowed.')),
    )
    renderWithProviders(<App />, { route: '/manage/users' })
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })
})

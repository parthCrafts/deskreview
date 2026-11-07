import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, errorResponse, makeDoc, makeList } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

/** Render My submissions as Alice, recording every list request's query string. */
function renderMine(route = '/documents', respond?: (url: URL) => Response) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(alice)),
    http.get('/api/v1/documents', ({ request }) => {
      const url = new URL(request.url)
      requests.push(url.searchParams)
      return respond ? respond(url) : HttpResponse.json(defaultList)
    }),
  )
  return { requests, ...renderWithProviders(<App />, { route }) }
}

const defaultList = makeList({
  count: 3,
  counts: { all: 3, pending: 2, approved: 1, rejected: 0 },
  results: [
    makeDoc({ id: 'a', title: 'Vendor contract' }),
    makeDoc({ id: 'b', title: 'Remote policy' }),
    makeDoc({ id: 'c', title: 'Onboarding', status: 'approved' }),
  ],
})

describe('DocumentList', () => {
  it('renders rows with status badges and tab counts', async () => {
    const { requests } = renderMine()
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('link', { name: 'Vendor contract' })).toHaveAttribute('href', '/documents/a')
    expect(within(table).getAllByText('Pending')).toHaveLength(2)
    expect(within(table).getByText('Approved')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /pending 2/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /all 3/i })).toHaveAttribute('aria-selected', 'true')
    expect(requests[0].get('scope')).toBe('mine')
  })

  it('filters by status via URL', async () => {
    const { user, requests } = renderMine()
    await user.click(await screen.findByRole('tab', { name: /approved/i }))
    await waitFor(() => expect(requests.at(-1)?.get('status')).toBe('approved'))
    expect(screen.getByTestId('location')).toHaveTextContent('/documents?status=approved')
    expect(screen.getByRole('tab', { name: /approved/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('debounces search and resets to page 1', async () => {
    const { user, requests } = renderMine('/documents?page=2')
    await screen.findByRole('table')
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'abc')
    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('abc'))
    expect(requests.filter((r) => r.get('q')?.startsWith('a'))).toHaveLength(1)
    expect(requests.at(-1)?.get('page')).toBe('1')
  })

  it('keeps a space typed before a pause so multi-word search works', async () => {
    const { user, requests } = renderMine()
    await screen.findByRole('table')
    const box = screen.getByRole('searchbox', { name: /search/i })
    await user.type(box, 'vendor ')
    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('vendor'))
    await user.type(box, 'contract')
    expect(box).toHaveValue('vendor contract')
    await waitFor(() => expect(requests.at(-1)?.get('q')).toBe('vendor contract'))
  })

  it('shows empty state', async () => {
    renderMine('/documents', () => HttpResponse.json(makeList({ results: [], counts: { all: 0, pending: 0, approved: 0, rejected: 0 } })))
    expect(await screen.findByText('No submissions yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /submit your first document/i })).toHaveAttribute('href', '/submit')
  })

  it('shows no-match state with clear search', async () => {
    const { user } = renderMine('/documents?q=zzz', (url) =>
      HttpResponse.json(url.searchParams.get('q') ? makeList({ results: [] }) : defaultList),
    )
    expect(await screen.findByText('No documents match “zzz”')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: /search/i })).toHaveValue('')
  })

  it('shows back-to-first-page when page is past the end', async () => {
    const { user } = renderMine('/documents?page=3', (url) =>
      HttpResponse.json(url.searchParams.get('page') === '3' ? makeList({ count: 2, page: 3, results: [] }) : defaultList),
    )
    await user.click(await screen.findByRole('button', { name: /back to first page/i }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/documents$/)
  })

  it('paginates with next and previous', async () => {
    const { user, requests } = renderMine('/documents', (url) =>
      HttpResponse.json(
        makeList({
          count: 25,
          page: Number(url.searchParams.get('page')),
          next: url.searchParams.get('page') === '1' ? 2 : null,
          previous: url.searchParams.get('page') === '2' ? 1 : null,
        }),
      ),
    )
    await user.click(await screen.findByRole('button', { name: /next page/i }))
    await waitFor(() => expect(requests.at(-1)?.get('page')).toBe('2'))
    expect(await screen.findByRole('button', { name: /previous page/i })).toBeEnabled()
  })

  it('shows error state with retry on 500', async () => {
    let calls = 0
    renderMine('/documents', () => {
      calls++
      return calls === 1 ? errorResponse(500, 'server_error', 'Something went wrong on our side.') : HttpResponse.json(defaultList)
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong on our side.')
    expect(alert).toHaveTextContent('req-1')
    await within(alert).getByRole('button', { name: /try again/i }).click()
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })

  it('expired session mid-use redirects to login with toast', async () => {
    renderMine('/documents', () => errorResponse(401, 'not_authenticated', 'Please log in to continue.'))
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByText('Your session expired. Please sign in again.')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/login?next=%2Fdocuments')
  })
})

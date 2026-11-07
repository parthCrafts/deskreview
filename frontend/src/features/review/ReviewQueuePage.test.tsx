import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { makeDoc, makeList, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

/** Render the queue as Rita with three pending documents. */
function renderQueue(results = [makeDoc({ id: 'a', title: 'First' }), makeDoc({ id: 'b', title: 'Second' }), makeDoc({ id: 'c', title: 'Third' })]) {
  const requests: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(rita)),
    http.get('/api/v1/documents', ({ request }) => {
      requests.push(new URL(request.url).searchParams)
      return HttpResponse.json(makeList({ results }))
    }),
    http.get('/api/v1/documents/:id', ({ params }) => HttpResponse.json(makeDoc({ id: String(params.id) }))),
  )
  return { requests, ...renderWithProviders(<App />, { route: '/review' }) }
}

describe('ReviewQueuePage', () => {
  it('defaults to the pending tab', async () => {
    const { requests } = renderQueue()
    expect(await screen.findByRole('tab', { name: /pending/i })).toHaveAttribute('aria-selected', 'true')
    expect(requests[0].get('status')).toBe('pending')
    expect(requests[0].get('scope')).toBe('all')
  })

  it('shows all caught up when nothing is pending', async () => {
    renderQueue([])
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })

  it('queue: j/k moves selection and Enter opens', async () => {
    const { user } = renderQueue()
    const table = await screen.findByRole('table')
    const rows = () => within(table).getAllByRole('row').slice(1)
    await user.keyboard('j')
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('jj')
    expect(rows()[2]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('j')
    expect(rows()[2]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('k')
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/review/b'))
  })

  it('Enter on a focused link follows that link, not the selected row', async () => {
    const { user } = renderQueue()
    const table = await screen.findByRole('table')
    await user.keyboard('j')
    within(table).getByRole('link', { name: 'Third' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/review/c'))
  })

  it('Enter on a focused button activates the button', async () => {
    const { user } = renderQueue()
    await screen.findByRole('table')
    screen.getByRole('button', { name: /shortcuts/i }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
  })

  it('/ focuses search and ? opens the shortcuts help', async () => {
    const { user } = renderQueue()
    await screen.findByRole('table')
    await user.keyboard('/')
    expect(screen.getByRole('searchbox', { name: /search/i })).toHaveFocus()
    expect(screen.getByRole('searchbox', { name: /search/i })).toHaveValue('')
    await user.keyboard('{Escape}')
    screen.getByRole('searchbox', { name: /search/i }).blur()
    await user.keyboard('?')
    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
  })
})

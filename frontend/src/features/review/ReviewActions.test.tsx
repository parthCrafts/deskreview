import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import type { DocumentDetail } from '@/api/types'
import { server } from '@/test/server'
import { errorResponse, makeDoc, makeList, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

const sam = { id: 4, username: 'sam', display_name: 'Sam Lee' }

/** Render the review page for d1 as Rita, recording review POST bodies. */
function renderReview(doc: DocumentDetail = makeDoc()) {
  const posts: unknown[] = []
  let current = doc
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(rita)),
    http.get('/api/v1/documents/d1', () => HttpResponse.json(current)),
    http.get('/api/v1/documents', () => HttpResponse.json(makeList({ results: [current] }))),
  )
  const utils = renderWithProviders(<App />, { route: '/review/d1' })
  return {
    ...utils,
    posts,
    setCurrent: (d: DocumentDetail) => {
      current = d
    },
    onReview: (respond: (body: unknown) => Response) =>
      server.use(
        http.post('/api/v1/documents/d1/review', async ({ request }) => {
          const body = await request.json()
          posts.push(body)
          return respond(body)
        }),
      ),
  }
}

const approved = makeDoc({
  status: 'approved',
  can_review: false,
  decided_by: sam,
  decided_at: '2026-11-07T11:00:00Z',
})

describe('ReviewActions', () => {
  it('reject requires a comment', async () => {
    const { user, posts, onReview } = renderReview()
    onReview(() => HttpResponse.json(makeDoc()))
    await user.click(await screen.findByRole('button', { name: /^reject/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }))
    expect(await within(dialog).findByText('A comment is required to reject.')).toBeInTheDocument()
    expect(posts).toHaveLength(0)
  })

  it('asks for a reason of at least 10 characters before rejecting', async () => {
    const { user, onReview } = renderReview()
    let called = false
    onReview(() => {
      called = true
      return HttpResponse.json({})
    })
    await user.click(await screen.findByRole('button', { name: /^reject/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/reason/i), 'Fix it')
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }))
    expect(await within(dialog).findByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('maps server comment error to the field', async () => {
    const { user, onReview } = renderReview()
    onReview(() =>
      errorResponse(400, 'validation_error', 'Please fix the highlighted fields.', {
        fields: { comment: ['Comment must be at most 2,000 characters.'] },
      }),
    )
    await user.click(await screen.findByRole('button', { name: /^reject/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/reason/i), 'Missing the signature page')
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }))
    const field = within(dialog).getByLabelText(/reason/i)
    await waitFor(() => expect(field).toHaveAccessibleDescription(/^Comment must be at most 2,000 characters\. /))
  })

  it('approves, toasts and moves on to the queue when nothing else is pending', async () => {
    const { user, posts, onReview, setCurrent } = renderReview()
    onReview(() => {
      setCurrent(approved)
      return HttpResponse.json(approved)
    })
    await user.click(await screen.findByRole('button', { name: /^approve/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^approve document/i }))
    await waitFor(() => expect(document.querySelector('[data-sonner-toast]')).toHaveTextContent('Approved'))
    expect(posts).toEqual([{ decision: 'approve', comment: null }])
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/review$/))
  })

  it('handles 409 by toasting and refreshing status', async () => {
    const { user, onReview, setCurrent } = renderReview()
    onReview(() => {
      setCurrent(approved)
      return errorResponse(409, 'already_decided', 'Already approved by Sam Lee.', {
        details: { status: 'approved', decided_by: 'Sam Lee', decided_at: '2026-11-07T11:00:00Z' },
      })
    })
    await user.click(await screen.findByRole('button', { name: /^reject/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/reason/i), 'Not detailed enough')
    await user.click(within(dialog).getByRole('button', { name: /reject document/i }))
    expect(await screen.findByText('Already approved by Sam Lee.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const header = screen.getByRole('heading', { level: 1 }).parentElement!
    await waitFor(() => expect(within(header).getByText('Approved')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^approve/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /decision$/i })).toHaveTextContent(/approved by sam lee/i)
    expect(screen.getByTestId('location')).toHaveTextContent('/review/d1')
  })

  it('disables actions on own submission with explanation', async () => {
    renderReview(makeDoc({ submitter: { id: 3, username: 'rita', display_name: 'Rita Shah' }, can_review: false }))
    expect(await screen.findByRole('button', { name: /^approve/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^reject/i })).toBeDisabled()
    expect(screen.getByText("You can't review your own submission.")).toBeInTheDocument()
  })

  it('keyboard: a opens approve, r opens reject, typing in comment does not trigger shortcuts', async () => {
    const { user } = renderReview()
    await screen.findByRole('button', { name: /^approve/i })
    await user.keyboard('a')
    expect(await screen.findByRole('dialog', { name: /approve/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.keyboard('r')
    const dialog = await screen.findByRole('dialog', { name: /reject/i })
    await user.type(within(dialog).getByLabelText(/reason/i), 'ar?')
    expect(within(dialog).getByLabelText(/reason/i)).toHaveValue('ar?')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('opens the reject dialog with an empty reason by default', async () => {
    const { user } = renderReview()
    await user.click(await screen.findByRole('button', { name: /^reject/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText(/reason/i)).toHaveValue('')
  })
})

import { screen, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, errorResponse, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

describe('LoginPage', () => {
  it('shows demo users grouped by role and logs in with one click', async () => {
    let posted: unknown
    server.use(
      http.post('/api/v1/auth/demo-login', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(rita)
      }),
    )
    const { user } = renderWithProviders(<App />, { route: '/login' })
    const reviewers = await screen.findByRole('group', { name: /reviewers/i })
    expect(within(reviewers).getAllByRole('button')).toHaveLength(2)
    const submitters = screen.getByRole('group', { name: /submitters/i })
    expect(within(submitters).getByRole('button', { name: /alice chen/i })).toBeInTheDocument()
    await user.click(within(reviewers).getByRole('button', { name: /rita shah/i }))
    expect(await screen.findByRole('link', { name: /review queue/i })).toBeInTheDocument()
    expect(posted).toEqual({ username: 'rita' })
  })

  it('a slow initial session check cannot undo a fresh login', async () => {
    server.use(
      http.get('/api/v1/auth/me', async () => {
        await delay(300)
        return errorResponse(401, 'not_authenticated', 'Please log in.')
      }),
      http.post('/api/v1/auth/demo-login', () => HttpResponse.json(rita)),
    )
    const { user } = renderWithProviders(<App />, { route: '/login' })
    await user.click(await screen.findByRole('button', { name: /rita shah/i }))
    expect(await screen.findByRole('link', { name: /review queue/i })).toBeInTheDocument()
    await delay(500)
    expect(screen.getByRole('link', { name: /review queue/i })).toBeInTheDocument()
  })

  it('logs in with username and password and goes to next', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json(alice)))
    const { user } = renderWithProviders(<App />, { route: '/login?next=/submit' })
    await user.type(await screen.findByLabelText(/^username$/i), 'alice')
    await user.type(screen.getByLabelText(/^password$/i), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByRole('heading', { name: /submit a document/i })).toBeInTheDocument()
  })

  it('shows invalid credentials error on the form', async () => {
    server.use(
      http.post('/api/v1/auth/login', () =>
        errorResponse(400, 'invalid_credentials', 'Invalid username or password.'),
      ),
    )
    const { user } = renderWithProviders(<App />, { route: '/login' })
    await user.type(await screen.findByLabelText(/^username$/i), 'alice')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password.')
  })

  it('requires username and password', async () => {
    const { user } = renderWithProviders(<App />, { route: '/login' })
    await user.click(await screen.findByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText('Enter your username.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  })

  it('hides demo accounts when demo login is disabled', async () => {
    server.use(http.get('/api/v1/auth/demo-users', () => errorResponse(404, 'not_found', 'Not found.')))
    renderWithProviders(<App />, { route: '/login' })
    expect(await screen.findByLabelText(/^username$/i)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /reviewers/i })).not.toBeInTheDocument()
  })

  it('ignores an off-site next parameter', async () => {
    server.use(http.post('/api/v1/auth/login', () => HttpResponse.json(alice)))
    const { user } = renderWithProviders(<App />, { route: '/login?next=//evil.example' })
    await user.type(await screen.findByLabelText(/^username$/i), 'alice')
    await user.type(screen.getByLabelText(/^password$/i), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByRole('heading', { name: /my submissions/i })).toBeInTheDocument()
  })
})

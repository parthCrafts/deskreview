import { screen, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, errorResponse, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

describe('LoginPage', () => {
  it('lists every demo user with a role badge and logs in with one click', async () => {
    let posted: unknown
    server.use(
      http.post('/api/v1/auth/demo-login', async ({ request }) => {
        posted = await request.json()
        return HttpResponse.json(rita)
      }),
    )
    const { user } = renderWithProviders(<App />, { route: '/login' })
    const accounts = await screen.findByRole('list')
    const rows = within(accounts).getAllByRole('listitem')
    expect(rows).toHaveLength(5)
    expect(within(rows[0]).getByText('Avery Morgan')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Admin')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Reviewer')).toBeInTheDocument()
    expect(within(rows[3]).getByText('Submitter')).toBeInTheDocument()
    expect(within(rows[3]).getByText('@alice')).toBeInTheDocument()
    expect(screen.queryByText(/every account uses/i)).not.toBeInTheDocument()
    expect(within(accounts).getAllByRole('button')).toHaveLength(5)
    await user.click(screen.getByRole('button', { name: 'Sign in as Rita Shah' }))
    expect(await screen.findByRole('link', { name: /^reviews$/i })).toBeInTheDocument()
    expect(posted).toEqual({ username: 'rita' })
  })

  it('rejects usernames with unexpected characters before calling the API', async () => {
    const { user } = renderWithProviders(<App />, { route: '/login' })
    await user.type(await screen.findByLabelText(/^username$/i), 'alice smith')
    await user.type(screen.getByLabelText(/^password$/i), 'pw')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(await screen.findByText(/usernames only use letters/i)).toBeInTheDocument()
  })

  it('can reveal the password', async () => {
    const { user } = renderWithProviders(<App />, { route: '/login' })
    const password = await screen.findByLabelText(/^password$/i)
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
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
    await user.click(await screen.findByRole('button', { name: 'Sign in as Rita Shah' }))
    expect(await screen.findByRole('link', { name: /^reviews$/i })).toBeInTheDocument()
    await delay(500)
    expect(screen.getByRole('link', { name: /^reviews$/i })).toBeInTheDocument()
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
    expect(screen.queryByRole('heading', { name: /demo users/i })).not.toBeInTheDocument()
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

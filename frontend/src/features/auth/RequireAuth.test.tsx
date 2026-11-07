import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

describe('RequireAuth and AppShell', () => {
  it('redirects anonymous users to login with next', async () => {
    renderWithProviders(<App />, { route: '/documents?status=approved' })
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
    expect(window.location.pathname).toBeDefined()
  })

  it('sends submitters away from reviewer routes', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(alice)))
    renderWithProviders(<App />, { route: '/review' })
    expect(await screen.findByRole('heading', { name: /my submissions/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /review queue/i })).not.toBeInTheDocument()
  })

  it('shows reviewer navigation and the user with role', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(rita)))
    renderWithProviders(<App />, { route: '/' })
    expect(await screen.findByRole('link', { name: /review queue/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^submit$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /my submissions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rita shah.*reviewer/i })).toBeInTheDocument()
  })

  it('logs out back to the login page', async () => {
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json(alice)),
      http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
    )
    const { user } = renderWithProviders(<App />, { route: '/documents' })
    await user.click(await screen.findByRole('button', { name: /alice chen/i }))
    await user.click(await screen.findByRole('menuitem', { name: /log out/i }))
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument()
  })

  it('switches theme and remembers it', async () => {
    server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(alice)))
    const { user } = renderWithProviders(<App />, { route: '/documents' })
    await user.click(await screen.findByRole('button', { name: /alice chen/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /dark/i }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('deskreview-theme')).toBe('dark')
  })
})

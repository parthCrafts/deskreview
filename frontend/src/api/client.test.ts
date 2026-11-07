import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '@/test/server'
import { errorResponse } from '@/test/handlers'
import { apiFetch, setUnauthorizedHandler } from './client'

afterEach(() => setUnauthorizedHandler(() => {}))

describe('apiFetch', () => {
  it('parses error envelope into ApiError', async () => {
    server.use(
      http.post('/api/v1/documents', () =>
        errorResponse(400, 'validation_error', 'Fix', { fields: { title: ['Title is required.'] } }),
      ),
    )
    await expect(apiFetch('/api/v1/documents', { method: 'POST', json: {} })).rejects.toMatchObject({
      status: 400,
      code: 'validation_error',
      message: 'Fix',
      fields: { title: ['Title is required.'] },
      requestId: 'req-1',
    })
  })

  it('maps fetch failure to network_error', async () => {
    server.use(http.get('/api/v1/documents', () => HttpResponse.error()))
    await expect(apiFetch('/api/v1/documents')).rejects.toMatchObject({ status: 0, code: 'network_error' })
  })

  it('maps a non-JSON error body to a generic error', async () => {
    server.use(http.get('/api/v1/documents', () => new HttpResponse('<html>bad gateway</html>', { status: 502 })))
    await expect(apiFetch('/api/v1/documents')).rejects.toMatchObject({ status: 502, code: 'server_error' })
  })

  it('resolves 204 to undefined and sends JSON bodies', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/auth/logout', async ({ request }) => {
        body = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await expect(apiFetch('/api/v1/auth/logout', { method: 'POST', json: { a: 1 } })).resolves.toBeUndefined()
    expect(body).toEqual({ a: 1 })
  })

  it('calls unauthorized handler on 401', async () => {
    const spy = vi.fn()
    setUnauthorizedHandler(spy)
    server.use(http.get('/api/v1/documents', () => errorResponse(401, 'not_authenticated', 'Log in')))
    await expect(apiFetch('/api/v1/documents')).rejects.toMatchObject({ status: 401 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not call unauthorized handler when skipAuthRedirect', async () => {
    const spy = vi.fn()
    setUnauthorizedHandler(spy)
    await expect(apiFetch('/api/v1/auth/me', { skipAuthRedirect: true })).rejects.toMatchObject({ status: 401 })
    expect(spy).not.toHaveBeenCalled()
  })

  it('reads csrftoken cookie on every unsafe request', async () => {
    const seen: (string | null)[] = []
    server.use(
      http.post('/api/v1/auth/logout', ({ request }) => {
        seen.push(request.headers.get('X-CSRFToken'))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    document.cookie = 'csrftoken=first; path=/'
    await apiFetch('/api/v1/auth/logout', { method: 'POST' })
    document.cookie = 'csrftoken=second; path=/'
    await apiFetch('/api/v1/auth/logout', { method: 'POST' })
    expect(seen).toEqual(['first', 'second'])
  })

  it('retries once after csrf_failed', async () => {
    let posts = 0
    let meCalls = 0
    server.use(
      http.get('/api/v1/auth/me', () => {
        meCalls++
        return HttpResponse.json({ id: 1, username: 'alice', display_name: 'Alice', role: 'submitter' })
      }),
      http.post('/api/v1/documents', () => {
        posts++
        return posts === 1
          ? errorResponse(403, 'csrf_failed', 'Expired')
          : HttpResponse.json({ id: 'd1' }, { status: 201 })
      }),
    )
    await expect(apiFetch('/api/v1/documents', { method: 'POST', json: {} })).resolves.toEqual({ id: 'd1' })
    expect(posts).toBe(2)
    expect(meCalls).toBe(1)
  })

  it('gives up after a second csrf_failed', async () => {
    server.use(
      http.get('/api/v1/auth/me', () => HttpResponse.json({})),
      http.post('/api/v1/documents', () => errorResponse(403, 'csrf_failed', 'Expired')),
    )
    await expect(apiFetch('/api/v1/documents', { method: 'POST', json: {} })).rejects.toMatchObject({
      code: 'csrf_failed',
    })
  })
})

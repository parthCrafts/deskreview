export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string[]>
  details: Record<string, unknown>
  requestId?: string

  constructor(init: {
    status: number
    code: string
    message: string
    fields?: Record<string, string[]>
    details?: Record<string, unknown>
    requestId?: string
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.status = init.status
    this.code = init.code
    this.fields = init.fields ?? {}
    this.details = init.details ?? {}
    this.requestId = init.requestId
  }
}

export interface FetchOptions {
  method?: string
  json?: unknown
  form?: FormData
  signal?: AbortSignal
  skipAuthRedirect?: boolean
  responseType?: 'json' | 'text'
}

let onUnauthorized: () => void = () => {}

/** Register what happens when any request comes back 401 (session expired). */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

/** Read the CSRF cookie fresh each time, because Django rotates it on login. */
function csrfToken(): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith('csrftoken='))
    ?.slice('csrftoken='.length)
}

/** Turn a non-2xx response into an ApiError, tolerating non-JSON bodies. */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json()
    const e = body?.error
    if (e?.code) {
      return new ApiError({
        status: response.status,
        code: e.code,
        message: e.message,
        fields: e.fields,
        details: e.details,
        requestId: e.request_id,
      })
    }
  } catch {
    // Non-JSON error page (e.g. a proxy 502); fall through to a generic error.
  }
  return new ApiError({
    status: response.status,
    code: response.status >= 500 ? 'server_error' : 'http_error',
    message: response.status >= 500 ? 'Something went wrong on our side.' : `Request failed (${response.status}).`,
  })
}

/** Send one request with session credentials and the CSRF header on unsafe methods. */
async function send(path: string, opts: FetchOptions): Promise<Response> {
  const method = opts.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json' }
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const token = csrfToken()
    if (token) headers['X-CSRFToken'] = token
  }
  try {
    return await fetch(new URL(path, window.location.origin), {
      method,
      headers,
      body,
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'network_error', message: "Can't reach the server. Check your connection." })
  }
}

/** Call the API and return parsed JSON, or throw an ApiError built from the error envelope. */
export async function apiFetch<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  let response = await send(path, opts)
  if (!response.ok) {
    let error = await toApiError(response)
    if (error.code === 'csrf_failed') {
      await send('/api/v1/auth/me', { skipAuthRedirect: true })
      response = await send(path, opts)
      if (!response.ok) error = await toApiError(response)
    }
    if (!response.ok) {
      if (error.status === 401 && !opts.skipAuthRedirect) onUnauthorized()
      throw error
    }
  }
  if (response.status === 204) return undefined as T
  if (opts.responseType === 'text') return (await response.text()) as T
  return (await response.json()) as T
}

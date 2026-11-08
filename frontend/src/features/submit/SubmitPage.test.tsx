import { fireEvent, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import { server } from '@/test/server'
import { alice, errorResponse, makeDoc } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

/** Render the app on /submit as Alice. */
function renderSubmit() {
  server.use(http.get('/api/v1/auth/me', () => HttpResponse.json(alice)))
  return renderWithProviders(<App />, { route: '/submit' })
}

/** A File of the given size. */
function fileOf(name: string, size: number, type = 'application/pdf') {
  return new File([new Uint8Array(size)], name, { type })
}

describe('SubmitPage', () => {
  it('requires title and content', async () => {
    const { user } = renderSubmit()
    await user.click(await screen.findByRole('button', { name: /submit for review/i }))
    expect(await screen.findByText('Title is required.')).toBeInTheDocument()
    expect(screen.getByText('Provide a file or text.')).toBeInTheDocument()
  })

  it('requires text in write mode', async () => {
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Policy')
    await user.click(screen.getByRole('tab', { name: /write text/i }))
    await user.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByText('Provide a file or text.')).toBeInTheDocument()
  })

  it('rejects oversized, empty and unsupported files client-side', async () => {
    const { user } = renderSubmit()
    const input = await screen.findByLabelText(/choose file/i)
    await user.upload(input, fileOf('big.pdf', 5 * 1024 * 1024 + 1))
    expect(await screen.findByText('File must be at most 5 MB.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove big.pdf/i }))
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer: { files: [fileOf('a.exe', 10)], types: ['Files'] } })
    expect(await screen.findByText('Unsupported file type. Allowed: PDF, PNG, JPEG, TXT, MD.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove a.exe/i }))
    await user.upload(screen.getByLabelText(/choose file/i), fileOf('empty.pdf', 0))
    expect(await screen.findByText('File is empty.')).toBeInTheDocument()
  })

  it('accepts a dropped file and can remove it', async () => {
    const { user } = renderSubmit()
    const zone = await screen.findByTestId('dropzone')
    fireEvent.dragEnter(zone, { dataTransfer: { files: [], types: ['Files'] } })
    fireEvent.drop(zone, { dataTransfer: { files: [fileOf('contract.pdf', 2048)], types: ['Files'] } })
    expect(await screen.findByText('contract.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /remove contract.pdf/i }))
    expect(screen.queryByText('contract.pdf')).not.toBeInTheDocument()
  })

  it('submits text and opens the new document', async () => {
    let form: FormData | undefined
    server.use(
      http.post('/api/v1/documents', async ({ request }) => {
        form = await request.formData()
        return HttpResponse.json(makeDoc({ id: 'new1', title: 'Policy' }), { status: 201 })
      }),
      http.get('/api/v1/documents/new1', () => HttpResponse.json(makeDoc({ id: 'new1', title: 'Policy' }))),
    )
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Policy')
    await user.click(screen.getByRole('tab', { name: /write text/i }))
    await user.type(screen.getByLabelText(/^text$/i), 'Policy body text')
    await user.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByText('Document submitted')).toBeInTheDocument()
    expect(form?.get('title')).toBe('Policy')
    expect(form?.get('text')).toBe('Policy body text')
    expect(form?.has('file')).toBe(false)
  })

  it('shows server field errors on fields', async () => {
    server.use(
      http.post('/api/v1/documents', () =>
        errorResponse(400, 'validation_error', 'Please fix the highlighted fields.', {
          fields: { title: ['Title must be at most 200 characters.'] },
        }),
      ),
    )
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Test doc')
    await user.upload(screen.getByLabelText(/choose file/i), fileOf('a.pdf', 10))
    await user.click(screen.getByRole('button', { name: /submit for review/i }))
    const title = screen.getByLabelText(/^title$/i)
    await waitFor(() => expect(title).toHaveAccessibleDescription(/^Title must be at most 200 characters\. /))
    expect(title).toHaveFocus()
  })

  it('shows 415 from server on the file field', async () => {
    server.use(
      http.post('/api/v1/documents', () =>
        errorResponse(415, 'unsupported_media_type', 'File extension does not match its content.'),
      ),
    )
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Test doc')
    await user.upload(screen.getByLabelText(/choose file/i), fileOf('a.pdf', 10))
    await user.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByText('File extension does not match its content.')).toBeInTheDocument()
  })

  it('prevents double submit', async () => {
    let calls = 0
    server.use(
      http.post('/api/v1/documents', async () => {
        calls++
        await delay(400)
        return HttpResponse.json(makeDoc({ id: 'd2' }), { status: 201 })
      }),
      http.get('/api/v1/documents/d2', () => HttpResponse.json(makeDoc({ id: 'd2' }))),
    )
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Test doc')
    await user.click(screen.getByRole('tab', { name: /write text/i }))
    await user.type(screen.getByLabelText(/^text$/i), 'Policy body text')
    await user.dblClick(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByRole('button', { name: /submitting/i })).toBeDisabled()
    await screen.findByText('Document submitted')
    expect(calls).toBe(1)
  })

  it('shows network error toast and keeps the form values', async () => {
    server.use(http.post('/api/v1/documents', () => HttpResponse.error()))
    const { user } = renderSubmit()
    await user.type(await screen.findByLabelText(/^title$/i), 'Keep me')
    await user.click(screen.getByRole('tab', { name: /write text/i }))
    await user.type(screen.getByLabelText(/^text$/i), 'Policy body text')
    await user.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(await screen.findByText("Can't reach the server. Check your connection.")).toBeInTheDocument()
    expect(screen.getByLabelText(/^title$/i)).toHaveValue('Keep me')
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeEnabled()
  })
})

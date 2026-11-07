import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import type { DocumentDetail } from '@/api/types'
import { server } from '@/test/server'
import { alice, errorResponse, makeDoc } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'

/** Render the detail page for `doc` as Alice. */
function renderDoc(doc: DocumentDetail | Response) {
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(alice)),
    http.get('/api/v1/documents/d1', () => (doc instanceof Response ? doc : HttpResponse.json(doc))),
  )
  return renderWithProviders(<App />, { route: '/documents/d1' })
}

const rita = { id: 3, username: 'rita', display_name: 'Rita Shah' }
const fileMeta = (name: string, contentType: string) => ({
  name,
  content_type: contentType,
  size: 2048,
  url: '/api/v1/documents/d1/file',
})

describe('DocumentPage', () => {
  it('shows timeline with decision comment', async () => {
    const base = makeDoc()
    renderDoc(
      makeDoc({
        status: 'rejected',
        decided_by: rita,
        decided_at: '2026-11-07T11:00:00Z',
        decision_comment: 'Missing signature page.',
        can_review: false,
        events: [
          ...base.events,
          {
            id: 2,
            type: 'rejected',
            actor: rita,
            from_status: 'pending',
            to_status: 'rejected',
            comment: 'Missing signature page.',
            created_at: '2026-11-07T11:00:00Z',
          },
        ],
      }),
    )
    const timeline = await screen.findByRole('list', { name: /history/i })
    const items = within(timeline).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Alice Chen submitted')
    expect(items[1]).toHaveTextContent('Rita Shah rejected')
    expect(items[1]).toHaveTextContent('Missing signature page.')
    expect(items[1].querySelector('time')).toHaveAttribute('datetime', '2026-11-07T11:00:00Z')
    expect(screen.getByRole('heading', { name: 'Vendor contract' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /decision/i })).toHaveTextContent(/rejected by rita shah/i)
  })

  it('renders text preview safely', async () => {
    renderDoc(makeDoc({ text: '<script>alert(1)</script><b>bold</b>' }))
    expect(await screen.findByText('<script>alert(1)</script><b>bold</b>')).toBeInTheDocument()
    expect(document.querySelector('main script')).toBeNull()
    expect(document.querySelector('main b')).toBeNull()
  })

  it('renders pdf iframe and download link', async () => {
    renderDoc(makeDoc({ kind: 'file', text: null, file: fileMeta('contract.pdf', 'application/pdf') }))
    const frame = await screen.findByTitle('Vendor contract')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', '/api/v1/documents/d1/file?disposition=inline')
    expect(screen.getByRole('link', { name: /download contract.pdf/i })).toHaveAttribute(
      'href',
      '/api/v1/documents/d1/file',
    )
  })

  it('renders an image preview', async () => {
    renderDoc(makeDoc({ kind: 'file', text: null, file: fileMeta('scan.png', 'image/png') }))
    expect(await screen.findByRole('img', { name: 'Vendor contract' })).toHaveAttribute(
      'src',
      '/api/v1/documents/d1/file?disposition=inline',
    )
  })

  it('fetches text files into a pre block', async () => {
    server.use(http.get('/api/v1/documents/d1/file', () => new HttpResponse('# Notes\nline two', { headers: { 'Content-Type': 'text/markdown' } })))
    renderDoc(makeDoc({ kind: 'file', text: null, file: fileMeta('notes.md', 'text/markdown') }))
    expect(await screen.findByText(/# Notes/)).toHaveTextContent('# Notes line two')
  })

  it('shows not found for 404', async () => {
    renderDoc(errorResponse(404, 'not_found', 'Not found.'))
    expect(await screen.findByRole('heading', { name: 'Document not found' })).toBeInTheDocument()
  })
})

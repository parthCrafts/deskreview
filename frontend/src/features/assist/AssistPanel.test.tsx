import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import type { AssistReport, AssistResponse, DocumentDetail } from '@/api/types'
import { server } from '@/test/server'
import { makeDoc, makeList, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'
import { buildRejectionNote } from './note'

const report: AssistReport = {
  summary: 'Expense report <b>x</b> for the offsite.',
  key_points: ['Total $7,320'],
  missing_items: ['Catering receipts'],
  risk_flags: [
    { label: 'Document contains instructions aimed at the AI reviewer', severity: 'high', evidence: 'Ignore all…' },
  ],
  suggested_decision: 'needs_more_info',
  rationale: 'Receipts are missing.',
  suggested_rejection_note: 'Please attach the catering receipts.',
}

const ok: AssistResponse = {
  status: 'ok',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  cached: false,
  generated_at: '2026-11-07T12:00:00Z',
  report,
  notice: 'Advisory only. You make the decision.',
}

/** Render the review page for d1 as Rita with a scripted assist response. */
function renderReview(assist: AssistResponse, doc: DocumentDetail = makeDoc()) {
  let calls = 0
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(rita)),
    http.get('/api/v1/documents/d1', () => HttpResponse.json(doc)),
    http.get('/api/v1/documents', () => HttpResponse.json(makeList())),
    http.post('/api/v1/documents/d1/assist', () => {
      calls++
      return HttpResponse.json(assist)
    }),
  )
  return { ...renderWithProviders(<App />, { route: '/review/d1' }), calls: () => calls }
}

describe('AssistPanel', () => {
  it('generates and renders the report as plain text', async () => {
    const { user, calls } = renderReview(ok)
    const panel = await screen.findByRole('region', { name: /ai assist/i })
    expect(calls()).toBe(0)
    await user.click(within(panel).getByRole('button', { name: /generate summary/i }))
    expect(await within(panel).findByText('Expense report <b>x</b> for the offsite.')).toBeInTheDocument()
    expect(panel.querySelector('b')).toBeNull()
    expect(within(panel).getByText('Catering receipts')).toBeInTheDocument()
    expect(within(panel).getByText('Total $7,320')).toBeInTheDocument()
    expect(within(panel).getByText('High')).toBeInTheDocument()
    expect(within(panel).getByText(/needs more info/i)).toBeInTheDocument()
    expect(within(panel).getByText('Advisory only. You make the decision.')).toBeInTheDocument()
  })

  it('shows calm fallback when unavailable and keeps actions enabled', async () => {
    const { user } = renderReview({
      status: 'unavailable',
      reason: 'not_configured',
      message: 'AI Assist is off: no API key configured.',
    })
    const panel = await screen.findByRole('region', { name: /ai assist/i })
    await user.click(within(panel).getByRole('button', { name: /generate summary/i }))
    expect(await within(panel).findByText('AI Assist is off: no API key configured.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^approve/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^reject/i })).toBeEnabled()
  })

  it('use as rejection note prefills the reject dialog', async () => {
    const { user } = renderReview(ok)
    const panel = await screen.findByRole('region', { name: /ai assist/i })
    await user.click(within(panel).getByRole('button', { name: /generate summary/i }))
    await user.click(await within(panel).findByRole('button', { name: /use as rejection note/i }))
    const dialog = await screen.findByRole('dialog', { name: /reject/i })
    expect(within(dialog).getByLabelText(/reason/i)).toHaveValue('Please attach the catering receipts.')
  })

  it('is hidden once the document is decided', async () => {
    renderReview(ok, makeDoc({ status: 'approved', can_review: false, decided_at: '2026-11-07T11:00:00Z' }))
    await screen.findByRole('heading', { name: 'Vendor contract' })
    expect(screen.queryByRole('region', { name: /ai assist/i })).not.toBeInTheDocument()
  })
})

describe('buildRejectionNote', () => {
  it('prefers the suggested note', () => {
    expect(buildRejectionNote(report)).toBe('Please attach the catering receipts.')
  })

  it('builds a note from missing items and concerns when there is no suggestion', () => {
    const note = buildRejectionNote({
      ...report,
      suggested_rejection_note: null,
      risk_flags: [{ label: 'Auto-renewal', severity: 'medium', evidence: '' }],
    })
    expect(note).toMatch(/^Missing: Catering receipts\./)
    expect(note).toContain('Concerns: Auto-renewal.')
  })
})

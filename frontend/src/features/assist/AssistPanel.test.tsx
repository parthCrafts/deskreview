import { screen, waitFor, within } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import App from '@/App'
import type { AssistReport, AssistResponse, DocumentDetail, User } from '@/api/types'
import { server } from '@/test/server'
import { avery, makeDoc, makeList, rita } from '@/test/handlers'
import { renderWithProviders } from '@/test/utils'
import { THINKING_WORDS } from './thinking'
import { buildApprovalNote, buildRejectionNote } from './note'

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
  suggested_approval_note: null,
}

const NOTICE = 'Advisory only. You make the decision.'
const ok = (overrides: Partial<AssistReport> = {}, cached = false): AssistResponse => ({
  status: 'ok',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  cached,
  generated_at: '2026-11-07T12:00:00Z',
  report: { ...report, ...overrides },
  notice: NOTICE,
})
const empty: AssistResponse = { status: 'empty', notice: NOTICE }

/** Render a document page with a scripted saved brief (GET) and generate responses (POST, in order). */
function renderPage({
  saved = empty,
  generated = [],
  doc = makeDoc(),
  me = rita,
  wait = 0,
}: { saved?: AssistResponse; generated?: AssistResponse[]; doc?: DocumentDetail; me?: User; wait?: number } = {}) {
  const posts: string[] = []
  server.use(
    http.get('/api/v1/auth/me', () => HttpResponse.json(me)),
    http.get('/api/v1/documents/d1', () => HttpResponse.json(doc)),
    http.get('/api/v1/documents', () => HttpResponse.json(makeList())),
    http.get('/api/v1/documents/d1/assist', () => HttpResponse.json(saved)),
    http.post('/api/v1/documents/d1/assist', async ({ request }) => {
      posts.push(new URL(request.url).search)
      if (wait) await delay(wait)
      return HttpResponse.json(generated.shift() ?? ok())
    }),
  )
  const route = me.role === 'admin' ? '/manage/documents/d1' : '/review/d1'
  return { ...renderWithProviders(<App />, { route }), posts }
}

const findBrief = () => screen.findByRole('region', { name: /^ai summary$/i })
const briefLoaded = () =>
  waitFor(() => expect(screen.queryByRole('region', { name: /ai summary loading/i })).not.toBeInTheDocument())

describe('AssistPanel', () => {
  it('loads the saved brief with the page, without generating', async () => {
    const { posts } = renderPage({ saved: ok({}, true) })
    const card = await findBrief()
    expect(await within(card).findByText('Expense report <b>x</b> for the offsite.')).toBeInTheDocument()
    expect(card.querySelector('b')).toBeNull()
    expect(within(card).getByText(/needs more info/i)).toBeInTheDocument()
    expect(within(card).getByText(/1 risk/)).toBeInTheDocument()
    expect(within(card).getByText(/1 missing/)).toBeInTheDocument()
    const stamp = within(card).getByText(/^AI generated/)
    expect(stamp).toHaveAttribute('title', expect.stringContaining('gemini-3.8-flash'))
    expect(within(card).queryByText(NOTICE)).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /^summarize with ai$/i })).not.toBeInTheDocument()
    expect(posts).toEqual([])
  })

  it('sits above the decision buttons', async () => {
    renderPage({ saved: ok({}, true) })
    const card = await findBrief()
    const actions = screen.getByRole('region', { name: /decision actions/i })
    expect(card.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('opens the full brief in a drawer', async () => {
    const { user } = renderPage({ saved: ok({}, true) })
    const card = await findBrief()
    await user.click(within(card).getByRole('button', { name: /full summary/i }))
    const drawer = await screen.findByRole('dialog', { name: /ai summary/i })
    expect(within(drawer).getByText('Catering receipts')).toBeInTheDocument()
    expect(within(drawer).getByText('Total $7,320')).toBeInTheDocument()
    expect(within(drawer).getByText('High')).toBeInTheDocument()
    expect(within(drawer).getByText('Receipts are missing.')).toBeInTheDocument()
  })

  it('generates a brief when none is saved, with a thinking status meanwhile', async () => {
    const { user, posts } = renderPage({ generated: [ok({ summary: '💰 Offsite expenses of $7,320.' })], wait: 300 })
    const card = await findBrief()
    await user.click(within(card).getByRole('button', { name: /^summarize with ai$/i }))
    expect(within(card).getByText('Generating the AI summary.')).toBeInTheDocument()
    expect(THINKING_WORDS.map((w) => `${w}…`)).toContain(within(card).getByText(/…$/).textContent)
    expect(await within(card).findByText('Offsite expenses of $7,320.')).toBeInTheDocument()
    expect(within(card).getByText('💰')).toHaveAttribute('aria-hidden')
    expect(posts).toEqual([''])
  })

  it('regenerate replaces the saved brief', async () => {
    const { user, posts } = renderPage({ saved: ok({}, true), generated: [ok({ summary: 'Second take.' })] })
    const card = await findBrief()
    await user.click(await within(card).findByRole('button', { name: /regenerate summary/i }))
    expect(await within(card).findByText('Second take.')).toBeInTheDocument()
    expect(within(card).queryByText(/Expense report/)).not.toBeInTheDocument()
    expect(posts).toEqual(['?refresh=true'])
  })

  it('a failed regenerate keeps the previous brief', async () => {
    const { user } = renderPage({
      saved: ok({}, true),
      generated: [{ status: 'unavailable', reason: 'timeout', message: 'AI Assist took too long.' }],
    })
    const card = await findBrief()
    await user.click(await within(card).findByRole('button', { name: /regenerate summary/i }))
    expect(await within(card).findByText(/AI Assist took too long\./)).toBeInTheDocument()
    expect(within(card).getByText('Expense report <b>x</b> for the offsite.')).toBeInTheDocument()
  })

  it('shows calm fallback when unavailable and keeps actions enabled', async () => {
    const { user } = renderPage({
      generated: [
        {
          status: 'unavailable',
          reason: 'not_configured',
          message: 'AI Assist is off: no API key configured.',
        },
      ],
    })
    const card = await findBrief()
    await user.click(within(card).getByRole('button', { name: /^summarize with ai$/i }))
    expect(await within(card).findByText('AI Assist is off: no API key configured.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^approve/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /^reject/i })).toBeEnabled()
  })

  it('a non-approve suggestion fills the reject dialog with just the reason', async () => {
    const { user } = renderPage({ saved: ok({}, true) })
    const card = await findBrief()
    await user.click(await within(card).findByRole('button', { name: /use as rejection note/i }))
    const dialog = await screen.findByRole('dialog', { name: /reject/i })
    expect(within(dialog).getByLabelText(/reason/i)).toHaveValue('Please attach the catering receipts.')
  })

  it('an approve suggestion fills the approve dialog with just the reason', async () => {
    const { user } = renderPage({
      saved: ok({ suggested_decision: 'approve', suggested_approval_note: 'All receipts attached.' }, true),
    })
    const card = await findBrief()
    expect(within(card).queryByRole('button', { name: /use as rejection note/i })).not.toBeInTheDocument()
    await user.click(await within(card).findByRole('button', { name: /use as approval note/i }))
    const dialog = await screen.findByRole('dialog', { name: /approve/i })
    expect(within(dialog).getByLabelText(/comment/i)).toHaveValue('All receipts attached.')
  })

  it('stays as a read-only record once the document is decided', async () => {
    renderPage({
      saved: ok({}, true),
      doc: makeDoc({ status: 'approved', can_review: false, decided_at: '2026-11-07T11:00:00Z' }),
    })
    const card = await findBrief()
    expect(await within(card).findByText(/needed more info/i)).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /regenerate|use as|generate/i })).not.toBeInTheDocument()
  })

  it('is hidden on a decided document with no saved brief', async () => {
    renderPage({ doc: makeDoc({ status: 'rejected', can_review: false, decided_at: '2026-11-07T11:00:00Z' }) })
    await screen.findByRole('heading', { name: 'Vendor contract' })
    await briefLoaded()
    expect(screen.queryByRole('region', { name: /^ai summary$/i })).not.toBeInTheDocument()
  })

  it('admins see the saved brief read-only', async () => {
    const { user } = renderPage({ me: avery, saved: ok({}, true), doc: makeDoc({ can_review: false }) })
    const card = await findBrief()
    expect(await within(card).findByText('Expense report <b>x</b> for the offsite.')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /regenerate|use as|generate/i })).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: /full summary/i }))
    const drawer = await screen.findByRole('dialog', { name: /ai summary/i })
    expect(within(drawer).queryByRole('button', { name: /regenerate|use as/i })).not.toBeInTheDocument()
  })

  it('admins see nothing when no brief was generated', async () => {
    renderPage({ me: avery, doc: makeDoc({ can_review: false }) })
    await screen.findByRole('heading', { name: 'Vendor contract' })
    await briefLoaded()
    expect(screen.queryByRole('region', { name: /^ai summary$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^summarize with ai$/i })).not.toBeInTheDocument()
  })
})

describe('notes carry only the reason', () => {
  it('uses the suggested rejection note', () => {
    expect(buildRejectionNote(report)).toBe('Please attach the catering receipts.')
  })

  it('falls back to the one-line rationale, never the whole brief', () => {
    expect(buildRejectionNote({ ...report, suggested_rejection_note: null })).toBe('Receipts are missing.')
    expect(buildApprovalNote({ ...report, suggested_approval_note: undefined })).toBe('Receipts are missing.')
  })

  it('uses the suggested approval note', () => {
    expect(buildApprovalNote({ ...report, suggested_approval_note: ' Looks complete. ' })).toBe('Looks complete.')
  })
})

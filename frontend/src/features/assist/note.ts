import type { AssistReport } from '@/api/types'

/** Turn an AI report into a rejection note: the model's suggestion, or missing items and concerns. */
export function buildRejectionNote(report: AssistReport): string {
  const suggested = report.suggested_rejection_note?.trim()
  if (suggested) return suggested
  const lines: string[] = []
  if (report.missing_items.length) lines.push(`Missing: ${report.missing_items.join('; ')}.`)
  const concerns = report.risk_flags.map((flag) => flag.label)
  if (concerns.length) lines.push(`Concerns: ${concerns.join('; ')}.`)
  return lines.join('\n') || 'Please revise and resubmit.'
}

import type { AssistReport } from '@/api/types'

/** Just the reason for a rejection: the model's note, or its one-line rationale. */
export function buildRejectionNote(report: AssistReport): string {
  return report.suggested_rejection_note?.trim() || report.rationale.trim()
}

/** Just the reason for an approval: the model's note, or its one-line rationale. */
export function buildApprovalNote(report: AssistReport): string {
  return report.suggested_approval_note?.trim() || report.rationale.trim()
}

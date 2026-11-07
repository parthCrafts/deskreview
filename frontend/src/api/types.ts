export type Role = 'submitter' | 'reviewer'
export type Status = 'pending' | 'approved' | 'rejected'
export type Decision = 'approve' | 'reject'

export interface User {
  id: number
  username: string
  display_name: string
  role: Role
}

export interface DemoUser {
  username: string
  display_name: string
  role: Role
}

export interface UserRef {
  id: number
  username: string
  display_name: string
}

export interface FileMeta {
  name: string
  content_type: string
  size: number
  url: string
}

export interface DocEvent {
  id: number
  type: 'submitted' | 'approved' | 'rejected'
  actor: UserRef | null
  from_status: Status | null
  to_status: Status
  comment: string | null
  created_at: string
}

export interface DocumentSummary {
  id: string
  title: string
  kind: 'file' | 'text'
  status: Status
  submitter: UserRef
  file: FileMeta | null
  created_at: string
  decided_at: string | null
  decided_by: UserRef | null
}

export interface DocumentDetail extends DocumentSummary {
  text: string | null
  decision_comment: string | null
  can_review: boolean
  events: DocEvent[]
}

export interface DocumentList {
  count: number
  page: number
  page_size: number
  next: number | null
  previous: number | null
  counts: Record<'all' | Status, number>
  results: DocumentSummary[]
}

export interface RiskFlag {
  label: string
  severity: 'low' | 'medium' | 'high'
  evidence: string
}

export interface AssistReport {
  summary: string
  key_points: string[]
  missing_items: string[]
  risk_flags: RiskFlag[]
  suggested_decision: 'approve' | 'reject' | 'needs_more_info'
  rationale: string
  suggested_rejection_note: string | null
}

export type AssistResponse =
  | {
      status: 'ok'
      provider: string
      model: string
      cached: boolean
      generated_at: string
      report: AssistReport
      notice: string
    }
  | {
      status: 'unavailable'
      reason: 'not_configured' | 'timeout' | 'provider_error' | 'invalid_output' | 'unsupported_content'
      message: string
    }

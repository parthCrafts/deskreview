import type { Status } from '@/api/types'

export const STATUS_LABEL: Record<Status, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

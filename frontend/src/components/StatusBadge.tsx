import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { Status } from '@/api/types'
import { cn } from '@/lib/utils'

const STYLES: Record<Status, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-pending-bg text-pending' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-approved-bg text-approved' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-rejected-bg text-rejected' },
}

/** Status pill with an icon and text, so it never relies on colour alone. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { label, icon: Icon, className: tone } = STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

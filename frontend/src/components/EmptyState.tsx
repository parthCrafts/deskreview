import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

/** A friendly empty result that points to the next action. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: typeof Inbox
}) {
  return (
    <div className="rounded-lg border border-dashed px-6 py-14 text-center">
      <Icon className="mx-auto size-9 text-muted-foreground" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

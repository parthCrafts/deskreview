import { Eye, ShieldCheck, Upload } from 'lucide-react'
import type { Role } from '@/api/types'
import { ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'

const STYLES: Record<Role, { icon: typeof Eye; className: string }> = {
  admin: { icon: ShieldCheck, className: 'bg-role-admin-bg text-role-admin' },
  reviewer: { icon: Eye, className: 'bg-role-reviewer-bg text-role-reviewer' },
  submitter: { icon: Upload, className: 'bg-role-submitter-bg text-role-submitter' },
}

/** A small role pill with an icon, so the role never relies on colour alone. */
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[role]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {ROLE_LABEL[role]}
    </span>
  )
}

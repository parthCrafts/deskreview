import { Users } from 'lucide-react'
import type { AdminUser, Role } from '@/api/types'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { RoleBadge } from '@/components/RoleBadge'
import { ListSkeleton } from '@/components/Skeletons'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime, formatRelative } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/roles'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { useAdminUsers } from './useAdminUsers'

/** Initials for an avatar: "Rita Shah" → "RS". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Who the user is: avatar, name and username. */
function Identity({ user }: { user: AdminUser }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
      >
        {initials(user.display_name || user.username)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{user.display_name || user.username}</span>
        <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
      </span>
    </span>
  )
}

/** "3 total" with a pending / approved / rejected breakdown in status colours. */
function Submissions({ counts }: { counts: AdminUser['submissions'] }) {
  if (!counts.total) return <span className="text-muted-foreground">None</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
      <span className="font-medium">{counts.total}</span>
      <span className="text-xs text-muted-foreground">
        <span className="text-pending">{counts.pending} pending</span>
        {', '}
        <span className="text-approved">{counts.approved} approved</span>
        {', '}
        <span className="text-rejected">{counts.rejected} rejected</span>
      </span>
    </span>
  )
}

/** Decisions made, or a dash for people who don't review. */
function Reviews({ user }: { user: AdminUser }) {
  if (user.role !== 'reviewer' && !user.reviews.total) return <span className="text-muted-foreground">—</span>
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
      <span className="font-medium">{user.reviews.total}</span>
      <span className="text-xs text-muted-foreground">
        {user.reviews.approved} approved, {user.reviews.rejected} rejected
      </span>
    </span>
  )
}

/** Last sign-in, relative with the exact time on hover. */
function LastSeen({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-muted-foreground">Never</span>
  return (
    <time dateTime={iso} title={formatDateTime(iso)}>
      {formatRelative(iso)}
    </time>
  )
}

/** Head-count per role, shown above the table. */
function RoleSummary({ users }: { users: AdminUser[] }) {
  const roles: Role[] = ['admin', 'reviewer', 'submitter']
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <div className="flex items-baseline gap-1.5">
        <dt className="text-muted-foreground">People</dt>
        <dd className="font-semibold tabular-nums">{users.length}</dd>
      </div>
      {roles.map((role) => (
        <div key={role} className="flex items-baseline gap-1.5">
          <dt className="text-muted-foreground">{ROLE_LABEL[role]}s</dt>
          <dd className="font-semibold tabular-nums">{users.filter((u) => u.role === role).length}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Admin Users tab: everyone, their role, what they submitted and what they reviewed. */
export function AdminUsersPage() {
  const query = useAdminUsers()
  const wide = useMediaQuery('(min-width: 768px)')

  let body
  if (query.isPending) body = <ListSkeleton />
  else if (query.isError) body = <ErrorState error={query.error} onRetry={() => query.refetch()} />
  else if (!query.data.length) body = <EmptyState icon={Users} title="No users yet" />
  else if (wide) {
    body = (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Reviews</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="max-w-64">
                  <Identity user={user} />
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                  {!user.is_active && <span className="ml-2 text-xs text-muted-foreground">Deactivated</span>}
                </TableCell>
                <TableCell>
                  <Submissions counts={user.submissions} />
                </TableCell>
                <TableCell>
                  <Reviews user={user} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <LastSeen iso={user.last_login} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  } else {
    body = (
      <ul className="space-y-2">
        {query.data.map((user) => (
          <li key={user.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <Identity user={user} />
              <RoleBadge role={user.role} />
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>
                <Submissions counts={user.submissions} />
              </dd>
              <dt className="text-muted-foreground">Reviews</dt>
              <dd>
                <Reviews user={user} />
              </dd>
              <dt className="text-muted-foreground">Last sign-in</dt>
              <dd>
                <LastSeen iso={user.last_login} />
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access, their role, and what they've submitted and reviewed."
      />
      <div className="space-y-4">
        {query.data && query.data.length > 0 && <RoleSummary users={query.data} />}
        {body}
      </div>
    </>
  )
}

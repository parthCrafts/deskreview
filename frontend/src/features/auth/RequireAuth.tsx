import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '@/api/types'
import { ErrorState } from '@/components/ErrorState'
import { FullPageLoader } from '@/components/FullPageLoader'
import { homePath, useMe } from './useMe'

/** Gate routes on a session (and optionally a role); otherwise redirect. */
export function RequireAuth({ requiredRole }: { requiredRole?: Role }) {
  const me = useMe()
  const location = useLocation()
  if (me.isPending) return <FullPageLoader />
  if (me.isError) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    )
  }
  if (!me.data) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (requiredRole && me.data.role !== requiredRole) return <Navigate to={homePath(me.data)} replace />
  return <Outlet />
}

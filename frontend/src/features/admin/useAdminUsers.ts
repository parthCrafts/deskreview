import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { AdminUser } from '@/api/types'

/** Every user with activity counts (admins only). */
export function useAdminUsers() {
  return useQuery({ queryKey: qk.adminUsers, queryFn: () => apiFetch<AdminUser[]>('/api/v1/admin/users') })
}

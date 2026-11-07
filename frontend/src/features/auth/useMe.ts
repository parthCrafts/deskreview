import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError, apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { DemoUser, User } from '@/api/types'

/** Where a user lands after signing in. */
export function homePath(user: Pick<User, 'role'>): string {
  return user.role === 'reviewer' ? '/review' : '/documents'
}

/** Accept only same-site relative paths as a post-login destination. */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  return next
}

/** Fetch the current user; a 401 means signed out, not an error. */
async function fetchMe(): Promise<User | null> {
  try {
    return await apiFetch<User>('/api/v1/auth/me', { skipAuthRedirect: true })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: fetchMe, staleTime: Infinity })
}

/** Store the new session and go to `next` or the user's home. */
function useOnSignedIn() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  return async (user: User) => {
    // A slower "who am I" probe from page load must not overwrite the new session.
    await queryClient.cancelQueries({ queryKey: qk.me })
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    queryClient.setQueryData(qk.me, user)
    navigate(safeNext(params.get('next')) ?? homePath(user), { replace: true })
  }
}

/** Password login. */
export function useLogin() {
  const onSignedIn = useOnSignedIn()
  return useMutation({
    mutationFn: (body: { username: string; password: string }) =>
      apiFetch<User>('/api/v1/auth/login', { method: 'POST', json: body, skipAuthRedirect: true }),
    onSuccess: onSignedIn,
  })
}

/** One-click demo login. */
export function useDemoLogin() {
  const onSignedIn = useOnSignedIn()
  return useMutation({
    mutationFn: (username: string) =>
      apiFetch<User>('/api/v1/auth/demo-login', { method: 'POST', json: { username }, skipAuthRedirect: true }),
    onSuccess: onSignedIn,
  })
}

/** Demo accounts for the login page; null when demo login is disabled. */
export function useDemoUsers() {
  return useQuery({
    queryKey: ['demo-users'],
    staleTime: Infinity,
    queryFn: async () => {
      try {
        return await apiFetch<DemoUser[]>('/api/v1/auth/demo-users', { skipAuthRedirect: true })
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
  })
}

/** End the session and return to the login page. */
export function useLogout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => apiFetch<void>('/api/v1/auth/logout', { method: 'POST', skipAuthRedirect: true }),
    onSettled: async () => {
      await queryClient.cancelQueries({ queryKey: qk.me })
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      queryClient.setQueryData(qk.me, null)
      navigate('/login', { replace: true })
    },
  })
}

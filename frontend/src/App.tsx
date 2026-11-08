import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { toast } from 'sonner'
import { setUnauthorizedHandler } from '@/api/client'
import { qk } from '@/api/keys'
import { AppShell } from '@/components/AppShell'
import { NotFoundPage } from '@/components/NotFoundPage'
import { AdminDocumentPage } from '@/features/admin/AdminDocumentPage'
import { AdminDocumentsPage } from '@/features/admin/AdminDocumentsPage'
import { AdminUsersPage } from '@/features/admin/AdminUsersPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { homePath, useMe } from '@/features/auth/useMe'
import { DocumentPage } from '@/features/documents/DocumentPage'
import { MyDocumentsPage } from '@/features/documents/MyDocumentsPage'
import { ReviewDocumentPage } from '@/features/review/ReviewDocumentPage'
import { ReviewQueuePage } from '@/features/review/ReviewQueuePage'
import { SubmitPage } from '@/features/submit/SubmitPage'

/** On any 401 mid-session, drop the session; RequireAuth then sends the user to login. */
function SessionExpiryWatcher() {
  const queryClient = useQueryClient()
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!queryClient.getQueryData(qk.me)) return
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      queryClient.setQueryData(qk.me, null)
      toast.error('Your session expired. Please sign in again.', { id: 'session-expired' })
    })
    return () => setUnauthorizedHandler(() => {})
  }, [queryClient])
  return null
}

/** Send `/` to the signed-in user's home. */
function HomeRedirect() {
  const { data: me } = useMe()
  return me ? <Navigate to={homePath(me)} replace /> : null
}

/** Application routes. */
export default function App() {
  return (
    <>
      <SessionExpiryWatcher />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<HomeRedirect />} />
            <Route path="submit" element={<SubmitPage />} />
            <Route path="documents" element={<MyDocumentsPage />} />
            <Route path="documents/:id" element={<DocumentPage />} />
            <Route element={<RequireAuth requiredRole="reviewer" />}>
              <Route path="review" element={<ReviewQueuePage />} />
              <Route path="review/:id" element={<ReviewDocumentPage />} />
            </Route>
            <Route element={<RequireAuth requiredRole="admin" />}>
              <Route path="manage/documents" element={<AdminDocumentsPage />} />
              <Route path="manage/documents/:id" element={<AdminDocumentPage />} />
              <Route path="manage/users" element={<AdminUsersPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

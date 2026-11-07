import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import type { DemoUser, Role } from '@/api/types'
import { Logo } from '@/components/Logo'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { describeError } from '@/lib/errors'
import { homePath, safeNext, useDemoLogin, useDemoUsers, useLogin, useMe } from './useMe'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})
type LoginValues = z.infer<typeof loginSchema>

const ROLE_GROUPS: { role: Role; title: string; description: string }[] = [
  { role: 'reviewer', title: 'Reviewers', description: 'Work the queue and approve or reject.' },
  { role: 'submitter', title: 'Submitters', description: 'Send documents and track their status.' },
]

/** One-click buttons for the seeded demo accounts, grouped by role. */
function DemoAccounts() {
  const demoUsers = useDemoUsers()
  const demoLogin = useDemoLogin()
  if (demoUsers.isPending) return <Skeleton className="h-40 w-full" />
  const users = demoUsers.data
  if (!users?.length) return null
  return (
    <section aria-labelledby="demo-heading" className="space-y-4">
      <div>
        <h2 id="demo-heading" className="font-medium">
          Demo accounts
        </h2>
        <p className="text-sm text-muted-foreground">Pick anyone to look around. No password needed.</p>
      </div>
      {demoLogin.isError && (
        <Alert variant="destructive">
          <AlertDescription>{describeError(demoLogin.error)}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {ROLE_GROUPS.map((group) => (
          <fieldset key={group.role} className="min-w-0 space-y-2">
            <legend className="text-sm font-medium">{group.title}</legend>
            <p className="text-xs text-muted-foreground">{group.description}</p>
            {users
              .filter((u: DemoUser) => u.role === group.role)
              .map((u) => (
                <Button
                  key={u.username}
                  variant="outline"
                  className="h-auto w-full justify-start py-2.5 text-left"
                  disabled={demoLogin.isPending}
                  onClick={() => demoLogin.mutate(u.username)}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                    {u.display_name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{u.display_name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{u.username}</span>
                  </span>
                  {demoLogin.isPending && demoLogin.variables === u.username && (
                    <Loader2 className="ml-auto animate-spin" aria-hidden />
                  )}
                </Button>
              ))}
          </fieldset>
        ))}
      </div>
    </section>
  )
}

/** Username and password form. */
function PasswordForm() {
  const login = useLogin()
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } })
  const { errors } = form.formState
  const loginError =
    login.error instanceof ApiError && login.error.code === 'invalid_credentials'
      ? login.error.message
      : login.error
        ? describeError(login.error)
        : null
  return (
    <section aria-labelledby="password-heading" className="space-y-4">
      <h2 id="password-heading" className="font-medium">
        Username and password
      </h2>
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
        {loginError && (
          <Alert variant="destructive">
            <AlertDescription>{loginError}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            autoComplete="username"
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'username-error' : undefined}
            {...form.register('username')}
          />
          {errors.username && (
            <p id="username-error" className="text-sm text-destructive">
              {errors.username.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...form.register('password')}
          />
          {errors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </Button>
      </form>
    </section>
  )
}

/** Sign-in page: demo accounts first, then the password form. */
export function LoginPage() {
  const me = useMe()
  const [params] = useSearchParams()
  if (me.data) return <Navigate to={safeNext(params.get('next')) ?? homePath(me.data)} replace />
  return (
    <div className="min-h-dvh bg-muted/40 px-4 py-10 sm:py-16">
      <main className="mx-auto max-w-2xl">
        <Logo />
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Sign in to DeskReview</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Submit documents for approval and track every decision, or review what's waiting for you.
        </p>
        <div className="mt-8 space-y-8 rounded-xl border bg-card p-5 shadow-xs sm:p-8">
          <DemoAccounts />
          <div className="max-w-sm">
            <PasswordForm />
          </div>
        </div>
      </main>
    </div>
  )
}

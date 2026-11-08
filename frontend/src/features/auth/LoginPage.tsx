import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { ApiError } from '@/api/client'
import { Logo } from '@/components/Logo'
import { RoleBadge } from '@/components/RoleBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { describeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { homePath, safeNext, useDemoLogin, useDemoUsers, useLogin, useMe } from './useMe'

const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Enter your username.')
    .max(150, 'Usernames are at most 150 characters.')
    .regex(/^[\w.@+-]*$/, 'Usernames only use letters, numbers and . @ + - _'),
  password: z.string().min(1, 'Enter your password.').max(256, 'Passwords are at most 256 characters.'),
})
type LoginValues = z.infer<typeof loginSchema>

/** Initials for an avatar: "Rita Shah" → "RS". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** The seeded demo accounts: one click on "Sign in" starts a session as that user. */
function DemoAccounts() {
  const demoUsers = useDemoUsers()
  const demoLogin = useDemoLogin()
  if (demoUsers.isPending) return <Skeleton className="h-44 w-full rounded-xl" />
  const users = demoUsers.data
  if (!users?.length) return null
  return (
    <section aria-labelledby="demo-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="demo-heading" className="font-medium">
          Demo users
        </h2>
        <p className="text-sm text-muted-foreground">One click, no password needed.</p>
      </div>
      {demoLogin.isError && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{describeError(demoLogin.error)}</AlertDescription>
        </Alert>
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {users.map((u) => {
          const busy = demoLogin.isPending && demoLogin.variables === u.username
          return (
            <li key={u.username}>
              <button
                type="button"
                aria-label={`Sign in as ${u.display_name}`}
                disabled={demoLogin.isPending}
                onClick={() => demoLogin.mutate(u.username)}
                className="group flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                >
                  {initials(u.display_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium leading-tight">{u.display_name}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <RoleBadge role={u.role} className="px-1.5 py-0 text-[11px]" />
                    <span className="truncate text-xs text-muted-foreground">@{u.username}</span>
                  </span>
                </span>
                {busy ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                ) : (
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Username and password form. */
function PasswordForm() {
  const login = useLogin()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { username: '', password: '' },
  })
  const [showPassword, setShowPassword] = useState(false)
  const { errors } = form.formState
  const loginError =
    login.error instanceof ApiError && login.error.code === 'invalid_credentials'
      ? login.error.message
      : login.error
        ? describeError(login.error)
        : null
  return (
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
          autoCapitalize="none"
          spellCheck={false}
          maxLength={150}
          className="h-10"
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
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            maxLength={256}
            className="h-10 pr-10"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...form.register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="h-10 w-full" disabled={login.isPending}>
        {login.isPending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  )
}

const SLIPS = [
  { title: 'Q3 vendor contract', from: 'Alice Chen', stamp: 'Approved', tone: 'approved', tilt: '-rotate-3' },
  { title: 'Marketing budget, Q1', from: 'Ben Okafor', stamp: 'Rejected', tone: 'rejected', tilt: 'rotate-2' },
  { title: 'Remote work policy', from: 'Ben Okafor', stamp: 'In review', tone: 'pending', tilt: '-rotate-1' },
] as const

/** Decorative stack of paper slips with rubber stamps: what the product does, at a glance. */
function DeskPanel() {
  return (
    <aside className="login-desk relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
      <Logo className="text-white [&>span]:bg-white [&>span]:text-[oklch(0.3_0.08_258)]" />
      <div className="relative mx-auto my-6 h-[18.5rem] w-full max-w-sm" aria-hidden>
        {SLIPS.map((slip, i) => (
          <div
            key={slip.title}
            className={cn('login-slip absolute inset-x-0 rounded-md p-5 text-[oklch(0.25_0.02_258)]', slip.tilt)}
            style={{ top: `${i * 5.5}rem`, zIndex: i }}
          >
            <p className="font-medium">{slip.title}</p>
            <p className="mt-0.5 text-xs text-[oklch(0.5_0.02_258)]">from {slip.from}</p>
            <div className="mt-4 space-y-1.5">
              <div className="h-1.5 w-11/12 rounded-full bg-[oklch(0.92_0.01_258)]" />
              <div className="h-1.5 w-3/4 rounded-full bg-[oklch(0.92_0.01_258)]" />
            </div>
            <span className={cn('login-stamp', `login-stamp-${slip.tone}`, i === SLIPS.length - 1 && 'login-stamp-land')}>
              {slip.stamp}
            </span>
          </div>
        ))}
      </div>
      <div>
        <p className="max-w-sm text-2xl font-semibold tracking-tight text-balance">
          Every document gets a clear yes or no.
        </p>
        <p className="mt-2 max-w-sm text-white/70">
          Send it in, follow it through review, and see who decided and why.
        </p>
      </div>
    </aside>
  )
}

/** Sign-in page: the password form, with one-click demo users beneath. */
export function LoginPage() {
  const me = useMe()
  const [params] = useSearchParams()
  if (me.data) return <Navigate to={safeNext(params.get('next')) ?? homePath(me.data)} replace />

  return (
    <div className="grid min-h-dvh bg-background lg:h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <DeskPanel />
      <main className="flex items-start justify-center px-4 py-8 sm:px-8 sm:py-10 lg:items-center lg:overflow-y-auto lg:py-6">
        <div className="w-full max-w-xl">
          <Logo className="lg:hidden" />
          <h1 className="mt-6 text-3xl font-semibold tracking-tight lg:mt-0">Sign in to DeskReview</h1>
          <p className="mt-2 text-muted-foreground">Use your account, or pick a demo user below.</p>
          <div className="mt-6 max-w-sm">
            <PasswordForm />
          </div>
          <div className="mt-8">
            <DemoAccounts />
          </div>
        </div>
      </main>
    </div>
  )
}

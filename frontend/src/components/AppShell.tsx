import { ChevronDown, LogOut } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout, useMe } from '@/features/auth/useMe'
import { cn } from '@/lib/utils'

const ROLE_LABEL = { reviewer: 'Reviewer', submitter: 'Submitter' } as const

/** Signed-in layout: header with role-based navigation and the user menu. */
export function AppShell() {
  const { data: me } = useMe()
  const logout = useLogout()
  if (!me) return null
  const links = [
    ...(me.role === 'reviewer' ? [{ to: '/review', label: 'Review queue' }] : []),
    { to: '/submit', label: 'Submit' },
    { to: '/documents', label: 'My submissions' },
  ]
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="rounded-md">
            <Logo />
          </Link>
          <nav aria-label="Main" className="order-last -mx-1 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-muted font-medium text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto gap-2 py-1.5" aria-label={`${me.display_name}, ${ROLE_LABEL[me.role]}`}>
                  <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-medium">
                    {me.display_name
                      .split(' ')
                      .map((p) => p[0])
                      .join('')}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm leading-tight">{me.display_name}</span>
                    <span className="block text-xs leading-tight text-muted-foreground">{ROLE_LABEL[me.role]}</span>
                  </span>
                  <ChevronDown className="text-muted-foreground" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <span className="block">{me.display_name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {me.username}, {ROLE_LABEL[me.role].toLowerCase()}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ThemeToggle />
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout.mutate()}>
                  <LogOut aria-hidden /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

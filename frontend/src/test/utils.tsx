import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Expose the current in-memory URL to tests. */
function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location" hidden>
      {location.pathname + location.search}
    </output>
  )
}

/** Render a component with a fresh query client, router, tooltips and toasts. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', path }: { route?: string; path?: string } = {},
): RenderResult & { user: UserEvent; queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  const user = userEvent.setup()
  const content = path ? (
    <Routes>
      <Route path={path} element={ui} />
    </Routes>
  ) : (
    ui
  )
  const result = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[route]}>
          {content}
          <LocationProbe />
        </MemoryRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>,
  )
  return { ...result, user, queryClient }
}

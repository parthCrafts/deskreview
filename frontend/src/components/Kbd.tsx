import type { ReactNode } from 'react'

/** A keyboard key hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="hidden min-w-5 sm:inline-grid place-items-center rounded border bg-muted px-1 font-sans text-[0.7rem] text-muted-foreground">
      {children}
    </kbd>
  )
}

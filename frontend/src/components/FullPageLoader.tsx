import { Loader2 } from 'lucide-react'

/** Centered spinner while the session is being checked. */
export function FullPageLoader() {
  return (
    <output className="grid min-h-dvh place-items-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading</span>
    </output>
  )
}

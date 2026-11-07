import { Stamp } from 'lucide-react'

/** The DeskReview wordmark. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Stamp className="size-4" aria-hidden />
      </span>
      DeskReview
    </span>
  )
}

import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

/** Shown for unknown routes and missing documents. */
export function NotFoundPage({ title = 'Page not found' }: { title?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <FileQuestion className="mx-auto size-10 text-muted-foreground" aria-hidden />
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been moved, or you may not have access to it.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/">Go to your documents</Link>
      </Button>
    </div>
  )
}

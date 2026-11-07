import { FilePlus2 } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { DocumentList } from './DocumentList'

/** The signed-in user's own submissions and their status. */
export function MyDocumentsPage() {
  return (
    <>
      <PageHeader
        title="My submissions"
        description="Everything you've sent for review, newest first."
        actions={
          <Button asChild>
            <Link to="/submit">
              <FilePlus2 aria-hidden /> Submit a document
            </Link>
          </Button>
        }
      />
      <DocumentList
        scope="mine"
        basePath="/documents"
        emptyState={
          <EmptyState
            title="No submissions yet"
            description="Upload a file or write text, and track its review here."
            action={
              <Button asChild>
                <Link to="/submit">Submit your first document</Link>
              </Button>
            }
          />
        }
      />
    </>
  )
}

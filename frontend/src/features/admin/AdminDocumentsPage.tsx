import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { DocumentList } from '@/features/documents/DocumentList'

/** Every submission across the team: status, who reviewed it, when, and the decision note. */
export function AdminDocumentsPage() {
  return (
    <>
      <PageHeader
        title="All documents"
        description="Every upload across the team, with its status, who reviewed it and what they decided."
      />
      <DocumentList
        scope="all"
        basePath="/manage/documents"
        showReview
        emptyState={<EmptyState title="No documents yet" description="Submissions from any user will show up here." />}
      />
    </>
  )
}

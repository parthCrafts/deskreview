import { useParams } from 'react-router'
import { AssistPanel } from '@/features/assist/AssistPanel'
import { DocumentLayout, DocumentLoader } from '@/features/documents/DocumentView'

/** Read-only view of any document for admins: preview, saved AI brief, decision and full history. */
export function AdminDocumentPage() {
  const { id = '' } = useParams()
  return (
    <DocumentLoader id={id}>
      {(doc) => (
        <DocumentLayout
          doc={doc}
          back={{ to: '/manage/documents', label: 'All documents' }}
          aside={<AssistPanel doc={doc} />}
        />
      )}
    </DocumentLoader>
  )
}

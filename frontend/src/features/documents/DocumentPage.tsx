import { useParams } from 'react-router'
import { DocumentLayout, DocumentLoader } from './DocumentView'

/** A submitter's view of one document: preview, decision and history. */
export function DocumentPage() {
  const { id = '' } = useParams()
  return (
    <DocumentLoader id={id}>
      {(doc) => <DocumentLayout doc={doc} back={{ to: '/documents', label: 'My submissions' }} />}
    </DocumentLoader>
  )
}

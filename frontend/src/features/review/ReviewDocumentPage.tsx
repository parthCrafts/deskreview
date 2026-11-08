import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { apiFetch } from '@/api/client'
import { qk } from '@/api/keys'
import type { DocumentList } from '@/api/types'
import { AssistPanel } from '@/features/assist/AssistPanel'
import { DocumentLayout, DocumentLoader } from '@/features/documents/DocumentView'
import { useHotkeys } from '@/lib/hotkeys'
import { ReviewActions, type ReviewActionsHandle } from './ReviewActions'
import { ShortcutsHelp } from './ShortcutsHelp'

/** After a decision, open the next pending document, or return to the queue. */
function useGoToNextPending(currentId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async () => {
    const query = { scope: 'all' as const, status: 'pending' as const, q: '', page: 1 }
    try {
      const list = await queryClient.fetchQuery({
        queryKey: qk.documents(query),
        staleTime: 0,
        queryFn: () => apiFetch<DocumentList>('/api/v1/documents?scope=all&status=pending&page=1&page_size=20'),
      })
      const next = list.results.find((d) => d.id !== currentId)
      navigate(next ? `/review/${next.id}` : '/review')
    } catch {
      navigate('/review')
    }
  }
}

/** A reviewer's view of one document with the approve/reject actions. */
export function ReviewDocumentPage() {
  const { id = '' } = useParams()
  const actions = useRef<ReviewActionsHandle>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const goNext = useGoToNextPending(id)
  useHotkeys({ '?': () => setHelpOpen(true) })
  return (
    <>
      <DocumentLoader id={id}>
        {(doc) => (
          <DocumentLayout
            doc={doc}
            back={{ to: '/review', label: 'Reviews' }}
            aside={
              <>
                <AssistPanel
                  doc={doc}
                  onUseNote={(decision, note) =>
                    decision === 'approve' ? actions.current?.openApprove(note) : actions.current?.openReject(note)
                  }
                />
                <ReviewActions ref={actions} doc={doc} onDecided={goNext} />
              </>
            }
          />
        )}
      </DocumentLoader>
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}

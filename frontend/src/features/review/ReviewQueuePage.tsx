import { Keyboard } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { DocumentList } from '@/features/documents/DocumentList'
import { useDocuments, useListParams } from '@/features/documents/useDocuments'
import { useHotkeys } from '@/lib/hotkeys'
import { ShortcutsHelp } from './ShortcutsHelp'

/** The reviewer queue: pending first, with j/k/Enter keyboard navigation. */
export function ReviewQueuePage() {
  const params = useListParams('pending')
  const list = useDocuments({
    scope: 'all',
    status: params.status === 'all' ? undefined : params.status,
    q: params.q,
    page: params.page,
  })
  const results = list.data?.results ?? []
  const resultKey = results.map((d) => d.id).join(',')
  const [selection, setSelection] = useState({ key: resultKey, index: -1 })
  const selected = selection.key === resultKey ? selection.index : -1
  const move = (delta: number) =>
    setSelection({ key: resultKey, index: Math.min(Math.max(selected + delta, 0), results.length - 1) })
  const [helpOpen, setHelpOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    Enter: () => {
      const doc = results[selected]
      if (doc) navigate(`/review/${doc.id}`)
    },
    '/': () => searchRef.current?.focus(),
    '?': () => setHelpOpen(true),
  })

  return (
    <>
      <PageHeader
        title="Reviews"
        description="Every submission, with what still needs a decision first."
        actions={
          <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
            <Keyboard aria-hidden /> Shortcuts
          </Button>
        }
      />
      <DocumentList
        ref={searchRef}
        scope="all"
        basePath="/review"
        defaultStatus="pending"
        selectedIndex={selected}
        emptyState={<EmptyState title="All caught up" description="Nothing is waiting for review right now." />}
      />
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}

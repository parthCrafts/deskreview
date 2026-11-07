import type { DocumentList } from '@/api/types'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StatusFilter } from './useDocuments'

const TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

/** Status filter tabs with per-status counts. */
export function StatusTabs({
  value,
  counts,
  onChange,
}: {
  value: StatusFilter
  counts?: DocumentList['counts']
  onChange: (value: StatusFilter) => void
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as StatusFilter)}>
      <TabsList aria-label="Filter by status">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
            {tab.label}{' '}
            {counts && (
              <span className="rounded-full bg-background/80 px-1.5 text-xs tabular-nums text-muted-foreground">
                {counts[tab.value]}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

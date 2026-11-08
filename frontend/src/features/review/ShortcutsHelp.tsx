import { Kbd } from '@/components/Kbd'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const GROUPS = [
  {
    title: 'Reviews',
    keys: [
      ['j', 'Select next document'],
      ['k', 'Select previous document'],
      ['Enter', 'Open selected document'],
      ['/', 'Search'],
    ],
  },
  {
    title: 'Document',
    keys: [
      ['a', 'Approve'],
      ['r', 'Reject'],
      ['Esc', 'Close dialog'],
    ],
  },
  { title: 'Anywhere in review', keys: [['?', 'Show this help']] },
]

/** Dialog listing the reviewer keyboard shortcuts. */
export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are paused while you type in a field.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-sm font-medium">{group.title}</h3>
              <dl className="space-y-1.5">
                {group.keys.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd>
                      <Kbd>{key}</Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

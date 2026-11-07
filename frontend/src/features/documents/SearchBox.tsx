import { Search } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  delay?: number
}

/** Search input that reports changes after the user pauses typing. */
export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(function SearchBox(
  { value, onChange, placeholder = 'Search by title or person', delay = 300 },
  ref,
) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft((current) => (current.trim() === value ? current : value)), [value])

  useEffect(() => {
    if (draft.trim() === value) return
    const timer = window.setTimeout(() => onChange(draft.trim()), delay)
    return () => window.clearTimeout(timer)
  }, [draft, value, delay, onChange])

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        ref={ref}
        type="search"
        aria-label="Search documents"
        placeholder={placeholder}
        maxLength={100}
        className="pl-8"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  )
})

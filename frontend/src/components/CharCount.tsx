import { cn } from '@/lib/utils'

/** "123 / 200" under a field; turns amber near the limit and red past it. */
export function CharCount({ id, length, max, min }: { id?: string; length: number; max: number; min?: number }) {
  const over = length > max
  const near = !over && length > max * 0.9
  const under = min !== undefined && length > 0 && length < min
  return (
    <span
      id={id}
      className={cn(
        'shrink-0 text-xs text-muted-foreground tabular-nums',
        near && 'text-pending',
        (over || under) && 'font-medium text-destructive',
      )}
    >
      {length.toLocaleString()} / {max.toLocaleString()}
    </span>
  )
}

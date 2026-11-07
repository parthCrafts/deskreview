const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** Human-readable file size, e.g. "2 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`
  return `${number.format(bytes / (1024 * 1024))} MB`
}

/** Absolute date and time in the viewer's locale. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso))
}

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.35],
  ['month', 12],
  ['year', Infinity],
]

/** Relative time such as "5 minutes ago". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  let value = (new Date(iso).getTime() - now.getTime()) / 1000
  for (const [unit, size] of STEPS) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit)
    value /= size
  }
  return formatDateTime(iso)
}

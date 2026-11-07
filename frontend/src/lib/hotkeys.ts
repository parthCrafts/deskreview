import { useEffect, useRef } from 'react'

type HotkeyMap = Record<string, (event: KeyboardEvent) => void>

/** Whether the key event comes from somewhere the user is typing. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')
}

/** Whether the key would activate a focused link, button or other control by itself. */
function activatesTarget(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' && event.key !== ' ') return false
  return event.target instanceof HTMLElement && !!event.target.closest('a[href], button, summary, [role="button"], [role="tab"], [role="menuitem"]')
}

/** Bind single-key shortcuts; ignored while typing, with modifiers, or while a dialog is open (except Escape). */
export function useHotkeys(map: HotkeyMap, opts: { enabled?: boolean } = {}): void {
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  })
  const enabled = opts.enabled ?? true
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return
      const handler = mapRef.current[event.key]
      if (!handler) return
      if (event.key !== 'Escape') {
        if (isTyping(event.target) || activatesTarget(event)) return
        if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      }
      event.preventDefault()
      handler(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

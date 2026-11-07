import { useEffect, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'deskreview-theme'
const listeners = new Set<() => void>()

/** Read the saved theme, falling back to system when storage is unavailable. */
export function getStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // Storage can be blocked (private mode); the default is fine.
  }
  return 'system'
}

/** Whether the OS asks for a dark colour scheme. */
function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resolve a theme choice to the scheme actually shown. */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme
}

/** Apply a theme to the document root. */
export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

/** Save and apply a theme, notifying subscribers. */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Not persisted, but still applied for this visit.
  }
  applyTheme(theme)
  listeners.forEach((listener) => listener())
}

/** Subscribe to theme changes. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The current theme choice and a setter; follows the OS live when set to system. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, () => 'system' as Theme)
  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])
  return [theme, setTheme]
}

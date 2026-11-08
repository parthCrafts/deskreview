import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'

/**
 * Header icon button that flips between light and dark.
 * Until first used, the app follows the OS (the stored default is "system").
 * The icon is driven by the `.dark` class so it stays right when the OS flips.
 */
export function ThemeToggle() {
  const [, setTheme] = useTheme()
  const toggle = () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className="relative size-9 rounded-full text-muted-foreground hover:text-foreground"
    >
      <Sun
        aria-hidden
        className="size-[18px] rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0"
      />
      <Moon
        aria-hidden
        className="absolute size-[18px] rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100"
      />
    </Button>
  )
}

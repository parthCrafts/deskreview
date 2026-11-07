import { Toaster } from '@/components/ui/sonner'
import { resolveTheme, useTheme } from '@/lib/theme'

/** Toasts that follow the chosen theme. */
export function ThemedToaster() {
  const [theme] = useTheme()
  return <Toaster theme={resolveTheme(theme)} position="bottom-right" richColors closeButton />
}

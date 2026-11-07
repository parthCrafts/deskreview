import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { ThemedToaster } from '@/components/ThemedToaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createQueryClient } from '@/lib/queryClient'
import { applyTheme, getStoredTheme } from '@/lib/theme'
import App from './App'
import './index.css'

applyTheme(getStoredTheme())
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        <ThemedToaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)

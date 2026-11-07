import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { toastApiError } from './errors'

/** The app's query client: retry network failures once, never retry 4xx/5xx responses. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.code === 'network_error') toastApiError(error)
      },
    }),
    defaultOptions: {
      queries: {
        retry: (count, error) => error instanceof ApiError && error.code === 'network_error' && count < 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}

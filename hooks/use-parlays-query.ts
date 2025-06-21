import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useParlaysQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.parlays.list({ user_id: userId }),
    queryFn: async () => {
      // Add cache-busting timestamp when data might be stale
      const now = Date.now()
      const cacheParam = `&_t=${now}`
      
      const res = await fetch(`/api/parlays?user_id=${userId}${cacheParam}`, {
        headers: {
          // Add cache-busting headers
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      if (!res.ok) throw new Error('Failed to fetch parlays')
      const data = await res.json()
      return data.parlays
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // Reduced from default to 30 seconds for faster updates
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })
} 
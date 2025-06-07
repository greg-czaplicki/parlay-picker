import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface OddsFreshnessResponse {
  success: boolean
  lastUpdated: string | null
  minutesAgo: number
  isRecent: boolean
  formattedTime: string
  message?: string
}

/**
 * Hook to fetch when odds were last updated
 * Used to show users how fresh the odds data is
 */
export function useOddsFreshness() {
  return useQuery({
    queryKey: queryKeys.oddsFreshness(),
    queryFn: async (): Promise<OddsFreshnessResponse> => {
      const response = await fetch('/api/matchups/last-updated')
      if (!response.ok) {
        throw new Error(`Failed to fetch odds freshness: ${response.statusText}`)
      }
      return response.json()
    },
    staleTime: 1 * 60 * 1000, // 1 minute - refresh relatively frequently 
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute to keep timestamp current
    refetchOnWindowFocus: true, // Refresh when user comes back to tab
    retry: 2,
  })
} 
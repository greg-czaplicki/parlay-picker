import { useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface UseSeasonPlayersQueryParams {
  dataSource: 'data_golf' | 'pga_tour'
  limit?: number
  offset?: number
}

interface SeasonPlayerStats {
  dg_id: number | null
  pga_player_id: string | null
  player_name: string
  sg_total: number | null
  sg_ott: number | null
  sg_app: number | null
  sg_arg: number | null
  sg_putt: number | null
  driving_accuracy: number | null
  driving_distance: number | null
  updated_at: string
  source_updated_at: string | null
}

interface SeasonPlayersResponse {
  success: boolean
  data: SeasonPlayerStats[]
  metadata: {
    dataSource: string
    count: number
    limit: number
    offset: number
  }
}

/**
 * React Query hook for fetching season player statistics via API
 *
 * @param dataSource - The data source to fetch from ('data_golf' or 'pga_tour')
 * @param limit - Number of players to fetch (optional, defaults to 50)
 * @param offset - Offset for pagination (optional, defaults to 0)
 * @returns React Query result with player stats array
 */
export function useSeasonPlayersQuery({
  dataSource,
  limit = 50,
  offset = 0
}: UseSeasonPlayersQueryParams) {
  return useSuspenseQuery({
    queryKey: queryKeys.playerData.season({ dataSource, limit, offset }),
    queryFn: async (): Promise<SeasonPlayerStats[]> => {
      const params = new URLSearchParams({
        dataSource,
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      const response = await fetch(`/api/players/season?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch season players: ${response.statusText}`)
      }
      
      const result: SeasonPlayersResponse = await response.json()
      if (!result.success) {
        throw new Error('API returned error response')
      }
      
      return result.data
    },
    // Optimized for performance - season stats change infrequently
    staleTime: 5 * 60 * 1000, // 5 minutes (increased from 1 minute)
    gcTime: 30 * 60 * 1000, // 30 minutes (increased from 5 minutes) 
    refetchOnWindowFocus: false, // Disable refetch on window focus
    refetchOnMount: false, // Only fetch if stale
    refetchOnReconnect: false, // Don't refetch on reconnect
    retry: 1, // Reduce retries for faster failure
  })
} 
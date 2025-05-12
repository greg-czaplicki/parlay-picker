import { useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'
import type { PlayerSkillRating, PgaTourPlayerStats } from '@/types/definitions'

interface UseSeasonPlayersQueryParams {
  dataSource: 'data_golf' | 'pga_tour'
}

/**
 * useSeasonPlayersQuery
 *
 * Fetches season-long player stats from the selected data source (DataGolf or PGA Tour).
 * Uses React Query for caching and Suspense for loading states.
 *
 * @param dataSource - The data source to fetch from ('data_golf' or 'pga_tour')
 * @returns React Query result with player stats array
 */
export function useSeasonPlayersQuery({
  dataSource
}: UseSeasonPlayersQueryParams) {
  return useSuspenseQuery({
    queryKey: queryKeys.playerData.season({ dataSource }),
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
    queryFn: async () => {
      const supabase = createBrowserClient()
      const table = dataSource === 'pga_tour' ? 'player_season_stats' : 'player_skill_ratings'
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('sg_total', { ascending: false })
      if (error) throw error
      return data || []
    },
  })
} 
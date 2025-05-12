import { useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'
import type { LiveTournamentStat } from '@/types/definitions'

interface UseInTournamentPlayersQueryParams {
  eventId: number | null
  round: string
  eventOptions: { event_id: number; event_name: string }[]
}

/**
 * useInTournamentPlayersQuery
 *
 * Fetches live or historical in-tournament player stats for a given event and round.
 * Uses React Query for caching and Suspense for loading states.
 *
 * @param eventId - The event ID to fetch stats for
 * @param round - The round filter (e.g., 'event_avg', '1', '2', ...)
 * @param eventOptions - List of event options for event name lookup
 * @returns React Query result with player stats array
 */
export function useInTournamentPlayersQuery({
  eventId,
  round,
  eventOptions
}: UseInTournamentPlayersQueryParams) {
  return useSuspenseQuery({
    queryKey: queryKeys.playerData.live(eventId ?? 0, round),
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
    queryFn: async () => {
      const supabase = createBrowserClient()
      let query = supabase
        .from('latest_live_tournament_stats_view')
        .select('*')
      if (round !== 'latest') {
        query = query.eq('round_num', round)
      }
      if (eventId) {
        const selectedEvent = eventOptions.find(e => e.event_id === eventId)
        if (selectedEvent) {
          query = query.eq('event_name', selectedEvent.event_name)
        }
      }
      query = query.order('total', { ascending: true })
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })
} 
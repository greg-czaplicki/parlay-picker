import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'
import type { PlayerSkillRating, LiveTournamentStat, PgaTourPlayerStats } from '@/types/definitions'

interface UsePlayerTableQueryParams {
  eventId: number | null
  dataView: 'season' | 'tournament'
  dataSource: 'data_golf' | 'pga_tour'
  roundFilter: string
  eventOptions: { event_id: number; event_name: string }[]
}

export function usePlayerTableQuery({
  eventId,
  dataView,
  dataSource,
  roundFilter,
  eventOptions
}: UsePlayerTableQueryParams) {
  // Player Skill Ratings (season stats)
  const seasonSkills = useQuery<PlayerSkillRating[], Error>({
    queryKey: queryKeys.playerData.season({ dataSource }),
    enabled: dataView === 'season',
    queryFn: async () => {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from(dataSource === 'pga_tour' ? 'player_season_stats' : 'player_skill_ratings')
        .select('*')
        .order('sg_total', { ascending: false })
        .limit(20)
      if (error) throw error
      return data || []
    },
  })

  // Live Tournament Stats
  const liveStats = useQuery<LiveTournamentStat[], Error>({
    queryKey: queryKeys.playerData.live(eventId ?? 0, roundFilter),
    enabled: dataView === 'tournament' && !!eventId,
    queryFn: async () => {
      const supabase = createBrowserClient()
      let query = supabase
        .from('live_tournament_stats')
        .select('*')
      if (roundFilter !== 'latest') {
        query = query.eq('round_num', roundFilter)
      }
      if (eventId) {
        const selectedEvent = eventOptions.find(e => e.event_id === eventId)
        if (selectedEvent) {
          query = query.eq('event_name', selectedEvent.event_name)
        }
      }
      query = query.order('total', { ascending: true }).limit(20)
      const { data, error } = await query
      if (error) throw error
      return data || []
    },
  })

  // PGA Tour Stats (season)
  const pgaTourStats = useQuery<PgaTourPlayerStats[], Error>({
    queryKey: queryKeys.playerData.season({ dataSource: 'pga_tour' }),
    enabled: dataView === 'season' && dataSource === 'pga_tour',
    queryFn: async () => {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('player_season_stats')
        .select('*')
        .order('sg_total', { ascending: false })
        .limit(20)
      if (error) throw error
      return data || []
    },
  })

  return {
    seasonSkills: seasonSkills.data,
    seasonSkillsLoading: seasonSkills.isLoading,
    seasonSkillsError: seasonSkills.error,
    liveStats: liveStats.data,
    liveStatsLoading: liveStats.isLoading,
    liveStatsError: liveStats.error,
    pgaTourStats: pgaTourStats.data,
    pgaTourStatsLoading: pgaTourStats.isLoading,
    pgaTourStatsError: pgaTourStats.error,
  }
} 
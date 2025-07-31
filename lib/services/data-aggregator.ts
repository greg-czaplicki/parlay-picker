import { createServerClient } from '@/lib/supabase'

// Always use server client for data aggregation
const getSupabaseClient = () => {
  try {
    return createServerClient()
  } catch (error) {
    console.error('Failed to create Supabase server client:', error)
    throw new Error('Supabase configuration missing for server operations')
  }
}

export interface PlayerAnalysisData {
  basicInfo: any[]
  advancedStats: any[]
  recentResults: any[]
  trends: any[]
}

export interface TournamentAnalysisData {
  currentTournaments: any[]
  activeTournamentStats: any[]
  courseData: any[]
}

export interface MatchupAnalysisData {
  currentMatchups: any[]
  oddsData: any[]
  historicalMatchups: any[]
}

export interface ParlayAnalysisData {
  recentParlays: any[]
  successRates: any[]
  profitableStrategies: any[]
}

export class GolfDataAggregator {
  
  async getActiveTournaments(): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      // First: Get tournaments that are currently happening (today is between start and end dates)
      const { data: currentTournaments, error: currentError } = await supabase
        .from('tournaments')
        .select('*')
        .lte('start_date', currentDate)
        .gte('end_date', currentDate)
        .order('start_date', { ascending: false })
        .limit(5)

      if (!currentError && currentTournaments && currentTournaments.length > 0) {
        console.log(`Found ${currentTournaments.length} current tournaments by date`)
        return currentTournaments
      }

      // Second: Try status-based active tournaments
      const { data: activeTournaments, error: activeError } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['active', 'in_progress', 'upcoming'])
        .order('start_date', { ascending: true })
        .limit(5)

      if (!activeError && activeTournaments && activeTournaments.length > 0) {
        console.log(`Found ${activeTournaments.length} active tournaments by status`)
        return activeTournaments
      }

      // Third: Get most recent tournaments with substantial matchup data
      console.log('No active tournaments found, using recent tournaments with most data')
      const { data: recentTournaments, error: recentError } = await supabase
        .from('tournaments')
        .select('*')
        .in('event_id', [100, 10022, 26, 10021, 32]) // Tournaments with most matchup data
        .order('end_date', { ascending: false })
        .limit(5)

      if (recentError) throw recentError
      return recentTournaments || []

    } catch (error) {
      console.error('Error fetching tournaments:', error)
      return []
    }
  }

  async getCurrentMatchups(limit: number = 20): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      // Get tournaments with data first
      const tournaments = await this.getActiveTournaments()
      if (tournaments.length === 0) {
        // Fallback: Get matchups from tournaments with most data
        const { data, error } = await supabase
          .from('betting_markets')
          .select('*')
          .in('event_id', [100, 10022, 26]) // The Open first
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) throw error
        return data || []
      }

      const currentEventIds = tournaments.map(t => t.event_id)

      const { data, error } = await supabase
        .from('betting_markets')
        .select('*')
        .in('event_id', currentEventIds)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching current matchups:', error)
      return []
    }
  }

  async getPlayerAdvancedStats(eventIds: number[], limit: number = 50): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      
      // Get live tournament stats for current events (including The Open)
      let liveStats: any[] = []
      if (eventIds.length > 0) {
        // First get the tournament names for the event IDs
        const { data: tournaments, error: tournamentError } = await supabase
          .from('tournaments')
          .select('event_id, event_name')
          .in('event_id', eventIds)

        if (!tournamentError && tournaments && tournaments.length > 0) {
          const eventNames = tournaments.map(t => t.event_name)
          console.log(`Looking for live stats for tournaments: ${eventNames.join(', ')}`)

          const { data: liveData, error: liveError } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('event_name', eventNames)  // Filter by event names
            .order('dg_id', { ascending: true })  // Order by player ID to ensure consistent results
            .limit(300)  // Increase limit to get full field

          if (!liveError && liveData) {
            liveStats = liveData
            console.log(`Found ${liveStats.length} live tournament stats for events ${eventNames.join(', ')}`)
          } else if (liveError) {
            console.error('Live stats error:', liveError)
          }
        }
      }

      return liveStats
    } catch (error) {
      console.error('Error fetching player advanced stats:', error)
      return []
    }
  }

  async getSeasonStats(limit?: number): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      
      let query = supabase
        .from('player_season_stats')
        .select('*')
        .not('sg_total', 'is', null)
        .order('sg_total', { ascending: false })
      
      if (limit) {
        query = query.limit(limit)
      }
      
      const { data: seasonStats, error: seasonError } = await query

      if (seasonError) throw seasonError
      console.log(`Found ${seasonStats?.length || 0} season stats`)
      return seasonStats || []
    } catch (error) {
      console.error('Error fetching season stats:', error)
      return []
    }
  }

  async getDataGolfSkillRatings(limit?: number): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      
      let query = supabase
        .from('player_skill_ratings')
        .select('*')
        .not('sg_total', 'is', null)
        .order('sg_total', { ascending: false })
      
      if (limit) {
        query = query.limit(limit)
      }
      
      const { data: skillRatings, error: skillError } = await query

      if (skillError) throw skillError
      console.log(`Found ${skillRatings?.length || 0} DataGolf skill ratings`)
      return skillRatings || []
    } catch (error) {
      console.error('Error fetching DataGolf skill ratings:', error)
      return []
    }
  }

  async getPlayerTrends(playerIds?: number[], limit: number = 100): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      let query = supabase
        .from('player_trends')
        .select('*')
        .order('calculated_at', { ascending: false })

      if (playerIds && playerIds.length > 0) {
        query = query.in('dg_id', playerIds)
      }

      const { data, error } = await query.limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching player trends:', error)
      return []
    }
  }

  async getRecentTournamentResults(eventIds: number[], limit: number = 100): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      if (eventIds.length === 0) return []

      // For active tournaments, get current round scores even without final positions
      const { data, error } = await supabase
        .from('tournament_results')
        .select(`
          *,
          tournaments!inner(event_name, course_name)
        `)
        .in('event_id', eventIds)
        .not('total_score', 'is', null) // Changed from final_position to total_score
        .order('total_score', { ascending: true })
        .limit(limit)

      if (error) throw error
      
      console.log(`Found ${data?.length || 0} tournament results for events ${eventIds.join(', ')}`)
      
      return data || []
    } catch (error) {
      console.error('Error fetching recent tournament results:', error)
      return []
    }
  }

  async getHistoricalTournamentResults(limit: number = 50): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()

      // Get historical results from completed tournaments
      const { data, error } = await supabase
        .from('tournament_results')
        .select(`
          *,
          tournaments!inner(event_name, course_name, status)
        `)
        .not('final_position', 'is', null) // Only completed tournaments have final positions
        .order('calculated_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      
      console.log(`Found ${data?.length || 0} historical tournament results`)
      
      return data || []
    } catch (error) {
      console.error('Error fetching historical tournament results:', error)
      return []
    }
  }

  async getHistoricalParlayData(limit: number = 50): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .from('parlays')
        .select(`
          *,
          parlay_picks!inner(
            picked_player_name,
            picked_player_odds,
            pick_outcome,
            outcome
          )
        `)
        .not('outcome', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching historical parlay data:', error)
      return []
    }
  }

  async getParlaySuccessRates(): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      const { data, error } = await supabase
        .rpc('calculate_parlay_success_rates')

      if (error) {
        // Fallback to basic success rate calculation
        const { data: parlayData, error: parlayError } = await supabase
          .from('parlays')
          .select('outcome')
          .not('outcome', 'is', null)

        if (parlayError) throw parlayError

        const total = parlayData?.length || 0
        const won = parlayData?.filter(p => p.outcome === 'won').length || 0
        const lost = parlayData?.filter(p => p.outcome === 'lost').length || 0

        return [{
          total_parlays: total,
          won_parlays: won,
          lost_parlays: lost,
          win_rate: total > 0 ? (won / total * 100).toFixed(2) : '0.00'
        }]
      }

      return data || []
    } catch (error) {
      console.error('Error fetching parlay success rates:', error)
      return []
    }
  }

  async getTopPerformingPlayers(eventIds: number[], limit: number = 20): Promise<any[]> {
    try {
      const supabase = getSupabaseClient()
      if (eventIds.length === 0) return []

      const { data, error } = await supabase
        .from('player_advanced_stats')
        .select(`
          dg_id,
          sg_total,
          sg_ott,
          sg_app,
          sg_arg,
          sg_putt,
          players!inner(name, country)
        `)
        .in('event_id', eventIds)
        .not('sg_total', 'is', null)
        .order('sg_total', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching top performing players:', error)
      return []
    }
  }

  async aggregateAnalysisData(): Promise<{
    tournaments: any[]
    matchups: any[]
    playerStats: any[]
    seasonStats: any[]
    trends: any[]
    recentResults: any[]
    historicalResults: any[]
    historicalParlays: any[]
    successRates: any[]
  }> {
    try {
      // Get active tournaments first
      const tournaments = await this.getActiveTournaments()
      const eventIds = tournaments.map(t => t.event_id)

      // Fetch all data in parallel
      const [
        matchups,
        playerStats,
        seasonStats,
        trends,
        recentResults,
        historicalResults,
        historicalParlays,
        successRates
      ] = await Promise.all([
        this.getCurrentMatchups(30),
        this.getPlayerAdvancedStats(eventIds, 50),
        this.getSeasonStats(100),
        this.getPlayerTrends(undefined, 100),
        this.getRecentTournamentResults(eventIds, 100),
        this.getHistoricalTournamentResults(50),
        this.getHistoricalParlayData(50),
        this.getParlaySuccessRates()
      ])

      return {
        tournaments,
        matchups,
        playerStats,
        seasonStats,
        trends,
        recentResults,
        historicalResults,
        historicalParlays,
        successRates
      }
    } catch (error) {
      console.error('Error aggregating analysis data:', error)
      throw error
    }
  }

  async getPlayerSpecificData(playerName: string): Promise<any> {
    try {
      const supabase = getSupabaseClient()
      // Get player ID
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('dg_id, name')
        .ilike('name', `%${playerName}%`)
        .limit(1)
        .single()

      if (playerError || !playerData) {
        return { error: 'Player not found' }
      }

      const playerId = playerData.dg_id

      // Get recent stats and trends for specific player
      const [advancedStats, trends, recentResults] = await Promise.all([
        supabase
          .from('player_advanced_stats')
          .select('*')
          .eq('dg_id', playerId)
          .order('created_at', { ascending: false })
          .limit(10),
        
        supabase
          .from('player_trends')
          .select('*')
          .eq('dg_id', playerId)
          .order('calculated_at', { ascending: false })
          .limit(20),
        
        supabase
          .from('tournament_results')
          .select(`
            *,
            tournaments!inner(event_name, course_name)
          `)
          .eq('dg_id', playerId)
          .order('calculated_at', { ascending: false })
          .limit(10)
      ])

      return {
        player: playerData,
        advancedStats: advancedStats.data || [],
        trends: trends.data || [],
        recentResults: recentResults.data || []
      }
    } catch (error) {
      console.error('Error fetching player specific data:', error)
      return { error: 'Failed to fetch player data' }
    }
  }
}
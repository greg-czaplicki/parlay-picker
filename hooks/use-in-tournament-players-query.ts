import { useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'
import type { LiveTournamentStat } from '@/types/definitions'

interface UseInTournamentPlayersQueryParams {
  eventId: number | null
  round: string
  eventOptions: { event_id: number; event_name: string }[]
}

// Helper function to detect if scores are raw (stroke count) vs to-par
function isRawScore(score: number | null): boolean {
  if (score === null) return false
  // Raw scores are typically 60-80+ for golf
  // To-par scores are typically -10 to +20
  return score > 50
}

// Helper function to convert raw score to to-par (assumes par 70 for major championships)
function convertToParScore(rawScore: number | null, par: number = 70): number | null {
  if (rawScore === null) return null
  return rawScore - par
}

// Helper function to calculate positions based on total score
function calculatePositions(players: any[]): any[] {
  if (!players || players.length === 0) return players
  
  // Sort by total score (ascending - lower is better)
  const sortedPlayers = [...players].sort((a, b) => {
    const aTotal = a.total ?? 999
    const bTotal = b.total ?? 999
    return aTotal - bTotal
  })
  
  // Calculate positions with ties
  let currentPosition = 1
  let previousScore: number | null = null
  let playersAtPosition = 0
  
  return sortedPlayers.map((player, index) => {
    const currentScore = player.total
    
    if (previousScore !== null && currentScore !== previousScore) {
      currentPosition += playersAtPosition
      playersAtPosition = 1
    } else {
      playersAtPosition++
    }
    
    previousScore = currentScore
    
    // Format position (handle ties)
    let positionDisplay: string
    if (playersAtPosition > 1 || (index < sortedPlayers.length - 1 && sortedPlayers[index + 1].total === currentScore)) {
      positionDisplay = `T${currentPosition}`
    } else {
      positionDisplay = currentPosition.toString()
    }
    
    return {
      ...player,
      position: positionDisplay
    }
  })
}

/**
 * useInTournamentPlayersQuery
 *
 * Fetches live or historical in-tournament player stats for a given event and round.
 * Uses React Query for caching and Suspense for loading states.
 * 
 * When 'live' is selected, it implements intelligent fallback logic:
 * 1. First tries to fetch 'event_avg' data (for completed tournaments)
 * 2. If no 'event_avg' data exists, falls back to the latest available round
 *
 * Also handles data processing for completed rounds:
 * - Converts raw scores to to-par scores when needed
 * - Calculates positions for rounds where API doesn't provide them
 *
 * @param eventId - The event ID to fetch stats for
 * @param round - The round filter (e.g., 'live', 'event_avg', '1', '2', ...)
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
      
      // Find the selected event name
      let eventName: string | null = null
      if (eventId) {
        const selectedEvent = eventOptions.find(e => e.event_id === eventId)
        if (selectedEvent) {
          eventName = selectedEvent.event_name
        }
      }

      // Handle 'live' round with intelligent fallback
      if (round === 'live') {
        // First, try to get 'event_avg' data
        let query = supabase
          .from('live_tournament_stats')
          .select('*')
          .eq('round_num', 'event_avg')
          
        if (eventName) {
          query = query.eq('event_name', eventName)
        }
        
        query = query.order('total', { ascending: true })
        
        const { data: eventAvgData, error: eventAvgError } = await query
        
        // If we have event_avg data, return it (no processing needed)
        if (!eventAvgError && eventAvgData && eventAvgData.length > 0) {
          console.log(`Using 'event_avg' data for live view (${eventAvgData.length} players)`)
          return eventAvgData
        }
        
        // If no event_avg data, try to find the latest available round
        console.log('No event_avg data found, falling back to latest available round')
        
        // Query for available rounds for this event
        let roundsQuery = supabase
          .from('live_tournament_stats')
          .select('round_num')
          
        if (eventName) {
          roundsQuery = roundsQuery.eq('event_name', eventName)
        }
        
        const { data: roundsData } = await roundsQuery
        
        if (roundsData && roundsData.length > 0) {
          // Get unique rounds and sort them in descending order (latest first)
          const availableRounds = [...new Set(roundsData.map(r => r.round_num))]
            .filter(r => r && r !== 'event_avg' && /^\d+$/.test(r)) // Only numeric rounds
            .sort((a, b) => parseInt(b) - parseInt(a)) // Sort descending (4, 3, 2, 1)
          
          console.log('Available rounds:', availableRounds)
          
          if (availableRounds.length > 0) {
            const latestRound = availableRounds[0]
            console.log(`Using latest available round: ${latestRound}`)
            
            // Fetch data for the latest round
            let latestQuery = supabase
              .from('live_tournament_stats')
              .select('*')
              .eq('round_num', latestRound)
              
            if (eventName) {
              latestQuery = latestQuery.eq('event_name', eventName)
            }
            
            latestQuery = latestQuery.order('total', { ascending: true })
            
            const { data: latestData, error: latestError } = await latestQuery
            
            if (!latestError && latestData) {
              return processRoundData(latestData, latestRound, eventName)
            }
          }
        }
        
        // If we get here, no data was found for any round
        console.warn('No tournament data found for live view')
        return []
      }
      
      // Handle specific round requests (non-'live')
      const dbRound = round === 'latest' ? 'event_avg' : round
      
      // For historical rounds (1, 2, 3), use tournament snapshots which have correct historical data
      // For current round (4) and event_avg, use live stats
      const isHistoricalRound = /^[1-3]$/.test(dbRound)
      
      if (isHistoricalRound && eventName) {
        console.log(`Fetching historical data for round ${dbRound} from snapshots`)
        
        // Query tournament snapshots for historical round data
        // Get the latest snapshot for each player for this round
        const { data: snapshotData, error: snapshotError } = await supabase
          .from('latest_tournament_snapshots')
          .select('dg_id, player_name, position, position_numeric, total_score as total, round_score as today, thru, snapshot_timestamp')
          .eq('event_name', eventName)
          .eq('round_num', dbRound)
          .order('total_score', { ascending: true })
        
        if (snapshotError) {
          console.warn(`Snapshot query failed for round ${dbRound}, falling back to live stats:`, snapshotError)
          // Fall through to live stats query below
        } else if (snapshotData && snapshotData.length > 0) {
          console.log(`Found ${snapshotData.length} players in snapshots for round ${dbRound}`)
          console.log(`Sample snapshot data for round ${dbRound}:`, {
            player: snapshotData[0]?.player_name,
            total: snapshotData[0]?.total,
            today: snapshotData[0]?.today,
            position: snapshotData[0]?.position
          })
          
          return processRoundData(snapshotData, dbRound, eventName)
        }
      }
      
      // For current rounds (4, event_avg) or fallback, use live stats
      console.log(`Fetching live data for round ${dbRound}`)
      let query = supabase
        .from('live_tournament_stats')
        .select('*')
        
      if (dbRound !== 'latest') {
        query = query.eq('round_num', dbRound)
      }
      
      if (eventName) {
        query = query.eq('event_name', eventName)
        }
      
      query = query.order('total', { ascending: true })
      
      const { data, error } = await query
      if (error) throw error
      
      const rawData = data || []
      
      // For specific round views, ensure we have cumulative data
      console.log(`Fetched ${rawData.length} players for round ${dbRound}`)
      if (rawData.length > 0) {
        console.log(`Sample player data for round ${dbRound}:`, {
          player: rawData[0]?.player_name,
          total: rawData[0]?.total,
          today: rawData[0]?.today,
          round_num: rawData[0]?.round_num
        })
      }
      
      return processRoundData(rawData, dbRound, eventName)
    },
  })
}

/**
 * Process round data to handle score conversion and position calculation
 */
function processRoundData(data: any[], round: string, eventName: string | null): any[] {
  if (!data || data.length === 0) return data
  
  // Check if this is a round that might have raw scores
  const isSpecificRound = /^\d+$/.test(round) // Round 1, 2, 3, 4
  const hasPositions = data.some(player => player.position !== null)
  
  let processedData = [...data]
  
  // Special handling for specific round views (Round 1, 2, 3, 4)
  if (isSpecificRound) {
    console.log(`Processing specific round view: Round ${round} - showing cumulative score through round ${round}`)
    
    // For specific round views, show cumulative score through that round
    // Keep the 'total' field as is (cumulative score) and use 'today' for round score
    processedData = processedData.map(player => {
      let totalScore = player.total
      let roundScore = player.today
      
      // Handle raw score conversion if needed
      if (totalScore !== null && isRawScore(totalScore)) {
        console.log(`Converting raw total score for ${player.player_name}: ${totalScore} → ${convertToParScore(totalScore)}`)
        totalScore = convertToParScore(totalScore)
      }
      
      if (roundScore !== null && isRawScore(roundScore)) {
        console.log(`Converting raw round score for ${player.player_name}: ${roundScore} → ${convertToParScore(roundScore)}`)
        roundScore = convertToParScore(roundScore)
      }
      
      return {
        ...player,
        total: totalScore,        // Keep cumulative score through this round
        today: roundScore,        // Individual round score
        position: null            // Will be recalculated below
      }
    })
    
    // Recalculate positions based on cumulative total score through this round
    console.log(`Calculating Round ${round} leaderboard based on cumulative scores through round ${round}`)
    processedData = calculatePositions(processedData)
  } else {
    // For cumulative views (live, event_avg), use existing logic
    const sampleScore = processedData.find(p => p.total !== null)?.total
    if (sampleScore && isRawScore(sampleScore)) {
      console.log(`Converting raw scores to to-par for ${round}`)
      processedData = processedData.map(player => ({
        ...player,
        total: convertToParScore(player.total),
        today: convertToParScore(player.today)
      }))
    }
    
    // If positions are missing, calculate them
    if (!hasPositions && processedData.length > 0) {
      console.log(`Calculating positions for ${round}`)
      processedData = calculatePositions(processedData)
    }
  }
  
  return processedData
} 
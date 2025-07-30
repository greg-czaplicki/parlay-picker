import { useSuspenseQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'
import type { LiveTournamentStat } from '@/types/definitions'

interface UseInTournamentPlayersQueryParams {
  eventId: number | null
  round: string
  eventOptions: { dg_id: number; name: string }[]
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
      // TEMPORARY: Return empty data until we implement the new schema queries
      // The live_tournament_stats table no longer exists after the database migration
      console.warn('InTournamentPlayersQuery: live_tournament_stats table migrated to tournament_rounds. Returning empty data until queries are updated.');
      return [];
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
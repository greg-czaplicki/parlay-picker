import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { SettlementService, SettlementMethod } from '@/lib/services/settlement-service'
import { TourDataService } from '@/lib/services/tour-data-service'
import { NextRequest, NextResponse } from 'next/server'

interface CompletedRound {
  event_id: number
  event_name: string
  tour: string
  round_num: number
  unsettled_parlays: number
  unsettled_picks: number
  completed_players: number
  total_players: number
}

/**
 * Settle parlays for completed rounds
 * This endpoint detects when individual rounds are complete and settles parlays immediately,
 * rather than waiting for entire tournaments to finish
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  logger.info('Starting round-based settlement process')

  try {
    // Find rounds that are complete with unsettled parlays
    const completedRounds = await findCompletedRoundsWithUnsettledParlays(supabase)

    if (!completedRounds || completedRounds.length === 0) {
      return jsonSuccess({
        action: 'skipped',
        reason: 'No completed rounds with unsettled parlays found',
        rounds: [],
        settled_rounds: 0,
        total_picks_settled: 0
      }, 'No round settlement needed - all completed rounds are settled')
    }

    logger.info(`Found ${completedRounds.length} completed rounds with unsettled parlays`)

    const results = []
    let totalPicksSettled = 0
    let successfulSettlements = 0
    const settlementService = new SettlementService()

    for (const round of completedRounds) {
      try {
        logger.info(`Processing round: ${round.event_name} Round ${round.round_num} (Event ID: ${round.event_id})`)

        // Attempt settlement for this round
        const settlementResult = await settlementService.settleEvent(round.event_id, SettlementMethod.AUTOMATIC)
        
        if (settlementResult.settled_picks.length > 0) {
          successfulSettlements++
          totalPicksSettled += settlementResult.settled_picks.length
          
          results.push({
            tournament: round.event_name,
            event_id: round.event_id,
            tour: round.tour,
            round_num: round.round_num,
            status: 'settled',
            picks_settled: settlementResult.settled_picks.length,
            errors: settlementResult.errors || []
          })
        } else {
          results.push({
            tournament: round.event_name,
            event_id: round.event_id,
            tour: round.tour,
            round_num: round.round_num,
            status: 'no_settlement_needed',
            picks_settled: 0,
            errors: []
          })
        }

      } catch (error) {
        logger.error(`Error processing round ${round.event_name} R${round.round_num}:`, error)
        results.push({
          tournament: round.event_name,
          event_id: round.event_id,
          tour: round.tour,
          round_num: round.round_num,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          picks_settled: 0
        })
      }
    }

    const message = `Round settlement completed: ${successfulSettlements}/${completedRounds.length} rounds settled, ${totalPicksSettled} picks processed`
    
    logger.info(message, { results })

    return jsonSuccess({
      action: 'completed',
      rounds_processed: completedRounds.length,
      successful_settlements: successfulSettlements,
      total_picks_settled: totalPicksSettled,
      results,
      timestamp: new Date().toISOString()
    }, message)

  } catch (error) {
    logger.error('Error in round-based settlement:', error)
    return handleApiError(error)
  }
}

/**
 * Find rounds that are complete but have unsettled parlays
 */
async function findCompletedRoundsWithUnsettledParlays(supabase: any): Promise<CompletedRound[]> {
  logger.info('Finding completed rounds with unsettled parlays...')

  // Get all unsettled picks grouped by event and round
  const { data: unsettledPicks, error: picksError } = await supabase
    .from('parlay_picks')
    .select('event_id, parlay_id')
    .eq('settlement_status', 'pending')

  if (picksError) {
    logger.error('Error fetching unsettled picks:', picksError)
    throw new Error(`Failed to fetch unsettled picks: ${picksError.message}`)
  }

  if (!unsettledPicks || unsettledPicks.length === 0) {
    logger.info('No unsettled picks found')
    return []
  }

  logger.info(`Found ${unsettledPicks.length} unsettled picks`)

  // Group by event_id and get tournament/round info
  const eventIds = [...new Set(unsettledPicks.map(p => p.event_id))];
  const completedRounds: CompletedRound[] = [];
  
  for (const eventId of eventIds) {
    if (!eventId) continue;
    
    // Get tournament info
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('event_name, tour')
      .eq('event_id', eventId)
      .single();
    
    if (!tournament) continue;
    
    // Get all parlays for this event to determine which rounds have unsettled picks
    const eventPicks = unsettledPicks.filter(p => p.event_id === eventId);
    const { data: parlays } = await supabase
      .from('parlays')
      .select('round_num')
      .in('uuid', eventPicks.map(p => p.parlay_id));
    
    const rounds = [...new Set(parlays?.map(p => p.round_num) || [])];
    
    for (const roundNum of rounds) {
      if (!roundNum) continue;
      
      // Check if this round is complete using DataGolf API
      const isComplete = await isRoundComplete(supabase, eventId, roundNum, tournament.event_name);
      
      if (isComplete.complete) {
        const roundPickCount = eventPicks.length; // Simplified - could be more precise per round
        
        completedRounds.push({
          event_id: eventId,
          event_name: tournament.event_name,
          tour: tournament.tour,
          round_num: roundNum,
          unsettled_parlays: 0,
          unsettled_picks: roundPickCount,
          completed_players: isComplete.completed_players,
          total_players: isComplete.total_players
        });
        
        logger.info(`Round ${roundNum} of ${tournament.event_name} is complete and ready for settlement`)
      }
    }
  }
  
  logger.info(`Found ${completedRounds.length} completed rounds with unsettled parlays`)
  return completedRounds
}

/**
 * Check if a specific round is complete using DataGolf API
 */
async function isRoundComplete(
  supabase: any, 
  eventId: number, 
  roundNum: number, 
  eventName: string
): Promise<{ complete: boolean; completed_players: number; total_players: number }> {
  
  try {
    // Get tournament info to determine tour
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('tour')
      .eq('event_id', eventId)
      .single()
    
    if (!tournament?.tour) {
      logger.warn(`No tour found for event ${eventId}`)
      return { complete: false, completed_players: 0, total_players: 0 }
    }

    const tourType = TourDataService.getTourType(eventName, tournament.tour)
    const playerStats = await TourDataService.fetchPlayerStats(eventId, tourType)
    
    if (!playerStats || playerStats.length === 0) {
      logger.warn(`No player stats available for ${eventName} from DataGolf`)
      return { complete: false, completed_players: 0, total_players: 0 }
    }

    logger.debug(`Checking round ${roundNum} completion for ${eventName} with ${playerStats.length} players`)
    
    let completedPlayers = 0
    let totalPlayers = playerStats.length
    
    for (const player of playerStats) {
      const currentRound = player.round_num || 1
      
      // Player has completed the round if:
      // 1. They are in a later round (round is historical)
      // 2. They are in the same round and have completed 18 holes
      // 3. They have withdrawn/cut (position indicates finished)
      const isHistoricalRound = currentRound > roundNum
      const completedCurrentRound = currentRound === roundNum && (player.thru >= 18)
      const hasFinishedPosition = player.current_pos && !['', 'ACTIVE'].includes(player.current_pos)
      
      if (isHistoricalRound || completedCurrentRound || hasFinishedPosition) {
        completedPlayers++
      }
    }
    
    // Round is complete if at least 80% of players have finished
    // This accounts for withdrawals and other edge cases
    const completionThreshold = Math.max(1, Math.floor(totalPlayers * 0.8))
    const isComplete = completedPlayers >= completionThreshold
    
    logger.info(`Round ${roundNum} completion for ${eventName}: ${completedPlayers}/${totalPlayers} finished (threshold: ${completionThreshold}, complete: ${isComplete})`)
    
    return {
      complete: isComplete,
      completed_players: completedPlayers,
      total_players: totalPlayers
    }
    
  } catch (error) {
    logger.error(`Error checking round completion for ${eventName} R${roundNum}:`, error)
    return { complete: false, completed_players: 0, total_players: 0 }
  }
}

/**
 * GET endpoint to check status of rounds
 */
export async function GET() {
  const supabase = createSupabaseClient()
  
  try {
    // Check for completed rounds with unsettled parlays
    const completedRounds = await findCompletedRoundsWithUnsettledParlays(supabase)

    const needsSettlement = completedRounds && completedRounds.length > 0

    return jsonSuccess({
      status: needsSettlement ? 'settlement_needed' : 'all_settled',
      completed_rounds: completedRounds || [],
      total_unsettled_picks: completedRounds?.reduce((sum, r) => sum + (r.unsettled_picks || 0), 0) || 0,
      recommendation: needsSettlement ? 'Run POST /api/settle-rounds to settle round parlays' : 'No action needed',
      timestamp: new Date().toISOString()
    }, needsSettlement ? 'Settlement needed for completed rounds' : 'All completed rounds are settled')

  } catch (error) {
    logger.error('Error checking round settlement status:', error)
    return handleApiError(error)
  }
}
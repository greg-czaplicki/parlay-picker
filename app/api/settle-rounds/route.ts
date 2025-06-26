import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { SettlementService, SettlementMethod } from '@/lib/services/settlement-service'
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

  // Get all rounds with unsettled picks
  const { data: unsettledData, error: unsettledError } = await supabase
    .from('parlay_picks')
    .select(`
      event_id,
      matchups!inner(
        event_id,
        round_num,
        tournaments!inner(
          event_name,
          tour
        )
      ),
      parlays!inner(
        round_num
      )
    `)
    .eq('settlement_status', 'pending')

  if (unsettledError) {
    logger.error('Error fetching unsettled picks:', unsettledError)
    throw new Error(`Failed to fetch unsettled picks: ${unsettledError.message}`)
  }

  if (!unsettledData || unsettledData.length === 0) {
    logger.info('No unsettled picks found')
    return []
  }

  logger.info(`Found ${unsettledData.length} unsettled picks`)

  // Group by event_id and round_num
  const roundMap = new Map<string, {
    event_id: number
    event_name: string
    tour: string
    round_num: number
    unsettled_count: number
  }>()

  for (const pick of unsettledData) {
    const eventId = pick.event_id || pick.matchups?.event_id
    const roundNum = pick.parlays?.round_num || pick.matchups?.round_num
    const eventName = pick.matchups?.tournaments?.event_name
    const tour = pick.matchups?.tournaments?.tour

    if (!eventId || !roundNum || !eventName) {
      logger.warn('Skipping pick with missing data:', { eventId, roundNum, eventName })
      continue
    }

    const key = `${eventId}-${roundNum}`
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        event_id: eventId,
        event_name: eventName,
        tour: tour,
        round_num: roundNum,
        unsettled_count: 0
      })
    }
    roundMap.get(key)!.unsettled_count++
  }

  logger.info(`Found ${roundMap.size} unique event-round combinations with unsettled picks`)

  // Check which of these rounds are actually complete
  const completedRounds: CompletedRound[] = []

  for (const [key, roundInfo] of roundMap) {
    try {
      const isComplete = await isRoundComplete(supabase, roundInfo.event_id, roundInfo.round_num, roundInfo.event_name)
      
      if (isComplete.complete) {
        completedRounds.push({
          event_id: roundInfo.event_id,
          event_name: roundInfo.event_name,
          tour: roundInfo.tour,
          round_num: roundInfo.round_num,
          unsettled_parlays: 0, // We don't track this at round level
          unsettled_picks: roundInfo.unsettled_count,
          completed_players: isComplete.completed_players,
          total_players: isComplete.total_players
        })

        logger.info(`Round ${roundInfo.event_name} R${roundInfo.round_num} is complete: ${isComplete.completed_players}/${isComplete.total_players} players finished`)
      } else {
        logger.debug(`Round ${roundInfo.event_name} R${roundInfo.round_num} not complete yet: ${isComplete.completed_players}/${isComplete.total_players} players finished`)
      }
    } catch (error) {
      logger.warn(`Error checking completion for ${roundInfo.event_name} R${roundInfo.round_num}:`, error)
    }
  }

  logger.info(`Found ${completedRounds.length} completed rounds with unsettled parlays`)
  return completedRounds
}

/**
 * Check if a specific round is complete
 */
async function isRoundComplete(
  supabase: any, 
  eventId: number, 
  roundNum: number, 
  eventName: string
): Promise<{ complete: boolean; completed_players: number; total_players: number }> {
  
  // Get all players in this round from live_tournament_stats
  const { data: roundStats, error: statsError } = await supabase
    .from('live_tournament_stats')
    .select('dg_id, player_name, thru, position')
    .eq('event_name', eventName)
    .eq('round_num', roundNum.toString())

  if (statsError) {
    logger.warn(`Error fetching stats for ${eventName} R${roundNum}:`, statsError)
    // If we can't fetch stats, assume not complete to be safe
    return { complete: false, completed_players: 0, total_players: 0 }
  }

  if (!roundStats || roundStats.length === 0) {
    logger.debug(`No stats found for ${eventName} R${roundNum}`)
    return { complete: false, completed_players: 0, total_players: 0 }
  }

  // Count completed players (either finished 18 holes or have a final position)
  let completedPlayers = 0
  let totalPlayers = roundStats.length

  for (const player of roundStats) {
    // Player is complete if:
    // 1. They've completed 18 holes (thru >= 18), OR
    // 2. They have a position indicating they're finished (not actively playing)
    const holesCompleted = player.thru || 0
    const hasPosition = player.position && player.position !== ''
    
    if (holesCompleted >= 18 || (hasPosition && !['', 'CUT'].includes(player.position))) {
      completedPlayers++
    }
  }

  // Round is complete if at least 80% of players have finished
  // This accounts for withdrawals and other edge cases
  const completionThreshold = Math.max(1, Math.floor(totalPlayers * 0.8))
  const isComplete = completedPlayers >= completionThreshold

  logger.debug(`Round completion check for ${eventName} R${roundNum}: ${completedPlayers}/${totalPlayers} completed (threshold: ${completionThreshold}, complete: ${isComplete})`)

  return {
    complete: isComplete,
    completed_players: completedPlayers,
    total_players: totalPlayers
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
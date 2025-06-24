import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { NextRequest, NextResponse } from 'next/server'

interface CompletedTournament {
  event_id: number
  event_name: string
  tour: string
  end_date: string
  unsettled_parlays: number
  unsettled_picks: number
}

/**
 * Settle parlays for recently completed tournaments
 * This endpoint handles the gap where tournaments have ended but parlays remain unsettled
 * because the live stats sync stops when tournaments are no longer "active"
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  logger.info('Starting settlement process for completed tournaments')

  try {
    // Find tournaments that ended in the last 7 days with unsettled parlays
    const { data: completedTournaments, error: tournamentsError } = await supabase
      .rpc('get_completed_tournaments_with_unsettled_parlays', {
        days_back: 7
      })

    if (tournamentsError) {
      logger.error('Error finding completed tournaments:', tournamentsError)
      return handleApiError('Failed to find completed tournaments')
    }

    if (!completedTournaments || completedTournaments.length === 0) {
      return jsonSuccess({
        action: 'skipped',
        reason: 'No completed tournaments with unsettled parlays found',
        tournaments: [],
        settled_tournaments: 0,
        total_picks_settled: 0
      }, 'No settlement needed - all recent tournaments are settled')
    }

    logger.info(`Found ${completedTournaments.length} completed tournaments with unsettled parlays`)

    const results = []
    let totalPicksSettled = 0
    let successfulSettlements = 0

    for (const tournament of completedTournaments) {
      try {
        logger.info(`Processing tournament: ${tournament.event_name} (ID: ${tournament.event_id})`)

        // Step 1: Sync final stats for this tournament's tour
        const syncResult = await syncFinalStatsForTour(tournament.tour)
        
        // Step 2: Attempt settlement
        const settlementResult = await settleTournament(tournament.event_id)
        
        if (settlementResult.success) {
          successfulSettlements++
          totalPicksSettled += settlementResult.picks_settled || 0
          
          results.push({
            tournament: tournament.event_name,
            event_id: tournament.event_id,
            tour: tournament.tour,
            status: 'settled',
            picks_settled: settlementResult.picks_settled,
            errors: settlementResult.errors || []
          })
        } else {
          results.push({
            tournament: tournament.event_name,
            event_id: tournament.event_id,
            tour: tournament.tour,
            status: 'failed',
            error: settlementResult.error,
            picks_settled: 0
          })
        }

        // Add delay between tournaments to be respectful to APIs
        if (completedTournaments.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

      } catch (error) {
        logger.error(`Error processing tournament ${tournament.event_name}:`, error)
        results.push({
          tournament: tournament.event_name,
          event_id: tournament.event_id,
          tour: tournament.tour,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          picks_settled: 0
        })
      }
    }

    const message = `Completed tournament settlement: ${successfulSettlements}/${completedTournaments.length} tournaments settled, ${totalPicksSettled} picks processed`
    
    logger.info(message, { results })

    return jsonSuccess({
      action: 'completed',
      tournaments_processed: completedTournaments.length,
      successful_settlements: successfulSettlements,
      total_picks_settled: totalPicksSettled,
      results,
      timestamp: new Date().toISOString()
    }, message)

  } catch (error) {
    logger.error('Error in completed tournament settlement:', error)
    return handleApiError(error)
  }
}

/**
 * Sync final stats for a specific tour
 */
async function syncFinalStatsForTour(tour: string): Promise<{ success: boolean; error?: string }> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/live-stats/sync-tour?tour=${tour}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const result = await response.json()
      logger.info(`Stats sync for ${tour} tour completed:`, result.data || result)
      return { success: true }
    } else {
      const errorText = await response.text()
      logger.warn(`Stats sync failed for ${tour} tour:`, response.status, errorText)
      return { success: false, error: `Sync failed: ${response.status}` }
    }
  } catch (error) {
    logger.error(`Error syncing stats for ${tour} tour:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown sync error' }
  }
}

/**
 * Attempt to settle a specific tournament
 */
async function settleTournament(eventId: number): Promise<{ 
  success: boolean; 
  picks_settled?: number; 
  errors?: string[];
  error?: string 
}> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventId,
        method: 'automatic'
      })
    })

    if (response.ok) {
      const result = await response.json()
      const pickCount = result.data?.settled_picks?.length || result.data?.total_picks || 0
      const errors = result.data?.errors || []
      
      logger.info(`Settlement completed for event ${eventId}:`, {
        picks: pickCount,
        errors: errors.length
      })
      
      return { 
        success: true, 
        picks_settled: pickCount,
        errors 
      }
    } else {
      const errorText = await response.text()
      logger.warn(`Settlement failed for event ${eventId}:`, response.status, errorText)
      return { success: false, error: `Settlement failed: ${response.status}` }
    }
  } catch (error) {
    logger.error(`Error settling tournament ${eventId}:`, error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown settlement error' }
  }
}

/**
 * GET endpoint to check status of completed tournaments
 */
export async function GET() {
  const supabase = createSupabaseClient()
  
  try {
    // Check for completed tournaments with unsettled parlays
    const { data: completedTournaments, error } = await supabase
      .rpc('get_completed_tournaments_with_unsettled_parlays', {
        days_back: 14
      })

    if (error) {
      logger.error('Error checking completed tournaments:', error)
      return handleApiError('Failed to check completed tournaments')
    }

    const needsSettlement = completedTournaments && completedTournaments.length > 0

    return jsonSuccess({
      status: needsSettlement ? 'settlement_needed' : 'all_settled',
      completed_tournaments: completedTournaments || [],
      total_unsettled_parlays: completedTournaments?.reduce((sum: number, t: any) => sum + (t.unsettled_parlays || 0), 0) || 0,
      total_unsettled_picks: completedTournaments?.reduce((sum: number, t: any) => sum + (t.unsettled_picks || 0), 0) || 0,
      recommendation: needsSettlement ? 'Run POST /api/settle-completed to settle parlays' : 'No action needed',
      timestamp: new Date().toISOString()
    }, needsSettlement ? 'Settlement needed for completed tournaments' : 'All completed tournaments are settled')

  } catch (error) {
    logger.error('Error checking settlement status:', error)
    return handleApiError(error)
  }
}
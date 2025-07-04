import { NextRequest } from 'next/server'
import { SettlementService, SettlementMethod } from '@/lib/services/settlement-service'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

interface SettleRequestBody {
  eventId?: number
  method?: SettlementMethod
  autoDetect?: boolean
}

/**
 * Settlement API endpoint
 * POST /api/settle
 * 
 * Supports:
 * - Specific event settlement: { eventId: 123 }
 * - Auto-detect all unsettled events: { autoDetect: true }
 * - Settlement method override: { method: 'manual' }
 */
export async function POST(request: NextRequest) {
  try {
    const body: SettleRequestBody = await request.json().catch(() => ({}))
    const { eventId, method = SettlementMethod.AUTOMATIC, autoDetect = false } = body

    logger.info(`Settlement request: eventId=${eventId}, method=${method}, autoDetect=${autoDetect}`)

    const settlementService = new SettlementService()
    const supabase = createSupabaseClient()

    // Handle auto-detection of events with unsettled parlays
    if (autoDetect || !eventId) {
      const events = await getEventsWithUnsettledParlays(supabase)
      
      if (events.length === 0) {
        return jsonSuccess({
          message: 'No events with unsettled parlays found',
          events_checked: 0,
          total_settlements: 0,
          results: []
        })
      }

      logger.info(`Auto-detected ${events.length} events with unsettled parlays`)

      // Settle all detected events
      const results = []
      let totalSettlements = 0

      for (const event of events) {
        try {
          const result = await settlementService.settleEvent(Number(event.event_id), method)
          results.push(result)
          totalSettlements += result.settled_picks.length
          
          logger.info(`Settled event ${event.event_id}: ${result.settled_picks.length} picks`)
                 } catch (error) {
           const errorMsg = error instanceof Error ? error.message : String(error)
           logger.error(`Failed to settle event ${event.event_id}: ${errorMsg}`)
           results.push({
             event_id: event.event_id,
             error: `Settlement failed: ${errorMsg}`,
             settled_picks: [],
             errors: [errorMsg],
             total_picks: 0,
             settlement_method: method
           })
         }
      }

      return jsonSuccess({
        message: `Auto-settlement completed for ${events.length} events`,
        events_checked: events.length,
        total_settlements: totalSettlements,
        method: method,
        results
      })
    }

    // Handle specific event settlement
    if (!eventId) {
      return handleApiError('Either eventId or autoDetect=true must be provided')
    }

    // Verify event exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour')
      .eq('event_id', eventId)
      .single()

    if (tournamentError || !tournament) {
      return handleApiError(`Tournament with event_id ${eventId} not found`)
    }

    // Settle the specific event
    const result = await settlementService.settleEvent(eventId, method)

    logger.info(`Settlement completed for event ${eventId}: ${result.settled_picks.length} picks settled`)

    return jsonSuccess({
      message: `Settlement completed for event ${eventId}`,
      event_name: tournament.event_name,
      tour: tournament.tour,
      ...result
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Settlement API error: ${errorMsg}`)
    return handleApiError(`Settlement failed: ${errorMsg}`)
  }
}

/**
 * Get events that have unsettled parlay picks
 */
async function getEventsWithUnsettledParlays(supabase: any) {
  logger.info('Fetching events with unsettled parlays...')
  
  // Get unsettled parlay picks with their matchup event_ids
  const { data: pickData, error: pickError } = await supabase
    .from('parlay_picks_v2')
    .select(`
      event_id,
      matchups_v2!inner(event_id)
    `)
    .eq('settlement_status', 'pending')

  if (pickError) {
    logger.error(`Failed to fetch parlay picks: ${pickError.message}`)
    throw new Error(`Failed to fetch parlay picks: ${pickError.message}`)
  }

  logger.info(`Found ${pickData?.length || 0} unsettled picks`)

  // Get unique event IDs from both direct event_id and matchup.event_id
  const eventIds = [...new Set((pickData || []).map((p: any) => {
    // Use direct event_id if available, otherwise use matchup.event_id
    return p.event_id || p.matchups_v2?.event_id
  }).filter(Boolean))]
  
  logger.info(`Unique event IDs with unsettled picks: ${eventIds.join(', ')}`)

  if (eventIds.length === 0) {
    return []
  }

  // Now fetch tournament info for these events
  const { data: tournamentData, error: tournamentError } = await supabase
    .from('tournaments_v2')
    .select('event_id, event_name, tour')
    .in('event_id', eventIds)

  if (tournamentError) {
    logger.error(`Failed to fetch tournaments: ${tournamentError.message}`)
    throw new Error(`Failed to fetch tournaments: ${tournamentError.message}`)
  }

  logger.info(`Found ${tournamentData?.length || 0} tournaments for ${eventIds.length} events`)

  // Map tournaments by event_id
  const tournamentMap = new Map()
  for (const tournament of tournamentData || []) {
    tournamentMap.set(tournament.event_id, tournament)
  }

  // Build final result
  const events = eventIds.map(eventId => {
    const tournament = tournamentMap.get(eventId)
    if (!tournament) {
      logger.warn(`No tournament found for event_id ${eventId}`)
      return null
    }
    return {
      event_id: eventId,
      event_name: tournament.event_name,
      tour: tournament.tour
    }
  }).filter((event): event is NonNullable<typeof event> => event !== null)

  logger.info(`Returning ${events.length} events with tournament data`)
  return events
}

/**
 * GET endpoint to check settlement status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    const supabase = createSupabaseClient()

    if (eventId) {
      // Get settlement status for specific event
      const { data, error } = await supabase
        .from('parlay_picks_v2')
        .select(`
          uuid,
          settlement_status,
          settled_at,
          settlement_notes,
          pick_outcome
        `)
        .eq('event_id', parseInt(eventId))

      if (error) {
        return handleApiError(`Failed to fetch settlement status: ${error.message}`)
      }

      const summary = {
        total_picks: data?.length || 0,
        settled: data?.filter(p => p.settlement_status === 'settled').length || 0,
        pending: data?.filter(p => p.settlement_status === 'pending').length || 0,
        failed: data?.filter(p => p.settlement_status === 'failed').length || 0
      }

      return jsonSuccess({
        event_id: parseInt(eventId),
        summary,
        picks: data
      })
    }

    // Get events with unsettled parlays
    const events = await getEventsWithUnsettledParlays(supabase)
    
    return jsonSuccess({
      message: 'Events with unsettled parlays',
      count: events.length,
      events
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Settlement status check error: ${errorMsg}`)
    return handleApiError(`Failed to check settlement status: ${errorMsg}`)
  }
} 
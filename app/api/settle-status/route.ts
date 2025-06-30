import { NextRequest } from 'next/server'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Simple settlement status check
 * GET /api/settle-status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    logger.info('Checking settlement status...')

    // Get basic parlay picks info
    const { data: allPicks, error: allPicksError } = await supabase
      .from('parlay_picks')
      .select('uuid, settlement_status, event_id, pick_outcome')

    if (allPicksError) {
      logger.error(`Failed to fetch all picks: ${allPicksError.message}`)
      return handleApiError(`Failed to fetch picks: ${allPicksError.message}`)
    }

    // Get unsettled picks
    const { data: pendingPicks, error: pendingError } = await supabase
      .from('parlay_picks')
      .select('uuid, event_id, settlement_status')
      .eq('settlement_status', 'pending')

    if (pendingError) {
      logger.error(`Failed to fetch pending picks: ${pendingError.message}`)
      return handleApiError(`Failed to fetch pending picks: ${pendingError.message}`)
    }

    // Get events from tournaments table
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour')

    if (tournamentsError) {
      logger.error(`Failed to fetch tournaments: ${tournamentsError.message}`)
      return handleApiError(`Failed to fetch tournaments: ${tournamentsError.message}`)
    }

    // Summary stats
    const statusCounts = allPicks?.reduce((acc: any, pick: any) => {
      const status = pick.settlement_status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}) || {}

    const eventIds = [...new Set((pendingPicks || []).map((p: any) => p.event_id).filter(Boolean))]

    const eventDetails = eventIds.map(eventId => {
      const tournament = tournaments?.find((t: any) => t.event_id === eventId)
      const pickCount = pendingPicks?.filter((p: any) => p.event_id === eventId).length || 0
      
      return {
        event_id: eventId,
        tournament_name: tournament?.event_name || 'Unknown',
        tour: tournament?.tour || 'Unknown',
        pending_picks: pickCount
      }
    })

    logger.info(`Status check complete: ${Object.keys(statusCounts).length} status types found`)

    return jsonSuccess({
      summary: {
        total_picks: allPicks?.length || 0,
        status_breakdown: statusCounts,
        pending_picks: pendingPicks?.length || 0,
        events_with_pending: eventIds.length
      },
      events_detail: eventDetails,
      tournaments_count: tournaments?.length || 0
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Status check error: ${errorMsg}`)
    return handleApiError(`Status check failed: ${errorMsg}`)
  }
} 
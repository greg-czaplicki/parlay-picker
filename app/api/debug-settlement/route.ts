import { NextRequest } from 'next/server'
import { TourDataService, TourType } from '@/lib/services/tour-data-service'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Debug settlement issues
 * GET /api/debug-settlement?eventId=123
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return handleApiError('eventId parameter is required')
    }

    const supabase = createSupabaseClient()
    const eventIdNum = parseInt(eventId)

    // Get tournament info
    const { data: tournament } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour')
      .eq('event_id', eventIdNum)
      .single()

    if (!tournament) {
      return handleApiError(`Tournament not found for event ${eventId}`)
    }

    const tourType = TourDataService.getTourType(tournament.event_name, tournament.tour)

    // Get unsettled parlay picks with detailed info
    const { data: pickData, error: pickError } = await supabase
      .from('parlay_picks')
      .select(`
        uuid,
        parlay_id,
        matchup_id,
        pick,
        picked_player_name,
        picked_player_dg_id,
        pick_outcome,
        event_id,
        settlement_status,
        parlays!inner(round_num, uuid),
        matchups!inner(
          uuid,
          round_num,
          type,
          player1_dg_id,
          player1_name,
          player2_dg_id, 
          player2_name,
          player3_dg_id,
          player3_name
        )
      `)
      .eq('event_id', eventIdNum)
      .in('settlement_status', ['pending'])

    if (pickError) {
      return handleApiError(`Failed to fetch picks: ${pickError.message}`)
    }

    // Fetch player stats
    let playerStats: any[] = []
    let statsError = null
    try {
      playerStats = await TourDataService.fetchPlayerStats(eventIdNum, tourType)
    } catch (error) {
      statsError = error instanceof Error ? error.message : String(error)
    }

    // Process picks data
    const picks = (pickData || []).map((pick: any) => ({
      pick_id: pick.uuid,
      parlay_round: pick.parlays?.round_num,
      matchup_round: pick.matchups?.round_num,
      matchup_type: pick.matchups?.type,
      picked_player: {
        dg_id: pick.picked_player_dg_id,
        name: pick.picked_player_name
      },
      matchup_players: [
        { dg_id: pick.matchups?.player1_dg_id, name: pick.matchups?.player1_name },
        { dg_id: pick.matchups?.player2_dg_id, name: pick.matchups?.player2_name },
        pick.matchups?.player3_dg_id ? 
          { dg_id: pick.matchups?.player3_dg_id, name: pick.matchups?.player3_name } : null
      ].filter(Boolean)
    }))

    // Check for data availability issues
    const rounds = [...new Set(picks.map(p => p.parlay_round || p.matchup_round).filter(Boolean))]
    const requiredPlayerIds = [...new Set(picks.flatMap(p => p.matchup_players.filter((mp): mp is NonNullable<typeof mp> => mp !== null).map(mp => mp.dg_id)))]
    const availablePlayerIds = playerStats.map(p => p.dg_id)
    const missingPlayerIds = requiredPlayerIds.filter(id => !availablePlayerIds.includes(id))

    // Round-specific analysis
    const roundAnalysis = rounds.map(round => {
      const roundPicks = picks.filter(p => (p.parlay_round || p.matchup_round) === round)
      const roundPlayerIds = [...new Set(roundPicks.flatMap(p => p.matchup_players.filter((mp): mp is NonNullable<typeof mp> => mp !== null).map(mp => mp.dg_id)))]
      const roundPlayerStats = playerStats.filter(p => !p.round_num || p.round_num === round)
      const roundAvailableIds = roundPlayerStats.map(p => p.dg_id)
      const roundMissingIds = roundPlayerIds.filter(id => !roundAvailableIds.includes(id))

      return {
        round,
        picks_count: roundPicks.length,
        required_players: roundPlayerIds.length,
        available_players: roundAvailableIds.length,
        missing_players: roundMissingIds,
        player_stats_sample: roundPlayerStats.slice(0, 3).map(p => ({
          dg_id: p.dg_id,
          name: p.player_name,
          position: p.current_position,
          round: p.round_num
        }))
      }
    })

    return jsonSuccess({
      tournament: {
        event_id: eventIdNum,
        name: tournament.event_name,
        tour: tournament.tour,
        detected_tour_type: tourType
      },
      picks_summary: {
        total_unsettled: picks.length,
        rounds: rounds,
        picks_by_round: rounds.map(r => ({
          round: r,
          count: picks.filter(p => (p.parlay_round || p.matchup_round) === r).length
        }))
      },
      player_data: {
        stats_fetch_error: statsError,
        total_stats_fetched: playerStats.length,
        required_player_ids: requiredPlayerIds,
        available_player_ids: availablePlayerIds,
        missing_player_ids: missingPlayerIds,
        stats_sample: playerStats.slice(0, 5).map(p => ({
          dg_id: p.dg_id,
          name: p.player_name,
          position: p.current_position,
          round: p.round_num,
          tour_type: p.tour_type
        }))
      },
      round_analysis: roundAnalysis,
      picks_detail: picks.slice(0, 10) // Show first 10 picks for debugging
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`Debug settlement error: ${errorMsg}`)
    return handleApiError(`Debug failed: ${errorMsg}`)
  }
} 
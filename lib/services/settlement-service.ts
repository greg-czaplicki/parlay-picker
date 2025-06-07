import { TourDataService, PlayerStats, TourType } from './tour-data-service'
import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// Settlement outcome types
export enum SettlementOutcome {
  WIN = 'win',
  LOSS = 'loss', 
  PUSH = 'push',
  VOID = 'void'
}

// Settlement method tracking
export enum SettlementMethod {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  OVERRIDE = 'override'
}

// Settlement result for a single pick
export interface PickSettlementResult {
  pick_id: string
  old_outcome?: string
  new_outcome: SettlementOutcome
  settlement_reason: string
  player_stats?: PlayerStats[]
  settlement_data?: any
}

// Overall settlement result
export interface SettlementResult {
  event_id: number
  tour_type: TourType
  settled_picks: PickSettlementResult[]
  errors: string[]
  total_picks: number
  settlement_method: SettlementMethod
}

// Parlay pick from database
interface ParlayPick {
  uuid: string
  parlay_id: string
  matchup_id: string
  pick: number // 1, 2, or 3 (position in matchup)
  picked_player_name?: string
  picked_player_dg_id?: number
  pick_outcome?: string
  event_id?: number
  tour_id?: string
  settlement_status?: string
  round_num?: number // Round this pick is for
}

// Matchup data from database
interface Matchup {
  uuid: string
  event_id: number
  type: string // '2ball' or '3ball'
  player1_dg_id: number
  player1_name: string
  player2_dg_id: number
  player2_name: string
  player3_dg_id?: number
  player3_name?: string
}

export class SettlementService {
  private supabase = createSupabaseClient()

  /**
   * Settle all unsettled parlays for an event
   */
  async settleEvent(eventId: number, method: SettlementMethod = SettlementMethod.AUTOMATIC): Promise<SettlementResult> {
    logger.info(`Starting settlement for event ${eventId} using ${method} method`)

    try {
      // Get tournament info to determine tour type
      const { data: tournament } = await this.supabase
        .from('tournaments')
        .select('event_id, event_name, tour')
        .eq('event_id', eventId)
        .single()

      if (!tournament) {
        throw new Error(`Tournament not found for event ${eventId}`)
      }

      const tourType = TourDataService.getTourType(tournament.event_name, tournament.tour)
      logger.info(`Event ${eventId} identified as ${tourType} tour`)

      // Get unsettled parlay picks for this event
      const unsettledPicks = await this.getUnsettledPicks(eventId)
      logger.info(`Found ${unsettledPicks.length} unsettled picks for event ${eventId}`)

      if (unsettledPicks.length === 0) {
        return {
          event_id: eventId,
          tour_type: tourType,
          settled_picks: [],
          errors: [],
          total_picks: 0,
          settlement_method: method
        }
      }

      // Fetch player stats from appropriate tour API
      const playerStats = await TourDataService.fetchPlayerStats(eventId, tourType)
      logger.info(`Fetched stats for ${playerStats.length} players`)

      // Group picks by matchup for efficient processing
      const picksByMatchup = await this.groupPicksByMatchup(unsettledPicks)

      // Settle each matchup
      const settledPicks: PickSettlementResult[] = []
      const errors: string[] = []

      for (const [matchupId, picks] of picksByMatchup.entries()) {
        try {
          const matchupResults = await this.settleMatchup(matchupId, picks, playerStats, method)
          settledPicks.push(...matchupResults)
        } catch (error) {
          const errorMsg = `Failed to settle matchup ${matchupId}: ${error}`
          logger.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Update database with settlement results
      await this.persistSettlementResults(settledPicks, eventId, tourType, method, playerStats)

      logger.info(`Settlement completed for event ${eventId}: ${settledPicks.length} picks settled, ${errors.length} errors`)

      return {
        event_id: eventId,
        tour_type: tourType,
        settled_picks: settledPicks,
        errors,
        total_picks: unsettledPicks.length,
        settlement_method: method
      }

    } catch (error) {
      logger.error(`Settlement failed for event ${eventId}: ${error}`)
      throw error
    }
  }

  /**
   * Get unsettled parlay picks for an event
   */
  private async getUnsettledPicks(eventId: number): Promise<ParlayPick[]> {
    const { data, error } = await this.supabase
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
        tour_id,
        settlement_status,
        parlays!inner(round_num),
        matchups!inner(round_num)
      `)
      .eq('event_id', eventId)
      .in('settlement_status', ['pending'])

    if (error) {
      throw new Error(`Failed to fetch parlay picks: ${error.message}`)
    }

    // Transform the data to include round_num
    const picks = (data || []).map((pick: any) => ({
      ...pick,
      round_num: pick.parlays?.round_num || pick.matchups?.round_num,
      parlays: undefined, // Remove the joined data 
      matchups: undefined
    }))

    const rounds = [...new Set(picks.map(p => p.round_num).filter(Boolean))]
    logger.info(`Found ${picks.length} unsettled picks across rounds: ${rounds.join(', ')}`)

    return picks
  }

  /**
   * Group picks by matchup for efficient processing
   */
  private async groupPicksByMatchup(picks: ParlayPick[]): Promise<Map<string, ParlayPick[]>> {
    const picksByMatchup = new Map<string, ParlayPick[]>()

    for (const pick of picks) {
      const matchupId = pick.matchup_id
      if (!picksByMatchup.has(matchupId)) {
        picksByMatchup.set(matchupId, [])
      }
      picksByMatchup.get(matchupId)!.push(pick)
    }

    return picksByMatchup
  }

  /**
   * Settle picks for a single matchup
   */
  private async settleMatchup(
    matchupId: string, 
    picks: ParlayPick[], 
    playerStats: PlayerStats[],
    method: SettlementMethod
  ): Promise<PickSettlementResult[]> {
    // Get matchup details
    const { data: matchup } = await this.supabase
      .from('matchups')
      .select('*')
      .eq('uuid', matchupId)
      .single()

    if (!matchup) {
      throw new Error(`Matchup ${matchupId} not found`)
    }

    // Get the round for this set of picks (should all be same round)
    const roundNum = picks[0]?.round_num || matchup.round_num
    if (!roundNum) {
      throw new Error(`Unable to determine round number for matchup ${matchupId}`)
    }

    logger.info(`Settling matchup ${matchupId} for round ${roundNum}`)

    // Filter player stats by round if available (PGA Tour has round-specific data)
    const roundPlayerStats = playerStats.filter(p => 
      !p.round_num || p.round_num === roundNum
    )

    // Find player stats for this matchup
    const player1Stats = roundPlayerStats.find(p => p.dg_id === matchup.player1_dg_id)
    const player2Stats = roundPlayerStats.find(p => p.dg_id === matchup.player2_dg_id)
    const player3Stats = matchup.player3_dg_id ? 
      roundPlayerStats.find(p => p.dg_id === matchup.player3_dg_id) : undefined

    if (!player1Stats || !player2Stats) {
      throw new Error(`Missing player stats for matchup ${matchupId}, round ${roundNum}. Available players: ${roundPlayerStats.map(p => `${p.player_name}(${p.dg_id})`).join(', ')}`)
    }

    if (matchup.player3_dg_id && !player3Stats) {
      throw new Error(`Missing player 3 stats for 3-ball matchup ${matchupId}, round ${roundNum}`)
    }

    // Determine matchup result based on type
    const matchupResult = matchup.type === '3ball' ?
      this.determine3BallResult(player1Stats, player2Stats, player3Stats) :
      this.determine2BallResult(player1Stats, player2Stats)

    // Settle each pick in this matchup
    const settledPicks: PickSettlementResult[] = []

    for (const pick of picks) {
      const result = this.determinePickOutcome(pick, matchupResult, matchup)
      settledPicks.push({
        pick_id: pick.uuid,
        old_outcome: pick.pick_outcome,
        new_outcome: result.outcome,
        settlement_reason: result.reason,
        player_stats: [player1Stats, player2Stats, player3Stats].filter(Boolean) as PlayerStats[],
        settlement_data: {
          matchup_type: matchup.type,
          pick_position: pick.pick,
          matchup_result: matchupResult,
          player_positions: {
            player1: player1Stats.current_position,
            player2: player2Stats.current_position,
            player3: player3Stats?.current_position
          }
        }
      })
    }

    return settledPicks
  }

  /**
   * Determine 2-ball matchup result (round-based)
   */
  private determine2BallResult(player1: PlayerStats, player2: PlayerStats) {
    // Handle withdrawals - if any player withdraws, void the matchup
    const player1Withdrew = this.isWithdrawn(player1)
    const player2Withdrew = this.isWithdrawn(player2)
    
    if (player1Withdrew || player2Withdrew) {
      if (player1Withdrew && player2Withdrew) {
        return { winner: null, reason: 'Both players withdrew', isVoid: true }
      }
      return { winner: null, reason: `Player ${player1Withdrew ? '1' : '2'} withdrew`, isVoid: true }
    }

    // For round-based parlays, compare round scores directly
    const score1 = player1.today_score || player1.total_score || 0
    const score2 = player2.today_score || player2.total_score || 0

    if (score1 < score2) {
      return { winner: 1, reason: `Player 1 shot ${score1}, Player 2 shot ${score2}` }
    }
    if (score2 < score1) {
      return { winner: 2, reason: `Player 2 shot ${score2}, Player 1 shot ${score1}` }
    }

    return { winner: null, reason: `Tie - both shot ${score1}` }
  }

  /**
   * Determine 3-ball matchup result (round-based)
   */
  private determine3BallResult(player1: PlayerStats, player2: PlayerStats, player3?: PlayerStats) {
    if (!player3) {
      throw new Error('Player 3 stats required for 3-ball matchup')
    }

    // Handle withdrawals - if any player withdraws, void the matchup
    const player1Withdrew = this.isWithdrawn(player1)
    const player2Withdrew = this.isWithdrawn(player2)
    const player3Withdrew = this.isWithdrawn(player3)
    
    if (player1Withdrew || player2Withdrew || player3Withdrew) {
      const withdrawnPlayers = []
      if (player1Withdrew) withdrawnPlayers.push('1')
      if (player2Withdrew) withdrawnPlayers.push('2')
      if (player3Withdrew) withdrawnPlayers.push('3')
      
      return { 
        winner: null, 
        reason: `Player${withdrawnPlayers.length > 1 ? 's' : ''} ${withdrawnPlayers.join(', ')} withdrew`, 
        isVoid: true 
      }
    }

    // For round-based parlays, compare round scores directly
    const score1 = player1.today_score || player1.total_score || 0
    const score2 = player2.today_score || player2.total_score || 0
    const score3 = player3.today_score || player3.total_score || 0

    const scores = [
      { score: score1, player: 1 },
      { score: score2, player: 2 },
      { score: score3, player: 3 }
    ]

    // Find the best (lowest) score
    const bestScore = Math.min(score1, score2, score3)
    const winners = scores.filter(s => s.score === bestScore)

    if (winners.length === 1) {
      return { 
        winner: winners[0].player, 
        reason: `Player ${winners[0].player} shot ${bestScore}` 
      }
    }

    return { 
      winner: null, 
      reason: `Tie - players ${winners.map(w => w.player).join(', ')} tied at ${bestScore}` 
    }
  }

  /**
   * Parse position string to number
   */
  private parsePosition(position?: string | number): number | null {
    if (typeof position === 'number') return position
    if (!position) return null

    const str = position.toString().toLowerCase()
    
    // Handle "cut", "mc" (missed cut), or "wd" (withdrew)
    if (str === 'cut' || str === 'mc' || str === 'wd') return null

    // Extract number from position string (e.g., "T5", "1", "T12")
    const match = str.match(/(\d+)/)
    return match ? parseInt(match[1]) : null
  }

  /**
   * Check if player withdrew from tournament
   */
  private isWithdrawn(player: PlayerStats): boolean {
    const position = player.current_position?.toString().toLowerCase()
    return position === 'wd'
  }

  /**
   * Determine pick outcome based on matchup result
   */
  private determinePickOutcome(
    pick: ParlayPick, 
    matchupResult: { winner: number | null; reason: string; isVoid?: boolean },
    matchup: Matchup
  ): { outcome: SettlementOutcome; reason: string } {
    
    // Handle withdrawals - if any player withdrew, void the pick
    if (matchupResult.isVoid) {
      return {
        outcome: SettlementOutcome.VOID,
        reason: `Void: ${matchupResult.reason}`
      }
    }
    
    if (matchupResult.winner === null) {
      return {
        outcome: SettlementOutcome.PUSH,
        reason: `Push: ${matchupResult.reason}`
      }
    }

    if (pick.pick === matchupResult.winner) {
      return {
        outcome: SettlementOutcome.WIN,
        reason: `Win: ${matchupResult.reason}`
      }
    }

    return {
      outcome: SettlementOutcome.LOSS,
      reason: `Loss: ${matchupResult.reason}`
    }
  }

  /**
   * Persist settlement results to database
   */
  private async persistSettlementResults(
    settledPicks: PickSettlementResult[],
    eventId: number,
    tourType: TourType,
    method: SettlementMethod,
    playerStats: PlayerStats[]
  ): Promise<void> {
    const now = new Date().toISOString()

    // Update parlay_picks table
    for (const pick of settledPicks) {
      await this.supabase
        .from('parlay_picks')
        .update({
          pick_outcome: pick.new_outcome,
          settlement_status: 'settled',
          settled_at: now,
          settlement_notes: pick.settlement_reason
        })
        .eq('uuid', pick.pick_id)

      // Insert settlement history record
      await this.supabase
        .from('settlement_history')
        .insert({
          parlay_pick_id: pick.pick_id,
          event_id: eventId,
          tour_type: tourType,
          settlement_method: method,
          old_outcome: pick.old_outcome,
          new_outcome: pick.new_outcome,
          settlement_data: {
            player_stats: pick.player_stats,
            settlement_context: pick.settlement_data,
            all_player_stats: playerStats
          },
          settled_by: 'system',
          settlement_reason: pick.settlement_reason
        })
    }

    // Populate live_tournament_stats with player data for UI display (especially for non-PGA tours)
    await this.populateLiveStats(eventId, tourType, playerStats)

    logger.info(`Persisted ${settledPicks.length} settlement results to database`)
  }

  /**
   * Populate live_tournament_stats table with player data for UI display
   */
  private async populateLiveStats(
    eventId: number,
    tourType: TourType,
    playerStats: PlayerStats[]
  ): Promise<void> {
    try {
      // Get tournament name for the event
      const { data: tournament } = await this.supabase
        .from('tournaments')
        .select('event_name')
        .eq('event_id', eventId)
        .single()

      if (!tournament?.event_name) {
        logger.warn(`No tournament name found for event ${eventId}, skipping live stats population`)
        return
      }

      const eventName = tournament.event_name

      // Delete existing stats for this event to avoid duplicates
      await this.supabase
        .from('live_tournament_stats')
        .delete()
        .eq('event_name', eventName)

      // Convert PlayerStats to live_tournament_stats format with proper score handling
      const liveStatsInserts = playerStats
        .filter(player => player.round_num) // Only include round-specific data
        .map(player => {
          const isHistoricalRound = player.raw_data?.historical_round
          const roundScore = player.raw_data?.round_specific_score
          
          // For historical rounds, use the data from in-play predictions which provides position info
          if (isHistoricalRound && roundScore) {
            return {
              dg_id: player.dg_id,
              player_name: player.player_name,
              event_name: eventName,
              course_name: '', 
              round_num: player.round_num?.toString() || '1',
              position: player.current_position?.toString() || '',
              thru: player.thru || 18, // Historical rounds are complete
              today: roundScore, // Score from in-play predictions
              total: roundScore, // Round score for historical rounds
              data_golf_updated_at: new Date().toISOString()
            }
          }
          
          // For current/live rounds, scores are already relative to par
          return {
            dg_id: player.dg_id,
            player_name: player.player_name,
            event_name: eventName,
            course_name: '',
            round_num: player.round_num?.toString() || '1',
            position: player.current_position?.toString() || '',
            thru: player.thru || 0,
            today: player.today_score || 0, // Already relative to par
            total: player.total_score || 0, // Already relative to par (cumulative)
            data_golf_updated_at: new Date().toISOString()
          }
        })

      // Insert in batches to avoid large queries
      const batchSize = 100
      for (let i = 0; i < liveStatsInserts.length; i += batchSize) {
        const batch = liveStatsInserts.slice(i, i + batchSize)
        const { error } = await this.supabase
          .from('live_tournament_stats')
          .insert(batch)

        if (error) {
          logger.error(`Failed to insert live stats batch for event ${eventId}: ${error.message}`)
        }
      }

      logger.info(`Populated ${liveStatsInserts.length} live stats records for event ${eventId} (${eventName})`)

    } catch (error) {
      logger.error(`Failed to populate live stats for event ${eventId}: ${error}`)
      // Don't throw - this is non-critical for settlement
    }
  }
} 
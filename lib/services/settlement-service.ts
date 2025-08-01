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
  uuid: string | number // Can be string for compatibility or number from v2
  parlay_id: string | number
  matchup_id: string | number
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
        id,
        parlay_id,
        matchup_id,
        pick,
        picked_player_name,
        picked_player_dg_id,
        pick_outcome,
        event_id,
        settlement_status,
        parlays!inner(round_num),
        betting_markets!inner(round_num)
      `)
      .eq('event_id', eventId)
      .in('settlement_status', ['pending'])

    if (error) {
      throw new Error(`Failed to fetch parlay picks: ${error.message}`)
    }

    // Transform the data to include round_num and map id to uuid for compatibility
    const picks = (data || []).map((pick: any) => ({
      ...pick,
      uuid: pick.id, // Map id to uuid for compatibility with existing interface
      round_num: pick.parlays?.round_num || pick.betting_markets?.round_num,
      parlays: undefined, // Remove the joined data 
      betting_markets: undefined
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
    matchupId: number, 
    picks: ParlayPick[], 
    playerStats: PlayerStats[],
    method: SettlementMethod
  ): Promise<PickSettlementResult[]> {
    // Get matchup details
    const { data: matchup } = await this.supabase
      .from('betting_markets')
      .select('*')
      .eq('id', matchupId)
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

    // For historical rounds, try to get stored data first
    const player1Stats = await this.getPlayerStatsForRound(matchup.player1_name, matchup.event_id, roundNum, playerStats)
    const player2Stats = await this.getPlayerStatsForRound(matchup.player2_name, matchup.event_id, roundNum, playerStats)
    const player3Stats = matchup.player3_name ? 
      await this.getPlayerStatsForRound(matchup.player3_name, matchup.event_id, roundNum, playerStats) : undefined

    if (!player1Stats || !player2Stats) {
      throw new Error(`Missing player stats for matchup ${matchupId}, round ${roundNum}. Missing: ${!player1Stats ? matchup.player1_name : ''} ${!player2Stats ? matchup.player2_name : ''}`)
    }

    if (matchup.player3_name && !player3Stats) {
      throw new Error(`Missing player 3 stats for 3-ball matchup ${matchupId}, round ${roundNum}: ${matchup.player3_name}`)
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
   * Get player stats for a specific round, preferring stored data over API data
   */
  private async getPlayerStatsForRound(
    playerName: string, 
    eventId: number, 
    roundNum: number, 
    apiPlayerStats: PlayerStats[]
  ): Promise<PlayerStats | null> {
    try {
      // First, try to get stored data from live_tournament_stats
      const { data: tournament } = await this.supabase
        .from('tournaments')
        .select('event_name')
        .eq('event_id', eventId)
        .single()

      if (tournament?.event_name) {
        const { data: storedStats } = await this.supabase
          .from('live_tournament_stats')
          .select('*')
          .eq('player_name', playerName)
          .eq('event_name', tournament.event_name)
          .eq('round_num', roundNum.toString())
          .single()

        if (storedStats) {
          logger.info(`Using stored stats for ${playerName} Round ${roundNum}: score=${storedStats.today}, thru=${storedStats.thru}`)
          return {
            dg_id: storedStats.dg_id,
            player_name: storedStats.player_name,
            event_id: eventId,
            tour_type: TourType.PGA, // Default for now
            current_position: storedStats.position || 'CUT',
            total_score: storedStats.total || 0,
            today_score: storedStats.today || 0,
            thru: storedStats.thru || 18, // Historical rounds should be complete
            round_num: roundNum,
            finished: true,
            made_cut: storedStats.position !== 'CUT',
            raw_data: storedStats
          }
        }
      }

      // Fallback to API data if stored data not available
      const apiStats = apiPlayerStats.find(p => 
        p.player_name === playerName && p.round_num === roundNum
      )
      
      if (apiStats) {
        logger.info(`Using API stats for ${playerName} Round ${roundNum}`)
        return apiStats
      }

      logger.warn(`No stats found for ${playerName} Round ${roundNum}`)
      return null

    } catch (error) {
      logger.error(`Error getting stats for ${playerName} Round ${roundNum}: ${error}`)
      // Fallback to API data
      return apiPlayerStats.find(p => 
        p.player_name === playerName && p.round_num === roundNum
      ) || null
    }
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

    // Check if both players have completed their round
    const player1Finished = this.isRoundComplete(player1)
    const player2Finished = this.isRoundComplete(player2)
    
    if (!player1Finished || !player2Finished) {
      const player1Thru = player1.thru || 0
      const player2Thru = player2.thru || 0
      throw new Error(`Cannot settle - players have not completed their round. Player 1: ${player1Thru} holes, Player 2: ${player2Thru} holes`)
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

    // Check if all players have completed their round
    const player1Finished = this.isRoundComplete(player1)
    const player2Finished = this.isRoundComplete(player2)
    const player3Finished = this.isRoundComplete(player3)
    
    if (!player1Finished || !player2Finished || !player3Finished) {
      const player1Thru = player1.thru || 0
      const player2Thru = player2.thru || 0
      const player3Thru = player3.thru || 0
      throw new Error(`Cannot settle - players have not completed their round. Player 1: ${player1Thru} holes, Player 2: ${player2Thru} holes, Player 3: ${player3Thru} holes`)
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
   * Check if player has completed their round
   */
  private isRoundComplete(player: PlayerStats): boolean {
    // If explicitly marked as finished, trust that
    if (player.finished === true) return true
    if (player.finished === false) return false
    
    // Check if player was cut or withdrew
    const position = player.current_position?.toString().toUpperCase()
    if (position === 'CUT' || position === 'MC' || position === 'WD') {
      return true // Cut/withdrawn players have completed their participation
    }
    
    // Otherwise check holes completed - standard golf round is 18 holes
    const holesCompleted = player.thru || 0
    return holesCompleted >= 18
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
        .eq('id', pick.pick_id)

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

    // Update parlay outcomes for parlays that have all picks settled
    await this.updateParlayOutcomes(eventId)

    // Populate live_tournament_stats with player data for UI display (especially for non-PGA tours)
    await this.populateLiveStats(eventId, tourType, playerStats)

    logger.info(`Persisted ${settledPicks.length} settlement results to database`)
  }

  /**
   * Update parlay outcomes for parlays where all picks have been settled
   */
  private async updateParlayOutcomes(eventId: number): Promise<void> {
    try {
      // Get all parlays for this event that don't have an outcome yet
      const { data: parlays } = await this.supabase
        .from('parlays')
        .select(`
          id,
          amount,
          total_odds,
          potential_payout,
          parlay_picks!inner(
            id,
            pick_outcome,
            settlement_status
          )
        `)
        .eq('parlay_picks.event_id', eventId)
        .is('outcome', null)

      if (!parlays || parlays.length === 0) {
        return
      }

      // Process each parlay
      for (const parlay of parlays) {
        const picks = parlay.parlay_picks || []
        
        // Check if all picks are settled
        const allSettled = picks.every((pick: any) => 
          pick.settlement_status === 'settled' || 
          (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome))
        )

        if (!allSettled) {
          continue // Skip if not all picks are settled
        }

        // Determine parlay outcome
        let parlayOutcome: string | null = null
        let actualPayout = 0

        const outcomes = picks.map((pick: any) => pick.pick_outcome).filter(Boolean)
        
        // If any pick is a loss, parlay loses
        if (outcomes.includes('loss')) {
          parlayOutcome = 'loss'
          actualPayout = 0
        } 
        // If all picks are void, parlay is void (refund)
        else if (outcomes.every((o: string) => o === 'void')) {
          parlayOutcome = 'void'
          actualPayout = Number(parlay.amount) || 0
        }
        // If all picks are wins or pushes (but at least one push), it's a push
        else if (outcomes.includes('push') && outcomes.every((o: string) => o === 'win' || o === 'push')) {
          parlayOutcome = 'push'
          // For pushes, calculate payout based on wins only
          const winCount = outcomes.filter((o: string) => o === 'win').length
          if (winCount === 0) {
            actualPayout = Number(parlay.amount) || 0 // Full refund if all pushes
          } else {
            // This would require recalculating odds without the pushed picks
            // For now, we'll return the stake
            actualPayout = Number(parlay.amount) || 0
          }
        }
        // If all picks are wins, parlay wins
        else if (outcomes.every((o: string) => o === 'win')) {
          parlayOutcome = 'win'
          actualPayout = Number(parlay.potential_payout) || 0
        }
        // Mixed void/win scenarios
        else if (outcomes.includes('void') && !outcomes.includes('loss')) {
          // If we have voids but no losses, and remaining are wins, it's still a win but with reduced payout
          // For simplicity, we'll mark as push for now
          parlayOutcome = 'push'
          actualPayout = Number(parlay.amount) || 0
        }

        // Update parlay outcome if determined
        if (parlayOutcome) {
          await this.supabase
            .from('parlays')
            .update({
              outcome: parlayOutcome,
              actual_payout: actualPayout,
              payout_amount: actualPayout.toFixed(2)
            })
            .eq('id', parlay.id)

          logger.info(`Updated parlay ${parlay.id} outcome to ${parlayOutcome} with payout ${actualPayout}`)
        }
      }
    } catch (error) {
      logger.error(`Failed to update parlay outcomes for event ${eventId}: ${error}`)
      // Don't throw - this is non-critical for pick settlement
    }
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
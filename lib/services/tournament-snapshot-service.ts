import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export interface TournamentSnapshot {
  id?: number
  event_id: number
  event_name: string
  round_num: string
  snapshot_timestamp: string
  data_source: string
  snapshot_type: 'round_end' | 'live_update' | 'final'
  dg_id: number
  player_name: string
  position?: string
  position_numeric?: number
  total_score?: number
  round_score?: number
  thru?: number
  sg_total?: number
  sg_ott?: number
  sg_app?: number
  sg_arg?: number
  sg_putt?: number
  sg_t2g?: number
  accuracy?: number
  distance?: number
  gir?: number
  prox_fw?: number
  scrambling?: number
  position_change?: number
  momentum_score?: number
  data_golf_updated_at?: string
}

export interface PositionChange {
  event_id: number
  dg_id: number
  player_name: string
  from_round: string
  to_round: string
  from_snapshot_id?: number
  to_snapshot_id?: number
  position_change: number
  from_position_numeric?: number
  to_position_numeric?: number
  score_change?: number
  round_score?: number
  improving: boolean
  streak_rounds: number
}

export interface SnapshotTriggerData {
  eventId: number
  eventName: string
  roundNumber: string
  triggerType: 'round_completion' | 'significant_change' | 'manual'
  triggeredAt: string
  playerCount: number
  dataTimestamp: string
}

export interface SnapshotValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  playerCount: number
  completeness: number // 0-1 score
}

// 🎯 NEW: Enhanced momentum and trend analysis interfaces for Task 30.3
export interface PlayerMomentumAnalysis {
  dg_id: number
  player_name: string
  event_id: number
  current_round: string
  
  // Position Analysis
  current_position: number
  position_trend: 'rising' | 'falling' | 'steady' | 'volatile'
  position_streak: number // consecutive rounds improving/declining
  
  // Score Analysis  
  current_total_score: number
  avg_round_score: number
  best_round_score: number
  worst_round_score: number
  score_consistency: number // 0-100 (100 = very consistent)
  
  // Momentum Indicators
  weighted_momentum: number // -100 to +100 (positive = improving)
  pressure_performance: number // 0-100 (how well under pressure)
  late_round_performance: number // performance in rounds 3-4
  
  // Trajectory Predictions
  projected_finish_position: number
  cut_probability: number // 0-1 (only relevant for rounds 1-2)
  top_10_probability: number // 0-1
  
  // Historical Context
  rounds_played: number
  position_volatility: number // standard deviation of positions
  momentum_direction: 'accelerating' | 'decelerating' | 'steady'
}

export interface TournamentTrendData {
  event_id: number
  event_name: string
  trend_timestamp: string
  
  // Leaderboard Movement
  total_players: number
  cut_line_position: number
  cut_line_score: number
  
  // Top Performers
  rising_stars: PlayerMomentumAnalysis[] // biggest improvers
  falling_players: PlayerMomentumAnalysis[] // biggest decliners
  consistent_performers: PlayerMomentumAnalysis[] // most consistent
  
  // Tournament Dynamics
  leaderboard_volatility: number // how much movement at top
  field_compression: number // how tight the scores are
  momentum_leaders: PlayerMomentumAnalysis[] // highest momentum scores
  
  // Visualization Data
  position_change_matrix: number[][] // [round][position_change_count]
  momentum_distribution: number[] // distribution of momentum scores
  score_progression_data: any[] // for charting score trends
}

// 🎯 NEW: Comprehensive Parlay Analytics Interfaces
export interface PlayerParlayProfile {
  dg_id: number
  player_name: string
  
  // Tournament Finish Trends
  recent_finishes: number[] // last 10 tournament positions
  avg_finish_5: number // average of last 5 tournaments
  avg_finish_10: number // average of last 10 tournaments
  avg_finish_season: number // season average
  finish_trend: 'improving' | 'declining' | 'steady'
  field_strength_adjusted_finish: number
  
  // SG Trends & Patterns
  sg_total_season: number
  sg_total_recent_5: number // last 5 rounds
  sg_total_recent_10: number // last 10 rounds
  sg_total_trend: 'improving' | 'declining' | 'steady'
  
  sg_ott_season: number
  sg_ott_recent: number
  sg_app_season: number
  sg_app_recent: number
  sg_arg_season: number
  sg_arg_recent: number
  sg_putt_season: number
  sg_putt_recent: number
  
  // Round-Specific Performance
  round1_avg: number // R1 scoring average
  round2_avg: number // R2 scoring average  
  round3_avg: number // R3 scoring average (pressure)
  round4_avg: number // R4 scoring average (closing)
  weekend_vs_weekday: number // difference in weekend vs weekday performance
  pressure_round_performance: number // R3/R4 vs R1/R2 performance
  
  // Parlay Matchup History
  twoBall_wins: number
  twoBall_total: number
  twoBall_win_rate: number
  threeBall_wins: number
  threeBall_total: number
  threeBall_win_rate: number
  
  // Head-to-Head Records (vs common opponents)
  h2h_records: HeadToHeadRecord[]
  
  // Course & Context Performance
  course_performance: CoursePerformanceRecord[]
  course_type_performance: { [courseType: string]: number }
  weather_performance: { [condition: string]: number }
  
  // Advanced Parlay Indicators
  consistency_score: number // 0-100 (reliability for parlays)
  volatility_score: number // 0-100 (risk assessment)
  clutch_performance: number // late round performance under pressure
  form_trajectory: 'hot' | 'cold' | 'steady' | 'inconsistent'
  
  // Prediction Confidence
  prediction_confidence: number // 0-100 based on data completeness
  last_updated: string
}

export interface HeadToHeadRecord {
  opponent_dg_id: number
  opponent_name: string
  matchups_played: number
  wins: number
  losses: number
  win_rate: number
  avg_score_differential: number
  last_matchup_date: string
}

export interface CoursePerformanceRecord {
  course_name: string
  rounds_played: number
  avg_score: number
  best_finish: number
  last_played: string
  sg_total_avg: number
}

export interface MatchupPredictionData {
  matchup_id: string
  players: PlayerParlayProfile[]
  matchup_type: '2ball' | '3ball'
  
  // Prediction Factors
  favorite_player: {
    dg_id: number
    confidence: number
    key_advantages: string[]
  }
  
  // Head-to-Head Analysis
  h2h_summary: {
    has_history: boolean
    total_matchups: number
    results_summary: string
  }
  
  // Form Analysis
  form_comparison: {
    hot_players: number[]
    cold_players: number[]
    form_edge: string
  }
  
  // Course Fit Analysis
  course_advantages: {
    [dgId: number]: {
      course_edge: number
      course_experience: number
      similar_course_performance: number
    }
  }
  
  // Parlay Value Assessment
  parlay_value: {
    recommended_pick: number
    confidence_level: 'high' | 'medium' | 'low'
    value_reasons: string[]
    risk_factors: string[]
  }
}

/**
 * Enhanced Tournament Snapshot Service with Complete Parlay Analytics
 * Captures everything needed for 2ball/3ball matchup prediction
 */
export class TournamentSnapshotService {
  private supabase = createSupabaseClient()
  private readonly ROUND_COMPLETION_THRESHOLD = 0.8
  private readonly MIN_PLAYERS_FOR_SNAPSHOT = 10
  private readonly RETRY_ATTEMPTS = 3
  private readonly RETRY_DELAY_MS = 5000

  // 🎯 NEW: Parlay Analytics Configuration
  private readonly PARLAY_ANALYSIS_CONFIG = {
    recent_tournaments_count: 10,
    recent_rounds_count: 5,
    extended_rounds_count: 10,
    min_matchups_for_h2h: 3,
    course_similarity_threshold: 0.7,
    form_trend_rounds: 5
  }

  /**
   * AUTOMATIC TRIGGER SYSTEM - Main entry point for round completion detection
   * Called from sync routes to check if snapshots should be triggered
   */
  async checkAndTriggerSnapshots(
    eventName: string,
    roundNumber: string,
    syncTimestamp: string
  ): Promise<{ triggered: boolean; reason?: string; error?: string }> {
    try {
      logger.info(`Checking snapshot triggers for ${eventName}, round ${roundNumber}`)

      // 1. Get tournament info
      const { data: tournament } = await this.supabase
        .from('tournaments')
        .select('event_id, event_name')
        .eq('event_name', eventName)
        .single()

      if (!tournament) {
        return { triggered: false, reason: 'Tournament not found' }
      }

      // 2. Check if we already have a recent snapshot for this round
      const recentSnapshot = await this.hasRecentSnapshot(tournament.event_id, roundNumber)
      if (recentSnapshot) {
        return { triggered: false, reason: 'Recent snapshot already exists' }
      }

      // 3. Analyze round completion status
      const roundStatus = await this.analyzeRoundCompletion(eventName, roundNumber)
      
      // 4. Determine if we should trigger a snapshot
      const shouldTrigger = this.shouldTriggerSnapshot(roundStatus, roundNumber)
      
      if (!shouldTrigger.trigger) {
        return { triggered: false, reason: shouldTrigger.reason }
      }

      // 5. Queue snapshot creation asynchronously
      const triggerData: SnapshotTriggerData = {
        eventId: tournament.event_id,
        eventName: tournament.event_name,
        roundNumber,
        triggerType: (shouldTrigger.triggerType as 'round_completion' | 'significant_change') || 'round_completion',
        triggeredAt: new Date().toISOString(),
        playerCount: roundStatus.totalPlayers,
        dataTimestamp: syncTimestamp
      }

      // Process snapshot asynchronously to avoid blocking sync
      this.processSnapshotQueue(triggerData).catch(error => {
        logger.error('Async snapshot processing failed:', error)
      })

      logger.info(`Snapshot triggered for ${eventName}, round ${roundNumber}`)
      return { triggered: true }

    } catch (error) {
      logger.error('Failed to check snapshot triggers:', error)
      return { 
        triggered: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Analyzes current round completion status
   */
  private async analyzeRoundCompletion(eventName: string, roundNumber: string) {
    const { data: players } = await this.supabase
      .from('live_tournament_stats')
      .select('dg_id, player_name, thru, position')
      .eq('event_name', eventName)
      .eq('round_num', roundNumber)

    if (!players || players.length === 0) {
      return {
        totalPlayers: 0,
        completedPlayers: 0,
        completionRate: 0,
        avgThru: 0,
        hasPositions: false
      }
    }

    const completedPlayers = players.filter(p => (p.thru || 0) >= 18).length
    const completionRate = completedPlayers / players.length
    const avgThru = players.reduce((sum, p) => sum + (p.thru || 0), 0) / players.length
    const hasPositions = players.some(p => p.position && p.position !== '')

    return {
      totalPlayers: players.length,
      completedPlayers,
      completionRate,
      avgThru,
      hasPositions
    }
  }

  /**
   * Determines if a snapshot should be triggered based on round status
   */
  private shouldTriggerSnapshot(
    roundStatus: any, 
    roundNumber: string
  ): { trigger: boolean; reason: string; triggerType?: string } {
    
    // Not enough players
    if (roundStatus.totalPlayers < this.MIN_PLAYERS_FOR_SNAPSHOT) {
      return { 
        trigger: false, 
        reason: `Insufficient players (${roundStatus.totalPlayers} < ${this.MIN_PLAYERS_FOR_SNAPSHOT})` 
      }
    }

    // Round completion trigger (most common)
    if (roundStatus.completionRate >= this.ROUND_COMPLETION_THRESHOLD) {
      return { 
        trigger: true, 
        reason: `Round completion detected (${Math.round(roundStatus.completionRate * 100)}% complete)`,
        triggerType: 'round_completion'
      }
    }

    // High average through with positions (indicating active round)
    if (roundStatus.avgThru >= 15 && roundStatus.hasPositions) {
      return { 
        trigger: true, 
        reason: `Significant progress detected (avg thru: ${Math.round(roundStatus.avgThru)})`,
        triggerType: 'significant_change'
      }
    }

    return { 
      trigger: false, 
      reason: `Round in progress (${Math.round(roundStatus.completionRate * 100)}% complete, avg thru: ${Math.round(roundStatus.avgThru)})` 
    }
  }

  /**
   * Checks if we have a recent snapshot for this event/round
   */
  private async hasRecentSnapshot(eventId: number, roundNumber: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data } = await this.supabase
      .from('tournament_round_snapshots')
      .select('id')
      .eq('event_id', eventId)
      .eq('round_num', roundNumber)
      .gte('snapshot_timestamp', oneHourAgo)
      .limit(1)

    return (data?.length || 0) > 0
  }

  /**
   * QUEUE-BASED ASYNC PROCESSING
   * Processes snapshot creation with retry logic
   */
  private async processSnapshotQueue(triggerData: SnapshotTriggerData): Promise<void> {
    logger.info(`Processing snapshot queue for event ${triggerData.eventId}, round ${triggerData.roundNumber}`)

    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        // 1. Validate data before processing
        const validation = await this.validateSnapshotData(
          triggerData.eventName, 
          triggerData.roundNumber
        )

        if (!validation.isValid) {
          logger.warn(`Snapshot validation failed (attempt ${attempt}):`, validation.errors)
          
          if (attempt === this.RETRY_ATTEMPTS) {
            logger.error(`All snapshot attempts failed for ${triggerData.eventName}, round ${triggerData.roundNumber}`)
            return
          }
          
          // Wait before retry
          await this.delay(this.RETRY_DELAY_MS * attempt)
          continue
        }

        // 2. Create the snapshot
        const snapshotType = this.getSnapshotType(triggerData.triggerType, triggerData.roundNumber)
        const result = await this.createTournamentSnapshot(
          triggerData.eventId,
          triggerData.roundNumber,
          snapshotType
        )

        if (result.success) {
          logger.info(`Successfully created snapshot for ${triggerData.eventName}, round ${triggerData.roundNumber} (attempt ${attempt})`)
          
          // 3. Log snapshot metadata for tracking
          await this.logSnapshotMetadata(triggerData, result.snapshotIds || [], validation)
          return
        } else {
          logger.warn(`Snapshot creation failed (attempt ${attempt}): ${result.error}`)
        }

      } catch (error) {
        logger.error(`Snapshot processing error (attempt ${attempt}):`, error)
      }

      // Wait before retry (exponential backoff)
      if (attempt < this.RETRY_ATTEMPTS) {
        await this.delay(this.RETRY_DELAY_MS * Math.pow(2, attempt - 1))
      }
    }

    logger.error(`Failed to create snapshot after ${this.RETRY_ATTEMPTS} attempts`)
  }

  /**
   * VALIDATION SYSTEM
   * Validates snapshot data before creation
   */
  private async validateSnapshotData(
    eventName: string, 
    roundNumber: string
  ): Promise<SnapshotValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Get live stats data
      const { data: liveStats, error } = await this.supabase
        .from('live_tournament_stats')
        .select('*')
        .eq('event_name', eventName)
        .eq('round_num', roundNumber)

      if (error) {
        errors.push(`Database error: ${error.message}`)
        return { isValid: false, errors, warnings, playerCount: 0, completeness: 0 }
      }

      if (!liveStats || liveStats.length === 0) {
        errors.push('No live stats data found')
        return { isValid: false, errors, warnings, playerCount: 0, completeness: 0 }
      }

      const playerCount = liveStats.length
      
      // Validate minimum player count
      if (playerCount < this.MIN_PLAYERS_FOR_SNAPSHOT) {
        errors.push(`Insufficient players: ${playerCount} < ${this.MIN_PLAYERS_FOR_SNAPSHOT}`)
      }

      // Check data completeness
      const playersWithPositions = liveStats.filter(p => p.position && p.position !== '').length
      const playersWithScores = liveStats.filter(p => p.total !== null).length
      const playersWithSG = liveStats.filter(p => p.sg_total !== null).length
      
      const completeness = (playersWithPositions + playersWithScores + playersWithSG) / (playerCount * 3)

      // Validate core data presence
      if (playersWithPositions === 0) {
        errors.push('No players have position data')
      } else if (playersWithPositions < playerCount * 0.5) {
        warnings.push(`Only ${playersWithPositions}/${playerCount} players have position data`)
      }

      if (playersWithScores === 0) {
        errors.push('No players have score data')
      }

      // Check for stale data
      const latestUpdate = liveStats
        .map(p => new Date(p.data_golf_updated_at || 0))
        .reduce((latest, current) => current > latest ? current : latest, new Date(0))
      
      const staleThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours
      if (latestUpdate < staleThreshold) {
        warnings.push(`Data appears stale (latest update: ${latestUpdate.toISOString()})`)
      }

      // Validate round number consistency
      const roundNumbers = new Set(liveStats.map(p => p.round_num))
      if (roundNumbers.size > 1) {
        warnings.push(`Multiple round numbers found: ${Array.from(roundNumbers).join(', ')}`)
      }

      const isValid = errors.length === 0

      return {
        isValid,
        errors,
        warnings,
        playerCount,
        completeness
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings, playerCount: 0, completeness: 0 }
    }
  }

  /**
   * Determines snapshot type based on trigger and round
   */
  private getSnapshotType(
    triggerType: string, 
    roundNumber: string
  ): 'round_end' | 'live_update' | 'final' {
    if (roundNumber === '4' && triggerType === 'round_completion') {
      return 'final'
    }
    
    if (triggerType === 'round_completion') {
      return 'round_end'
    }
    
    return 'live_update'
  }

  /**
   * Logs snapshot metadata for monitoring and analytics
   */
  private async logSnapshotMetadata(
    triggerData: SnapshotTriggerData,
    snapshotIds: number[],
    validation: SnapshotValidationResult
  ): Promise<void> {
    try {
      // You could store this in a separate monitoring table if needed
      logger.info('Snapshot metadata', {
        event_id: triggerData.eventId,
        event_name: triggerData.eventName,
        round_number: triggerData.roundNumber,
        trigger_type: triggerData.triggerType,
        snapshot_count: snapshotIds.length,
        player_count: validation.playerCount,
        data_completeness: validation.completeness,
        warnings: validation.warnings,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      logger.warn('Failed to log snapshot metadata:', error)
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Creates a complete tournament snapshot from current live_tournament_stats
   */
  async createTournamentSnapshot(
    eventId: number,
    roundNumber: string,
    snapshotType: 'round_end' | 'live_update' | 'final' = 'live_update'
  ): Promise<{ success: boolean; snapshotIds?: number[]; error?: string }> {
    try {
      logger.info(`Creating tournament snapshot for event ${eventId}, round ${roundNumber}`)

      // 1. Get tournament info
      const { data: tournament, error: tournamentError } = await this.supabase
        .from('tournaments')
        .select('event_id, event_name')
        .eq('event_id', eventId)
        .single()

      if (tournamentError || !tournament) {
        logger.error(`Tournament not found for event_id ${eventId}:`, tournamentError)
        return { success: false, error: `Tournament not found: ${tournamentError?.message}` }
      }

      // 2. Get current live stats for this event and round
      const { data: liveStats, error: liveStatsError } = await this.supabase
        .from('live_tournament_stats')
        .select('*')
        .eq('event_name', tournament.event_name)
        .eq('round_num', roundNumber)

      if (liveStatsError) {
        logger.error(`Failed to fetch live stats:`, liveStatsError)
        return { success: false, error: `Failed to fetch live stats: ${liveStatsError.message}` }
      }

      if (!liveStats || liveStats.length === 0) {
        logger.warn(`No live stats found for ${tournament.event_name}, round ${roundNumber}`)
        return { success: true, snapshotIds: [] }
      }

      // 3. Get previous round snapshots for position change calculation
      const previousRoundNumber = this.getPreviousRound(roundNumber)
      let previousSnapshots: any[] = []
      
      if (previousRoundNumber) {
        const { data: prevSnapshots } = await this.supabase
          .from('latest_tournament_snapshots')
          .select('*')
          .eq('event_id', eventId)
          .eq('round_num', previousRoundNumber)
        
        previousSnapshots = prevSnapshots || []
      }

      // 4. Create snapshot records with position changes
      const snapshotTimestamp = new Date().toISOString()
      const snapshots: TournamentSnapshot[] = liveStats.map(stat => {
        const position = stat.position
        const positionNumeric = this.extractPositionNumeric(position)
        
        // Find previous position for this player
        const prevSnapshot = previousSnapshots.find(p => p.dg_id === stat.dg_id)
        const prevPositionNumeric = prevSnapshot?.position_numeric
        const positionChange = prevPositionNumeric && positionNumeric 
          ? positionNumeric - prevPositionNumeric 
          : null

        // Calculate momentum score
        const momentumScore = this.calculateMomentumScore(
          positionNumeric,
          prevPositionNumeric,
          parseInt(roundNumber) || 1
        )

        return {
          event_id: eventId,
          event_name: tournament.event_name,
          round_num: roundNumber,
          snapshot_timestamp: snapshotTimestamp,
          data_source: 'live_tournament_stats',
          snapshot_type: snapshotType,
          dg_id: stat.dg_id,
          player_name: stat.player_name,
          position: position,
          position_numeric: positionNumeric ?? undefined,
          total_score: stat.total,
          round_score: stat.today,
          thru: stat.thru,
          sg_total: stat.sg_total,
          sg_ott: stat.sg_ott,
          sg_app: stat.sg_app,
          sg_arg: stat.sg_arg,
          sg_putt: stat.sg_putt,
          sg_t2g: stat.sg_t2g,
          accuracy: stat.accuracy,
          distance: stat.distance,
          gir: stat.gir,
          prox_fw: stat.prox_fw,
          scrambling: stat.scrambling,
          position_change: positionChange ?? undefined,
          momentum_score: momentumScore ?? undefined,
          data_golf_updated_at: stat.data_golf_updated_at
        }
      })

      // 5. Insert snapshots in batches
      const batchSize = 100
      const insertedSnapshots: any[] = []
      
      for (let i = 0; i < snapshots.length; i += batchSize) {
        const batch = snapshots.slice(i, i + batchSize)
        const { data: inserted, error: insertError } = await this.supabase
          .from('tournament_round_snapshots')
          .insert(batch)
          .select('id, dg_id, position_numeric')

        if (insertError) {
          logger.error(`Failed to insert snapshot batch:`, insertError)
          return { success: false, error: `Failed to insert snapshots: ${insertError.message}` }
        }

        if (inserted) {
          insertedSnapshots.push(...inserted)
        }
      }

      // 6. Create position change records if we have previous data
      if (previousSnapshots.length > 0 && insertedSnapshots.length > 0) {
        // Use the full snapshots array with complete data instead of insertedSnapshots
        // which only contains limited fields (id, dg_id, position_numeric)
        const currentSnapshotsWithFullData = snapshots.map((snapshot, index) => ({
          ...snapshot,
          id: insertedSnapshots[index]?.id // Add the database ID from the insert
        }))
        
        await this.createPositionChangeRecords(
          eventId,
          previousRoundNumber!,
          roundNumber,
          previousSnapshots,
          currentSnapshotsWithFullData,
          liveStats
        )
      }

      // 7. Update momentum summary
      await this.updateMomentumSummary(eventId, roundNumber, insertedSnapshots, liveStats)

      logger.info(`Successfully created ${insertedSnapshots.length} tournament snapshots for event ${eventId}`)
      
      return { 
        success: true, 
        snapshotIds: insertedSnapshots.map(s => s.id) 
      }

    } catch (error) {
      logger.error('Failed to create tournament snapshot:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Creates position change records between rounds
   */
  private async createPositionChangeRecords(
    eventId: number,
    fromRound: string,
    toRound: string,
    previousSnapshots: any[],
    currentSnapshots: any[],
    liveStats: any[]
  ): Promise<void> {
    const positionChanges: PositionChange[] = []

    for (const currentSnapshot of currentSnapshots) {
      const prevSnapshot = previousSnapshots.find(p => p.dg_id === currentSnapshot.dg_id)
      const liveStat = liveStats.find(s => s.dg_id === currentSnapshot.dg_id)
      
      if (prevSnapshot && liveStat) {
        // Ensure we have valid position data
        const currentPos = currentSnapshot.position_numeric
        const prevPos = prevSnapshot.position_numeric
        
        if (currentPos != null && prevPos != null) {
          const positionChange = currentPos - prevPos
          const scoreChange = (liveStat.total || 0) - (prevSnapshot.total_score || 0)
          
          // Calculate improvement streak (simplified)
          const improving = positionChange < 0 // Negative means better position
          const streakRounds = improving ? 1 : 0 // TODO: Calculate actual streak

          positionChanges.push({
            event_id: eventId,
            dg_id: currentSnapshot.dg_id,
            player_name: liveStat.player_name,
            from_round: fromRound,
            to_round: toRound,
            from_snapshot_id: prevSnapshot.id,
            to_snapshot_id: currentSnapshot.id,
            position_change: positionChange,
            from_position_numeric: prevPos,
            to_position_numeric: currentPos,
            score_change: scoreChange,
            round_score: liveStat.today,
            improving,
            streak_rounds: streakRounds
          })
          
          // Debug logging for significant position changes
          if (Math.abs(positionChange) > 10) {
            logger.info(`Significant position change for ${liveStat.player_name}: ${prevPos} → ${currentPos} (${positionChange > 0 ? '+' : ''}${positionChange})`)
          }
        } else {
          logger.warn(`Missing position data for player ${liveStat.player_name} (DG_ID: ${currentSnapshot.dg_id}): current=${currentPos}, prev=${prevPos}`)
        }
      } else {
        if (!prevSnapshot) {
          logger.debug(`No previous snapshot found for player DG_ID: ${currentSnapshot.dg_id} (new player in round ${toRound})`)
        }
        if (!liveStat) {
          logger.warn(`No live stat found for player DG_ID: ${currentSnapshot.dg_id}`)
        }
      }
    }

    if (positionChanges.length > 0) {
      const { error } = await this.supabase
        .from('player_round_changes')
        .insert(positionChanges)

      if (error) {
        logger.error('Failed to insert position changes:', error)
      } else {
        logger.info(`Created ${positionChanges.length} position change records for ${fromRound}→${toRound}`)
        
        // Log summary statistics
        const improvements = positionChanges.filter(p => p.improving).length
        const declines = positionChanges.filter(p => !p.improving).length
        const avgChange = positionChanges.reduce((sum, p) => sum + Math.abs(p.position_change), 0) / positionChanges.length
        logger.info(`Position changes summary: ${improvements} improved, ${declines} declined, avg change: ${avgChange.toFixed(1)} positions`)
      }
    } else {
      logger.warn(`No valid position changes found for ${fromRound}→${toRound} (${currentSnapshots.length} current, ${previousSnapshots.length} previous)`)
    }
  }

  /**
   * Updates the momentum summary table
   */
  private async updateMomentumSummary(
    eventId: number,
    currentRound: string,
    snapshots: any[],
    liveStats: any[]
  ): Promise<void> {
    const summaryRecords = snapshots.map(snapshot => {
      const liveStat = liveStats.find(s => s.dg_id === snapshot.dg_id)
      
      return {
        event_id: eventId,
        dg_id: snapshot.dg_id,
        player_name: liveStat?.player_name || '',
        current_round: currentRound,
        current_position: snapshot.position_numeric,
        current_total_score: liveStat?.total || 0,
        rounds_played: parseInt(currentRound) || 1,
        position_trend: 'steady', // TODO: Calculate actual trend
        avg_round_score: liveStat?.today || 0,
        best_round_score: liveStat?.today || 0,
        worst_round_score: liveStat?.today || 0,
        momentum_score: snapshot.momentum_score || 0,
        consistency_score: 0, // TODO: Calculate
        pressure_performance: 0, // TODO: Calculate
        last_updated: new Date().toISOString()
      }
    })

    const { error } = await this.supabase
      .from('tournament_momentum_summary')
      .upsert(summaryRecords, { onConflict: 'event_id,dg_id' })

    if (error) {
      logger.error('Failed to update momentum summary:', error)
    } else {
      logger.info(`Updated momentum summary for ${summaryRecords.length} players`)
    }
  }

  /**
   * Extract numeric position from text (T1 -> 1, CUT -> 999)
   */
  private extractPositionNumeric(position?: string): number | null {
    if (!position) return null
    
    // Handle special cases
    if (/^(CUT|WD|DQ|DNS)/.test(position.toUpperCase())) {
      return 999
    }
    
    // Extract number from T1, 1, T15, etc.
    const match = position.match(/\d+/)
    return match ? parseInt(match[0]) : null
  }

  /**
   * Calculate momentum score based on position changes
   */
  private calculateMomentumScore(
    currentPos: number | null,
    prevPos: number | null,
    roundsPlayed: number
  ): number | null {
    if (!currentPos || !prevPos) return null
    
    // Position change (negative = improvement)
    const positionChange = currentPos - prevPos
    
    // Base momentum score (inverted so positive = good)
    let momentum = -positionChange
    
    // Weight by rounds played (more confidence with more data)
    momentum = momentum * (roundsPlayed / 4.0)
    
    // Cap at reasonable bounds
    return Math.max(-50, Math.min(50, momentum))
  }

  /**
   * Get the previous round number
   */
  private getPreviousRound(currentRound: string): string | null {
    const roundNum = parseInt(currentRound)
    if (roundNum > 1) {
      return (roundNum - 1).toString()
    }
    return null
  }

  /**
   * Get latest snapshots for an event and round
   */
  async getLatestSnapshots(eventId: number, roundNum?: string): Promise<TournamentSnapshot[]> {
    let query = this.supabase
      .from('latest_tournament_snapshots')
      .select('*')
      .eq('event_id', eventId)

    if (roundNum) {
      query = query.eq('round_num', roundNum)
    }

    const { data, error } = await query
    
    if (error) {
      logger.error('Failed to fetch latest snapshots:', error)
      return []
    }

    return data || []
  }

  /**
   * Get position changes for a tournament
   */
  async getPositionChanges(eventId: number): Promise<PositionChange[]> {
    const { data, error } = await this.supabase
      .from('player_round_changes')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch position changes:', error)
      return []
    }

    return data || []
  }

  /**
   * Get tournament momentum trends
   */
  async getTournamentTrends(eventId: number): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('player_tournament_trends')
      .select('*')
      .eq('event_id', eventId)
      .order('round_num', { ascending: true })

    if (error) {
      logger.error('Failed to fetch tournament trends:', error)
      return []
    }

    return data || []
  }

  /**
   * 🎯 NEW: Generate comprehensive momentum analysis for a player
   * Core functionality for Task 30.3
   */
  async generatePlayerMomentumAnalysis(
    eventId: number,
    dgId: number,
    currentRound: string
  ): Promise<PlayerMomentumAnalysis | null> {
    try {
      // Get all snapshots for this player in this tournament
      const { data: playerSnapshots } = await this.supabase
        .from('tournament_round_snapshots')
        .select('*')
        .eq('event_id', eventId)
        .eq('dg_id', dgId)
        .order('round_num', { ascending: true })

      if (!playerSnapshots || playerSnapshots.length === 0) {
        logger.warn(`No snapshots found for player ${dgId} in event ${eventId}`)
        return null
      }

      // Get position changes for trend analysis
      const { data: positionChanges } = await this.supabase
        .from('player_round_changes')
        .select('*')
        .eq('event_id', eventId)
        .eq('dg_id', dgId)
        .order('to_round', { ascending: true })

      const latestSnapshot = playerSnapshots[playerSnapshots.length - 1]
      
      // Calculate position trend and streak
      const positionTrend = this.calculatePositionTrend(playerSnapshots)
      const positionStreak = this.calculatePositionStreak(positionChanges || [])
      
      // Calculate score metrics
      const scoreMetrics = this.calculateScoreMetrics(playerSnapshots)
      
      // Calculate enhanced momentum score
      const weightedMomentum = this.calculateWeightedMomentum(playerSnapshots, positionChanges || [])
      
      // Calculate performance indicators
      const pressurePerformance = this.calculatePressurePerformance(playerSnapshots)
      const lateRoundPerformance = this.calculateLateRoundPerformance(playerSnapshots)
      
      // Calculate trajectory predictions
      const trajectoryPredictions = this.calculateTrajectoryPredictions(playerSnapshots, positionTrend)
      
      // Calculate volatility metrics
      const positionVolatility = this.calculatePositionVolatility(playerSnapshots)
      const momentumDirection = this.calculateMomentumDirection(positionChanges || [])

      return {
        dg_id: dgId,
        player_name: latestSnapshot.player_name,
        event_id: eventId,
        current_round: currentRound,
        
        // Position Analysis
        current_position: latestSnapshot.position_numeric || 999,
        position_trend: positionTrend,
        position_streak: positionStreak,
        
        // Score Analysis
        current_total_score: latestSnapshot.total_score || 0,
        avg_round_score: scoreMetrics.avgRoundScore,
        best_round_score: scoreMetrics.bestRoundScore,
        worst_round_score: scoreMetrics.worstRoundScore,
        score_consistency: scoreMetrics.consistency,
        
        // Momentum Indicators
        weighted_momentum: weightedMomentum,
        pressure_performance: pressurePerformance,
        late_round_performance: lateRoundPerformance,
        
        // Trajectory Predictions
        projected_finish_position: trajectoryPredictions.projectedFinish,
        cut_probability: trajectoryPredictions.cutProbability,
        top_10_probability: trajectoryPredictions.top10Probability,
        
        // Historical Context
        rounds_played: playerSnapshots.length,
        position_volatility: positionVolatility,
        momentum_direction: momentumDirection
      }

    } catch (error) {
      logger.error(`Failed to generate momentum analysis for player ${dgId}:`, error)
      return null
    }
  }

  /**
   * 🎯 NEW: Generate comprehensive tournament trend data
   * Visualization-ready data for Task 30.3
   */
  async generateTournamentTrendData(eventId: number, currentRound: string): Promise<TournamentTrendData | null> {
    try {
      // Get tournament info
      const { data: tournament } = await this.supabase
        .from('tournaments')
        .select('event_name')
        .eq('event_id', eventId)
        .single()

      if (!tournament) {
        logger.error(`Tournament not found: ${eventId}`)
        return null
      }

      // Get all players for analysis
      const { data: latestSnapshots } = await this.supabase
        .from('latest_tournament_snapshots')
        .select('*')
        .eq('event_id', eventId)
        .eq('round_num', currentRound)
        .order('position_numeric', { ascending: true })

      if (!latestSnapshots || latestSnapshots.length === 0) {
        logger.warn(`No snapshots found for tournament ${eventId}, round ${currentRound}`)
        return null
      }

      // Generate momentum analysis for all players
      const playerAnalyses: PlayerMomentumAnalysis[] = []
      for (const snapshot of latestSnapshots) {
        const analysis = await this.generatePlayerMomentumAnalysis(
          eventId, 
          snapshot.dg_id, 
          currentRound
        )
        if (analysis) {
          playerAnalyses.push(analysis)
        }
      }

      // Calculate cut line
      const cutLine = this.calculateCutLine(playerAnalyses, currentRound)
      
      // Find top performers by category
      const risingStars = playerAnalyses
        .filter(p => p.weighted_momentum > 0)
        .sort((a, b) => b.weighted_momentum - a.weighted_momentum)
        .slice(0, 5)

      const fallingPlayers = playerAnalyses
        .filter(p => p.weighted_momentum < 0)
        .sort((a, b) => a.weighted_momentum - b.weighted_momentum)
        .slice(0, 5)

      const consistentPerformers = playerAnalyses
        .sort((a, b) => b.score_consistency - a.score_consistency)
        .slice(0, 5)

      const momentumLeaders = playerAnalyses
        .sort((a, b) => Math.abs(b.weighted_momentum) - Math.abs(a.weighted_momentum))
        .slice(0, 10)

      // Calculate tournament dynamics
      const leaderboardVolatility = this.calculateLeaderboardVolatility(playerAnalyses)
      const fieldCompression = this.calculateFieldCompression(playerAnalyses)

      // Generate visualization data
      const visualizationData = this.generateVisualizationData(playerAnalyses, eventId)

      return {
        event_id: eventId,
        event_name: tournament.event_name,
        trend_timestamp: new Date().toISOString(),
        
        // Leaderboard Overview
        total_players: playerAnalyses.length,
        cut_line_position: cutLine.position,
        cut_line_score: cutLine.score,
        
        // Top Performers
        rising_stars: risingStars,
        falling_players: fallingPlayers,
        consistent_performers: consistentPerformers,
        
        // Tournament Dynamics
        leaderboard_volatility: leaderboardVolatility,
        field_compression: fieldCompression,
        momentum_leaders: momentumLeaders,
        
        // Visualization Data
        position_change_matrix: visualizationData.positionChangeMatrix,
        momentum_distribution: visualizationData.momentumDistribution,
        score_progression_data: visualizationData.scoreProgressionData
      }

    } catch (error) {
      logger.error(`Failed to generate tournament trend data for event ${eventId}:`, error)
      return null
    }
  }

  /**
   * 🎯 NEW: Calculate position trend over multiple rounds
   */
  private calculatePositionTrend(snapshots: any[]): 'rising' | 'falling' | 'steady' | 'volatile' {
    if (snapshots.length < 2) return 'steady'

    const positions = snapshots.map(s => s.position_numeric || 999)
    const changes = []
    
    for (let i = 1; i < positions.length; i++) {
      changes.push(positions[i] - positions[i-1])
    }

    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length
    const volatility = this.calculateStandardDeviation(changes)

    // High volatility indicates inconsistent performance
    if (volatility > 10) return 'volatile'
    
    // Determine trend direction (negative = improving position)
    if (avgChange < -2) return 'rising'
    if (avgChange > 2) return 'falling'
    return 'steady'
  }

  /**
   * 🎯 NEW: Calculate position streak (consecutive improving/declining rounds)
   */
  private calculatePositionStreak(positionChanges: any[]): number {
    if (positionChanges.length === 0) return 0

    let streak = 0
    let currentDirection: boolean | null = null

    for (const change of positionChanges.reverse()) {
      const improving = change.position_change < 0 // negative = improvement
      
      if (currentDirection === null) {
        currentDirection = improving
        streak = 1
      } else if (currentDirection === improving) {
        streak++
      } else {
        break
      }
    }

    return currentDirection ? streak : -streak // positive for improving, negative for declining
  }

  /**
   * 🎯 NEW: Calculate enhanced score metrics
   */
  private calculateScoreMetrics(snapshots: any[]): {
    avgRoundScore: number
    bestRoundScore: number
    worstRoundScore: number
    consistency: number
  } {
    const roundScores = snapshots
      .map(s => s.round_score)
      .filter(score => score !== null && score !== undefined)

    if (roundScores.length === 0) {
      return { avgRoundScore: 0, bestRoundScore: 0, worstRoundScore: 0, consistency: 0 }
    }

    const avgRoundScore = roundScores.reduce((sum, score) => sum + score, 0) / roundScores.length
    const bestRoundScore = Math.min(...roundScores)
    const worstRoundScore = Math.max(...roundScores)
    
    // Consistency: inverse of standard deviation (0-100 scale)
    const stdDev = this.calculateStandardDeviation(roundScores)
    const consistency = Math.max(0, 100 - (stdDev * 10)) // Scale to 0-100

    return {
      avgRoundScore: Math.round(avgRoundScore * 100) / 100,
      bestRoundScore,
      worstRoundScore,
      consistency: Math.round(consistency)
    }
  }

  /**
   * 🎯 NEW: Calculate weighted momentum score with proper round weighting
   */
  private calculateWeightedMomentum(snapshots: any[], positionChanges: any[]): number {
    if (positionChanges.length === 0) return 0

    let weightedSum = 0
    let totalWeight = 0

    for (let i = 0; i < positionChanges.length; i++) {
      const change = positionChanges[i]
      const positionImprovement = -change.position_change // negative = improvement
      
      // Weight recent rounds more heavily
      let weight: number
      if (i >= positionChanges.length - 1) {
        weight = this.PARLAY_ANALYSIS_CONFIG.recent_rounds_count
      } else if (i >= positionChanges.length - 2) {
        weight = this.PARLAY_ANALYSIS_CONFIG.recent_rounds_count
      } else {
        weight = this.PARLAY_ANALYSIS_CONFIG.recent_rounds_count
      }

      weightedSum += positionImprovement * weight
      totalWeight += weight
    }

    const rawMomentum = totalWeight > 0 ? weightedSum / totalWeight : 0
    
    // Scale to -100 to +100 range
    return Math.max(-100, Math.min(100, rawMomentum * 5))
  }

  /**
   * 🎯 NEW: Calculate pressure performance (performance in later rounds)
   */
  private calculatePressurePerformance(snapshots: any[]): number {
    const laterRounds = snapshots.filter(s => {
      const round = parseInt(s.round_num)
      return round >= 3 && round <= 4
    })

    if (laterRounds.length === 0) return 50 // neutral

    const earlyRounds = snapshots.filter(s => {
      const round = parseInt(s.round_num)
      return round >= 1 && round <= 2
    })

    if (earlyRounds.length === 0) return 50

    // Compare average round scores
    const earlyAvg = earlyRounds.reduce((sum, s) => sum + (s.round_score || 0), 0) / earlyRounds.length
    const laterAvg = laterRounds.reduce((sum, s) => sum + (s.round_score || 0), 0) / laterRounds.length

    // Better later rounds indicate good pressure performance
    const improvement = earlyAvg - laterAvg
    
    // Scale to 0-100 (50 = neutral, >50 = good under pressure)
    return Math.max(0, Math.min(100, 50 + (improvement * 10)))
  }

  /**
   * 🎯 NEW: Calculate late round performance specifically
   */
  private calculateLateRoundPerformance(snapshots: any[]): number {
    const round3and4 = snapshots.filter(s => {
      const round = parseInt(s.round_num)
      return round >= 3 && round <= 4
    })

    if (round3and4.length === 0) return 50

    const avgLateScore = round3and4.reduce((sum, s) => sum + (s.round_score || 0), 0) / round3and4.length
    
    // Convert to 0-100 scale (lower scores = better performance)
    // Par = 50, each stroke under par adds 10 points
    return Math.max(0, Math.min(100, 50 - (avgLateScore * 10)))
  }

  /**
   * 🎯 NEW: Calculate trajectory predictions
   */
  private calculateTrajectoryPredictions(snapshots: any[], trend: string): {
    projectedFinish: number
    cutProbability: number
    top10Probability: number
  } {
    const currentPosition = snapshots[snapshots.length - 1]?.position_numeric || 999
    
    // Simple trajectory model based on current position and trend
    let projectedFinish = currentPosition
    
    if (trend === 'rising') {
      projectedFinish = Math.max(1, currentPosition - 5)
    } else if (trend === 'falling') {
      projectedFinish = currentPosition + 5
    }

    // Cut probability (higher if in good position)
    const cutProbability = currentPosition <= 70 ? 0.9 : 
                          currentPosition <= 80 ? 0.7 :
                          currentPosition <= 90 ? 0.5 : 0.2

    // Top 10 probability
    const top10Probability = currentPosition <= 5 ? 0.8 :
                            currentPosition <= 10 ? 0.6 :
                            currentPosition <= 15 ? 0.3 :
                            currentPosition <= 25 ? 0.1 : 0.05

    return {
      projectedFinish: Math.round(projectedFinish),
      cutProbability: Math.round(cutProbability * 100) / 100,
      top10Probability: Math.round(top10Probability * 100) / 100
    }
  }

  /**
   * 🎯 NEW: Calculate position volatility (standard deviation)
   */
  private calculatePositionVolatility(snapshots: any[]): number {
    const positions = snapshots.map(s => s.position_numeric || 999)
    return Math.round(this.calculateStandardDeviation(positions) * 100) / 100
  }

  /**
   * 🎯 NEW: Calculate momentum direction
   */
  private calculateMomentumDirection(positionChanges: any[]): 'accelerating' | 'decelerating' | 'steady' {
    if (positionChanges.length < 2) return 'steady'

    const recentChanges = positionChanges.slice(-2)
    const momentumChange = Math.abs(recentChanges[1].position_change) - Math.abs(recentChanges[0].position_change)

    if (momentumChange > 1) return 'accelerating'
    if (momentumChange < -1) return 'decelerating'
    return 'steady'
  }

  /**
   * 🎯 NEW: Calculate cut line for tournament
   */
  private calculateCutLine(playerAnalyses: PlayerMomentumAnalysis[], round: string): { position: number; score: number } {
    const roundNum = parseInt(round)
    
    if (roundNum < 2) {
      return { position: 70, score: 0 } // Estimated cut line
    }

    // Sort by current position and take 70th position (typical cut line)
    const sortedPlayers = playerAnalyses
      .filter(p => p.current_position < 999) // Exclude CUT/WD players
      .sort((a, b) => a.current_position - b.current_position)

    const cutLinePlayer = sortedPlayers[69] // 70th position (0-indexed)
    
    return {
      position: 70,
      score: cutLinePlayer?.current_total_score || 0
    }
  }

  /**
   * 🎯 NEW: Calculate leaderboard volatility
   */
  private calculateLeaderboardVolatility(playerAnalyses: PlayerMomentumAnalysis[]): number {
    const topPlayers = playerAnalyses
      .filter(p => p.current_position <= 20)
      .map(p => p.position_volatility)
    
    if (topPlayers.length === 0) return 0
    
    const avgVolatility = topPlayers.reduce((sum, vol) => sum + vol, 0) / topPlayers.length
    return Math.round(avgVolatility * 100) / 100
  }

  /**
   * 🎯 NEW: Calculate field compression
   */
  private calculateFieldCompression(playerAnalyses: PlayerMomentumAnalysis[]): number {
    const scores = playerAnalyses
      .filter(p => p.current_position < 999)
      .map(p => p.current_total_score)
      .sort((a, b) => a - b)

    if (scores.length < 10) return 0

    // Compression = difference between 10th and 50th position
    const compression = scores[49] - scores[9] // 50th - 10th position
    return Math.max(0, 20 - compression) // Higher number = more compressed field
  }

  /**
   * 🎯 NEW: Generate visualization-ready data
   */
  private generateVisualizationData(playerAnalyses: PlayerMomentumAnalysis[], eventId: number): {
    positionChangeMatrix: number[][]
    momentumDistribution: number[]
    scoreProgressionData: any[]
  } {
    // Position change matrix for heatmap visualization
    const positionChangeMatrix: number[][] = Array(4).fill(null).map(() => Array(21).fill(0))
    
    // Momentum distribution for histogram
    const momentumBuckets = Array(21).fill(0) // -100 to +100 in buckets of 10
    
    playerAnalyses.forEach(player => {
      // Update momentum distribution
      const bucketIndex = Math.min(20, Math.max(0, Math.floor((player.weighted_momentum + 100) / 10)))
      momentumBuckets[bucketIndex]++
    })

    // Score progression data for line charts
    const scoreProgressionData = playerAnalyses.slice(0, 10).map(player => ({
      player_name: player.player_name,
      dg_id: player.dg_id,
      current_position: player.current_position,
      momentum: player.weighted_momentum,
      trend: player.position_trend
    }))

    return {
      positionChangeMatrix,
      momentumDistribution: momentumBuckets,
      scoreProgressionData
    }
  }

  /**
   * Utility: Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
    
    return Math.sqrt(avgSquaredDiff)
  }

  /**
   * 🎯 NEW: Generate comprehensive parlay profile for a player
   * Core functionality for parlay prediction
   */
  async generatePlayerParlayProfile(dgId: number): Promise<PlayerParlayProfile | null> {
    try {
      logger.info(`Generating comprehensive parlay profile for player ${dgId}`)

      // Get player basic info
      const playerInfo = await this.getPlayerBasicInfo(dgId)
      if (!playerInfo) {
        logger.warn(`Player ${dgId} not found`)
        return null
      }

      // Gather all data in parallel for efficiency
      const [
        tournamentFinishes,
        sgTrends,
        roundPerformance,
        matchupHistory,
        coursePerformance,
        recentForm
      ] = await Promise.all([
        this.getTournamentFinishTrends(dgId),
        this.getSGTrends(dgId),
        this.getRoundSpecificPerformance(dgId),
        this.getMatchupHistory(dgId),
        this.getCoursePerformance(dgId),
        this.getRecentForm(dgId)
      ])

      // Calculate advanced indicators
      const consistencyScore = this.calculateConsistencyScore(tournamentFinishes, sgTrends)
      const volatilityScore = this.calculateVolatilityScore(tournamentFinishes)
      const clutchPerformance = this.calculateClutchPerformance(roundPerformance)
      const formTrajectory = this.calculateFormTrajectory(recentForm)

      // Assess prediction confidence
      const predictionConfidence = this.calculatePredictionConfidence({
        tournamentFinishes,
        sgTrends,
        matchupHistory,
        coursePerformance
      })

      return {
        dg_id: dgId,
        player_name: playerInfo.name,
        
        // Tournament Finish Trends
        recent_finishes: tournamentFinishes.positions,
        avg_finish_5: tournamentFinishes.avg_5,
        avg_finish_10: tournamentFinishes.avg_10,
        avg_finish_season: tournamentFinishes.season_avg,
        finish_trend: tournamentFinishes.trend,
        field_strength_adjusted_finish: tournamentFinishes.adjusted_avg,
        
        // SG Trends
        sg_total_season: sgTrends.total.season,
        sg_total_recent_5: sgTrends.total.recent_5,
        sg_total_recent_10: sgTrends.total.recent_10,
        sg_total_trend: sgTrends.total.trend,
        
        sg_ott_season: sgTrends.ott.season,
        sg_ott_recent: sgTrends.ott.recent,
        sg_app_season: sgTrends.app.season,
        sg_app_recent: sgTrends.app.recent,
        sg_arg_season: sgTrends.arg.season,
        sg_arg_recent: sgTrends.arg.recent,
        sg_putt_season: sgTrends.putt.season,
        sg_putt_recent: sgTrends.putt.recent,
        
        // Round Performance
        round1_avg: roundPerformance.round1_avg,
        round2_avg: roundPerformance.round2_avg,
        round3_avg: roundPerformance.round3_avg,
        round4_avg: roundPerformance.round4_avg,
        weekend_vs_weekday: roundPerformance.weekend_vs_weekday,
        pressure_round_performance: roundPerformance.pressure_performance,
        
        // Matchup History
        twoBall_wins: matchupHistory.twoBall.wins,
        twoBall_total: matchupHistory.twoBall.total,
        twoBall_win_rate: matchupHistory.twoBall.win_rate,
        threeBall_wins: matchupHistory.threeBall.wins,
        threeBall_total: matchupHistory.threeBall.total,
        threeBall_win_rate: matchupHistory.threeBall.win_rate,
        
        h2h_records: matchupHistory.h2h_records,
        
        // Course Performance
        course_performance: coursePerformance.records,
        course_type_performance: coursePerformance.by_type,
        weather_performance: coursePerformance.by_weather,
        
        // Advanced Indicators
        consistency_score: consistencyScore,
        volatility_score: volatilityScore,
        clutch_performance: clutchPerformance,
        form_trajectory: formTrajectory,
        
        prediction_confidence: predictionConfidence,
        last_updated: new Date().toISOString()
      }

    } catch (error) {
      logger.error(`Failed to generate parlay profile for player ${dgId}:`, error)
      return null
    }
  }

  /**
   * 🎯 NEW: Analyze a specific matchup for parlay predictions
   */
  async analyzeMatchupForParlay(
    playerIds: number[],
    matchupType: '2ball' | '3ball',
    courseContext?: {
      course_name?: string
      course_type?: string
      weather_conditions?: string
    }
  ): Promise<MatchupPredictionData | null> {
    try {
      logger.info(`Analyzing ${matchupType} matchup for players: ${playerIds.join(', ')}`)

      // Get parlay profiles for all players
      const playerProfiles = await Promise.all(
        playerIds.map(id => this.generatePlayerParlayProfile(id))
      )

      const validProfiles = playerProfiles.filter(p => p !== null) as PlayerParlayProfile[]
      
      if (validProfiles.length !== playerIds.length) {
        logger.warn(`Could not get profiles for all players in matchup`)
        return null
      }

      // Analyze head-to-head history
      const h2hAnalysis = this.analyzeHeadToHeadHistory(validProfiles)
      
      // Compare current form
      const formAnalysis = this.comparePlayerForm(validProfiles)
      
      // Assess course fit if context provided
      const courseAnalysis = courseContext 
        ? this.analyzeCourseAdvantages(validProfiles, courseContext)
        : null

      // Determine favorite and confidence
      const favorite = this.determineFavorite(validProfiles, formAnalysis, courseAnalysis)
      
      // Calculate parlay value
      const parlayValue = this.calculateParlayValue(validProfiles, favorite, h2hAnalysis)

      return {
        matchup_id: `${matchupType}_${playerIds.join('_')}_${Date.now()}`,
        players: validProfiles,
        matchup_type: matchupType,
        
        favorite_player: favorite,
        h2h_summary: h2hAnalysis,
        form_comparison: formAnalysis,
        course_advantages: courseAnalysis || {},
        parlay_value: parlayValue
      }

    } catch (error) {
      logger.error(`Failed to analyze matchup:`, error)
      return null
    }
  }

  /**
   * 🎯 NEW: Get tournament finish trends
   */
  private async getTournamentFinishTrends(dgId: number): Promise<any> {
    // Query historical tournament finishes
    const { data: finishes } = await this.supabase
      .from('tournament_round_snapshots')
      .select('event_id, event_name, position_numeric, snapshot_timestamp')
      .eq('dg_id', dgId)
      .eq('snapshot_type', 'final')
      .order('snapshot_timestamp', { ascending: false })
      .limit(this.PARLAY_ANALYSIS_CONFIG.recent_tournaments_count)

    if (!finishes || finishes.length === 0) {
      return { positions: [], avg_5: 0, avg_10: 0, season_avg: 0, trend: 'steady', adjusted_avg: 0 }
    }

    const positions = finishes.map(f => f.position_numeric || 999)
    const avg_5 = positions.slice(0, 5).reduce((sum, pos) => sum + pos, 0) / Math.min(5, positions.length)
    const avg_10 = positions.reduce((sum, pos) => sum + pos, 0) / positions.length
    
    // Calculate trend
    const recent = positions.slice(0, 3)
    const older = positions.slice(3, 6)
    const trend = recent.length > 0 && older.length > 0 
      ? (recent.reduce((s, p) => s + p, 0) / recent.length) < (older.reduce((s, p) => s + p, 0) / older.length)
        ? 'improving' : 'declining'
      : 'steady'

    return {
      positions,
      avg_5: Math.round(avg_5),
      avg_10: Math.round(avg_10),
      season_avg: Math.round(avg_10), // Using avg_10 as season proxy
      trend,
      adjusted_avg: Math.round(avg_10) // TODO: Adjust for field strength
    }
  }

  /**
   * 🎯 NEW: Get comprehensive SG trends
   */
  private async getSGTrends(dgId: number): Promise<any> {
    // Get recent SG data from live stats
    const { data: sgData } = await this.supabase
      .from('live_tournament_stats')
      .select('sg_total, sg_ott, sg_app, sg_arg, sg_putt, data_golf_updated_at')
      .eq('dg_id', dgId)
      .not('sg_total', 'is', null)
      .order('data_golf_updated_at', { ascending: false })
      .limit(this.PARLAY_ANALYSIS_CONFIG.extended_rounds_count)

    // Also get season data from player_skill_ratings
    const { data: seasonData } = await this.supabase
      .from('player_skill_ratings')
      .select('sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .eq('dg_id', dgId)
      .single()

    const defaultSG = { season: 0, recent_5: 0, recent_10: 0, recent: 0, trend: 'steady' as const }

    if (!sgData || sgData.length === 0) {
      return {
        total: defaultSG,
        ott: defaultSG,
        app: defaultSG,
        arg: defaultSG,
        putt: defaultSG
      }
    }

    // Calculate trends for each SG category
    const calculateSGTrend = (values: number[], category: string) => {
      const validValues = values.filter(v => v !== null && v !== undefined)
      if (validValues.length === 0) return defaultSG

      const recent_5 = validValues.slice(0, 5)
      const recent_10 = validValues
      const season = seasonData?.[category as keyof typeof seasonData] || 0

      const avg_5 = recent_5.reduce((s, v) => s + v, 0) / recent_5.length
      const avg_10 = recent_10.reduce((s, v) => s + v, 0) / recent_10.length

      // Determine trend
      const firstHalf = recent_10.slice(0, 5)
      const secondHalf = recent_10.slice(5)
      const trend = firstHalf.length > 0 && secondHalf.length > 0
        ? (firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length) > (secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length)
          ? 'improving' : 'declining'
        : 'steady'

      return {
        season: Math.round((season as number) * 1000) / 1000,
        recent_5: Math.round(avg_5 * 1000) / 1000,
        recent_10: Math.round(avg_10 * 1000) / 1000,
        recent: Math.round(avg_5 * 1000) / 1000,
        trend
      }
    }

    return {
      total: calculateSGTrend(sgData.map(d => d.sg_total), 'sg_total'),
      ott: calculateSGTrend(sgData.map(d => d.sg_ott), 'sg_ott'),
      app: calculateSGTrend(sgData.map(d => d.sg_app), 'sg_app'),
      arg: calculateSGTrend(sgData.map(d => d.sg_arg), 'sg_arg'),
      putt: calculateSGTrend(sgData.map(d => d.sg_putt), 'sg_putt')
    }
  }

  /**
   * 🎯 NEW: Get round-specific performance patterns
   */
  private async getRoundSpecificPerformance(dgId: number): Promise<any> {
    const { data: roundData } = await this.supabase
      .from('live_tournament_stats')
      .select('round_num, today, data_golf_updated_at')
      .eq('dg_id', dgId)
      .not('today', 'is', null)
      .order('data_golf_updated_at', { ascending: false })
      .limit(20) // Get last 20 rounds across multiple tournaments

    if (!roundData || roundData.length === 0) {
      return {
        round1_avg: 0, round2_avg: 0, round3_avg: 0, round4_avg: 0,
        weekend_vs_weekday: 0, pressure_performance: 0
      }
    }

    // Group by round number
    const byRound = roundData.reduce((acc: any, round) => {
      const roundNum = round.round_num
      if (!acc[roundNum]) acc[roundNum] = []
      acc[roundNum].push(round.today)
      return acc
    }, {})

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0

    const round1_avg = avg(byRound['1'] || [])
    const round2_avg = avg(byRound['2'] || [])
    const round3_avg = avg(byRound['3'] || [])
    const round4_avg = avg(byRound['4'] || [])

    const weekday = avg([...(byRound['1'] || []), ...(byRound['2'] || [])])
    const weekend = avg([...(byRound['3'] || []), ...(byRound['4'] || [])])
    const pressure_performance = weekday - weekend // Positive = better under pressure

    return {
      round1_avg: Math.round(round1_avg * 100) / 100,
      round2_avg: Math.round(round2_avg * 100) / 100,
      round3_avg: Math.round(round3_avg * 100) / 100,
      round4_avg: Math.round(round4_avg * 100) / 100,
      weekend_vs_weekday: Math.round(pressure_performance * 100) / 100,
      pressure_performance: Math.round(pressure_performance * 100) / 100
    }
  }

  /**
   * 🎯 NEW: Get matchup history (placeholder - would need historical parlay data)
   */
  private async getMatchupHistory(dgId: number): Promise<any> {
    // TODO: Query actual parlay/matchup results when we have that data
    // For now, return placeholder structure
    return {
      twoBall: { wins: 0, total: 0, win_rate: 0 },
      threeBall: { wins: 0, total: 0, win_rate: 0 },
      h2h_records: []
    }
  }

  /**
   * 🎯 NEW: Get course performance data
   */
  private async getCoursePerformance(dgId: number): Promise<any> {
    // TODO: Implement course-specific performance tracking
    return {
      records: [],
      by_type: {},
      by_weather: {}
    }
  }

  /**
   * 🎯 NEW: Get recent form indicators
   */
  private async getRecentForm(dgId: number): Promise<any> {
    const { data: recentRounds } = await this.supabase
      .from('live_tournament_stats')
      .select('today, sg_total, data_golf_updated_at')
      .eq('dg_id', dgId)
      .order('data_golf_updated_at', { ascending: false })
      .limit(this.PARLAY_ANALYSIS_CONFIG.form_trend_rounds)

    return recentRounds || []
  }

  // ... placeholder methods for calculations ...
  private calculateConsistencyScore(finishes: any, sgTrends: any): number {
    // TODO: Implement consistency algorithm
    return 50
  }

  private calculateVolatilityScore(finishes: any): number {
    // TODO: Implement volatility calculation
    return 50
  }

  private calculateClutchPerformance(roundPerf: any): number {
    return Math.round(roundPerf.pressure_performance * 10 + 50)
  }

  private calculateFormTrajectory(recentForm: any[]): 'hot' | 'cold' | 'steady' | 'inconsistent' {
    if (recentForm.length < 3) return 'steady'
    
    const scores = recentForm.map(r => r.today || 0)
    const trend = scores[0] - scores[scores.length - 1] // Recent vs older
    
    if (trend < -1) return 'hot'
    if (trend > 1) return 'cold'
    return 'steady'
  }

  private calculatePredictionConfidence(data: any): number {
    // Base confidence on data completeness
    let confidence = 0
    if (data.tournamentFinishes.positions.length > 0) confidence += 25
    if (data.sgTrends.total.recent_5 !== 0) confidence += 25
    if (data.matchupHistory.twoBall.total > 0) confidence += 25
    if (data.coursePerformance.records.length > 0) confidence += 25
    
    return confidence
  }

  private async getPlayerBasicInfo(dgId: number): Promise<{name: string} | null> {
    const { data } = await this.supabase
      .from('player_skill_ratings')
      .select('player_name')
      .eq('dg_id', dgId)
      .single()
    
    return data ? { name: data.player_name } : null
  }

  // ... placeholder methods for matchup analysis ...
  private analyzeHeadToHeadHistory(profiles: PlayerParlayProfile[]): any {
    return { has_history: false, total_matchups: 0, results_summary: 'No historical data' }
  }

  private comparePlayerForm(profiles: PlayerParlayProfile[]): any {
    const hotPlayers = profiles.filter(p => p.form_trajectory === 'hot').map(p => p.dg_id)
    const coldPlayers = profiles.filter(p => p.form_trajectory === 'cold').map(p => p.dg_id)
    
    return {
      hot_players: hotPlayers,
      cold_players: coldPlayers,
      form_edge: hotPlayers.length > 0 ? `${hotPlayers.length} player(s) in hot form` : 'No clear form advantage'
    }
  }

  private analyzeCourseAdvantages(profiles: PlayerParlayProfile[], context: any): any {
    // TODO: Implement course advantage analysis
    return {}
  }

  private determineFavorite(profiles: PlayerParlayProfile[], formAnalysis: any, courseAnalysis: any): any {
    // Simple favorite determination based on recent form and SG
    const scored = profiles.map(p => ({
      dg_id: p.dg_id,
      score: p.sg_total_recent_5 + (p.form_trajectory === 'hot' ? 0.5 : p.form_trajectory === 'cold' ? -0.5 : 0),
      advantages: []
    }))

    const favorite = scored.reduce((best, current) => current.score > best.score ? current : best)
    
    return {
      dg_id: favorite.dg_id,
      confidence: Math.min(100, Math.max(0, (favorite.score + 2) * 25)), // Convert to 0-100
      key_advantages: favorite.advantages
    }
  }

  private calculateParlayValue(profiles: PlayerParlayProfile[], favorite: any, h2hAnalysis: any): any {
    const confidence = favorite.confidence > 70 ? 'high' : favorite.confidence > 40 ? 'medium' : 'low'
    
    return {
      recommended_pick: favorite.dg_id,
      confidence_level: confidence,
      value_reasons: ['Recent strong SG performance', 'Positive form trajectory'],
      risk_factors: ['Limited historical data', 'Small sample size']
    }
  }
} 
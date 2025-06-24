/**
 * 🤖 GOLF PARLAY PREDICTION - FEATURE ENGINEERING PIPELINE
 * 
 * Comprehensive feature extraction and engineering for ML models.
 * Transforms raw golf data into ML-ready features for parlay prediction.
 */

import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// ============================================================================
// FEATURE INTERFACES
// ============================================================================

export interface PlayerFeatures {
  // Basic Info
  dg_id: number
  player_name: string
  
  // Recent Performance (Last 5 tournaments)
  recent_avg_finish: number
  recent_sg_total: number
  recent_sg_ott: number
  recent_sg_app: number
  recent_sg_arg: number
  recent_sg_putt: number
  recent_form_trend: 'hot' | 'cold' | 'steady' | 'volatile'
  
  // Season Performance
  season_avg_finish: number
  season_sg_total: number
  season_sg_ott: number
  season_sg_app: number
  season_sg_arg: number
  season_sg_putt: number
  
  // Round-Specific Performance
  r1_avg_score: number
  r2_avg_score: number
  r3_avg_score: number // Pressure round
  r4_avg_score: number // Closing round
  weekend_performance: number // R3+R4 vs R1+R2
  
  // Momentum & Position Tracking
  position_volatility: number
  momentum_score: number
  improving_streak: number
  declining_streak: number
  
  // Matchup History
  twoBall_win_rate: number
  threeBall_win_rate: number
  head_to_head_record: number // vs current opponents
  
  // Course & Context
  course_history_avg: number
  course_fit_score: number
  weather_performance: number
  
  // Advanced Metrics
  consistency_score: number
  clutch_performance: number
  cut_make_rate: number
  top10_rate: number
  
  // Confidence Indicators
  data_completeness: number // 0-1 score
  prediction_confidence: number
}

export interface MatchupFeatures {
  // Matchup Context
  matchup_type: '2ball' | '3ball'
  event_id: number
  round_num: number
  tee_time: string | null
  
  // Player Features (array of PlayerFeatures)
  players: PlayerFeatures[]
  
  // Comparative Features
  sg_total_spread: number
  form_differential: number
  odds_spread: number
  experience_gap: number
  
  // Group Dynamics
  favorite_index: number // Index of favorite player
  underdog_index: number // Index of biggest underdog
  group_avg_sg: number
  group_volatility: number
  
  // Historical Matchup Data
  previous_meetings: number
  head_to_head_results: { [dgId: number]: number } // Win rates vs others
  
  // Context Features
  course_advantage: { [dgId: number]: number } // Course fit scores
  weather_impact: number
  pressure_level: number // Based on round, position, etc.
  
  // Betting Features
  market_confidence: number
  value_opportunities: { [dgId: number]: number }
  
  // ML-Ready Labels (for training)
  actual_winner?: number // DG_ID of actual winner
  winner_position?: number // Final position of winner
  outcome_timestamp?: string
}

export interface FeatureExtractionOptions {
  includeHistorical?: boolean
  lookbackDays?: number
  minTournaments?: number
  includeWeather?: boolean
  includeCourseData?: boolean
  includeMarketData?: boolean
  normalizationMethod?: 'zscore' | 'minmax' | 'robust' | 'none'
}

// ============================================================================
// MAIN FEATURE ENGINEERING CLASS
// ============================================================================

export class GolfFeatureEngineering {
  private supabase = createSupabaseClient()
  
  /**
   * Extract comprehensive features for a single player
   */
  async extractPlayerFeatures(
    dgId: number,
    options: FeatureExtractionOptions = {}
  ): Promise<PlayerFeatures | null> {
    try {
      const {
        includeHistorical = true,
        lookbackDays = 180,
        minTournaments = 5
      } = options

      logger.info(`Extracting features for player ${dgId}`)

      // Get basic player info
      const { data: playerInfo } = await this.supabase
        .from('players')
        .select('dg_id, name')
        .eq('dg_id', dgId)
        .single()

      if (!playerInfo) {
        logger.warn(`Player ${dgId} not found`)
        return null
      }

      // Extract all feature categories
      const [
        recentPerformance,
        seasonPerformance,
        roundSpecific,
        momentum,
        matchupHistory,
        courseContext,
        advancedMetrics
      ] = await Promise.all([
        this.extractRecentPerformance(dgId, lookbackDays),
        this.extractSeasonPerformance(dgId),
        this.extractRoundSpecificPerformance(dgId),
        this.extractMomentumFeatures(dgId),
        this.extractMatchupHistory(dgId),
        this.extractCourseContext(dgId, options),
        this.extractAdvancedMetrics(dgId)
      ])

      // Calculate data completeness
      const dataCompleteness = this.calculateDataCompleteness({
        recentPerformance,
        seasonPerformance,
        roundSpecific,
        momentum,
        matchupHistory,
        advancedMetrics
      })

      const features: PlayerFeatures = {
        dg_id: dgId,
        player_name: playerInfo.name,
        
        // Recent Performance
        recent_avg_finish: recentPerformance.avg_finish,
        recent_sg_total: recentPerformance.sg_total,
        recent_sg_ott: recentPerformance.sg_ott,
        recent_sg_app: recentPerformance.sg_app,
        recent_sg_arg: recentPerformance.sg_arg,
        recent_sg_putt: recentPerformance.sg_putt,
        recent_form_trend: recentPerformance.form_trend,
        
        // Season Performance
        season_avg_finish: seasonPerformance.avg_finish,
        season_sg_total: seasonPerformance.sg_total,
        season_sg_ott: seasonPerformance.sg_ott,
        season_sg_app: seasonPerformance.sg_app,
        season_sg_arg: seasonPerformance.sg_arg,
        season_sg_putt: seasonPerformance.sg_putt,
        
        // Round-Specific
        r1_avg_score: roundSpecific.r1_avg,
        r2_avg_score: roundSpecific.r2_avg,
        r3_avg_score: roundSpecific.r3_avg,
        r4_avg_score: roundSpecific.r4_avg,
        weekend_performance: roundSpecific.weekend_vs_weekday,
        
        // Momentum
        position_volatility: momentum.position_volatility,
        momentum_score: momentum.momentum_score,
        improving_streak: momentum.improving_streak,
        declining_streak: momentum.declining_streak,
        
        // Matchup History
        twoBall_win_rate: matchupHistory.twoBall_rate,
        threeBall_win_rate: matchupHistory.threeBall_rate,
        head_to_head_record: matchupHistory.h2h_rate,
        
        // Course Context
        course_history_avg: courseContext.history_avg,
        course_fit_score: courseContext.fit_score,
        weather_performance: courseContext.weather_performance,
        
        // Advanced Metrics
        consistency_score: advancedMetrics.consistency,
        clutch_performance: advancedMetrics.clutch,
        cut_make_rate: advancedMetrics.cut_rate,
        top10_rate: advancedMetrics.top10_rate,
        
        // Confidence
        data_completeness: dataCompleteness,
        prediction_confidence: this.calculatePredictionConfidence(dataCompleteness, {
          recentPerformance,
          seasonPerformance,
          advancedMetrics
        })
      }

      return features

    } catch (error) {
      logger.error(`Failed to extract features for player ${dgId}:`, error)
      return null
    }
  }

  /**
   * Extract features for a complete matchup
   */
  async extractMatchupFeatures(
    matchupData: {
      type: '2ball' | '3ball'
      event_id: number
      round_num: number
      tee_time?: string
      players: { dg_id: number; odds?: number }[]
    },
    options: FeatureExtractionOptions = {}
  ): Promise<MatchupFeatures | null> {
    try {
      logger.info(`Extracting matchup features for ${matchupData.players.length} players`)

      // Extract individual player features
      const playerFeatures = await Promise.all(
        matchupData.players.map(p => this.extractPlayerFeatures(p.dg_id, options))
      )

      const validPlayerFeatures = playerFeatures.filter(f => f !== null) as PlayerFeatures[]

      if (validPlayerFeatures.length < matchupData.players.length) {
        logger.warn('Some player features could not be extracted')
      }

      // Calculate comparative features
      const comparativeFeatures = this.calculateComparativeFeatures(validPlayerFeatures)
      
      // Extract historical matchup data
      const historicalData = await this.extractHistoricalMatchupData(
        matchupData.players.map(p => p.dg_id)
      )

      // Calculate context features
      const contextFeatures = await this.calculateContextFeatures(
        matchupData.event_id,
        matchupData.round_num,
        validPlayerFeatures
      )

      const matchupFeatures: MatchupFeatures = {
        matchup_type: matchupData.type,
        event_id: matchupData.event_id,
        round_num: matchupData.round_num,
        tee_time: matchupData.tee_time || null,
        
        players: validPlayerFeatures,
        
        // Comparative
        sg_total_spread: comparativeFeatures.sg_spread,
        form_differential: comparativeFeatures.form_diff,
        odds_spread: comparativeFeatures.odds_spread,
        experience_gap: comparativeFeatures.experience_gap,
        
        // Group Dynamics
        favorite_index: comparativeFeatures.favorite_index,
        underdog_index: comparativeFeatures.underdog_index,
        group_avg_sg: comparativeFeatures.group_avg_sg,
        group_volatility: comparativeFeatures.group_volatility,
        
        // Historical
        previous_meetings: historicalData.total_meetings,
        head_to_head_results: historicalData.h2h_results,
        
        // Context
        course_advantage: contextFeatures.course_advantages,
        weather_impact: contextFeatures.weather_impact,
        pressure_level: contextFeatures.pressure_level,
        
        // Betting
        market_confidence: contextFeatures.market_confidence,
        value_opportunities: contextFeatures.value_opportunities
      }

      return matchupFeatures

    } catch (error) {
      logger.error('Failed to extract matchup features:', error)
      return null
    }
  }

  /**
   * Batch feature extraction for multiple players
   */
  async extractBatchPlayerFeatures(
    dgIds: number[],
    options: FeatureExtractionOptions = {}
  ): Promise<PlayerFeatures[]> {
    logger.info(`Batch extracting features for ${dgIds.length} players`)

    const batchSize = 10 // Process in batches to avoid overwhelming the DB
    const results: PlayerFeatures[] = []

    for (let i = 0; i < dgIds.length; i += batchSize) {
      const batch = dgIds.slice(i, i + batchSize)
      
      const batchResults = await Promise.all(
        batch.map(dgId => this.extractPlayerFeatures(dgId, options))
      )

      const validResults = batchResults.filter(r => r !== null) as PlayerFeatures[]
      results.push(...validResults)

      // Small delay between batches
      if (i + batchSize < dgIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    logger.info(`Successfully extracted features for ${results.length}/${dgIds.length} players`)
    return results
  }

  // ============================================================================
  // FEATURE EXTRACTION HELPERS
  // ============================================================================

  private async extractRecentPerformance(dgId: number, lookbackDays: number) {
    const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)

    const { data: recentData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        position_numeric,
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        snapshot_timestamp,
        event_id
      `)
      .eq('dg_id', dgId)
      .eq('snapshot_type', 'final')
      .gte('snapshot_timestamp', cutoffDate.toISOString())
      .order('snapshot_timestamp', { ascending: false })

    if (!recentData || recentData.length === 0) {
      return this.getDefaultPerformanceMetrics()
    }

    // Group by tournament to get tournament-level averages
    const tournamentData = this.groupByTournament(recentData)
    
    return {
      avg_finish: this.calculateAverage(tournamentData.map(t => t.avg_position)),
      sg_total: this.calculateAverage(tournamentData.map(t => t.avg_sg_total)),
      sg_ott: this.calculateAverage(tournamentData.map(t => t.avg_sg_ott)),
      sg_app: this.calculateAverage(tournamentData.map(t => t.avg_sg_app)),
      sg_arg: this.calculateAverage(tournamentData.map(t => t.avg_sg_arg)),
      sg_putt: this.calculateAverage(tournamentData.map(t => t.avg_sg_putt)),
      form_trend: this.calculateFormTrend(tournamentData)
    }
  }

  private async extractSeasonPerformance(dgId: number) {
    const seasonStart = new Date(new Date().getFullYear(), 0, 1) // January 1st of current year

    const { data: seasonData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        position_numeric,
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        event_id
      `)
      .eq('dg_id', dgId)
      .eq('snapshot_type', 'final')
      .gte('snapshot_timestamp', seasonStart.toISOString())

    if (!seasonData || seasonData.length === 0) {
      return this.getDefaultPerformanceMetrics()
    }

    const tournamentData = this.groupByTournament(seasonData)

    return {
      avg_finish: this.calculateAverage(tournamentData.map(t => t.avg_position)),
      sg_total: this.calculateAverage(tournamentData.map(t => t.avg_sg_total)),
      sg_ott: this.calculateAverage(tournamentData.map(t => t.avg_sg_ott)),
      sg_app: this.calculateAverage(tournamentData.map(t => t.avg_sg_app)),
      sg_arg: this.calculateAverage(tournamentData.map(t => t.avg_sg_arg)),
      sg_putt: this.calculateAverage(tournamentData.map(t => t.avg_sg_putt))
    }
  }

  private async extractRoundSpecificPerformance(dgId: number) {
    const { data: roundData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        round_num,
        round_score,
        snapshot_timestamp
      `)
      .eq('dg_id', dgId)
      .in('round_num', ['1', '2', '3', '4'])
      .not('round_score', 'is', null)
      .gte('snapshot_timestamp', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())

    if (!roundData || roundData.length === 0) {
      return {
        r1_avg: 0, r2_avg: 0, r3_avg: 0, r4_avg: 0,
        weekend_vs_weekday: 0
      }
    }

    const roundAverages = {
      '1': this.calculateAverage(roundData.filter(r => r.round_num === '1').map(r => r.round_score)),
      '2': this.calculateAverage(roundData.filter(r => r.round_num === '2').map(r => r.round_score)),
      '3': this.calculateAverage(roundData.filter(r => r.round_num === '3').map(r => r.round_score)),
      '4': this.calculateAverage(roundData.filter(r => r.round_num === '4').map(r => r.round_score))
    }

    const weekdayAvg = (roundAverages['1'] + roundAverages['2']) / 2
    const weekendAvg = (roundAverages['3'] + roundAverages['4']) / 2

    return {
      r1_avg: roundAverages['1'],
      r2_avg: roundAverages['2'],
      r3_avg: roundAverages['3'],
      r4_avg: roundAverages['4'],
      weekend_vs_weekday: weekendAvg - weekdayAvg
    }
  }

  private async extractMomentumFeatures(dgId: number) {
    const { data: positionChanges } = await this.supabase
      .from('player_round_changes')
      .select(`
        position_change,
        improving,
        from_position_numeric,
        to_position_numeric,
        created_at
      `)
      .eq('dg_id', dgId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!positionChanges || positionChanges.length === 0) {
      return {
        position_volatility: 0,
        momentum_score: 0,
        improving_streak: 0,
        declining_streak: 0
      }
    }

    const positions = positionChanges.map(pc => pc.to_position_numeric).filter(p => p !== null)
    const improvements = positionChanges.filter(pc => pc.improving)
    const declines = positionChanges.filter(pc => !pc.improving)

    return {
      position_volatility: this.calculateStandardDeviation(positions),
      momentum_score: this.calculateMomentumScore(positionChanges),
      improving_streak: this.calculateCurrentStreak(positionChanges, true),
      declining_streak: this.calculateCurrentStreak(positionChanges, false)
    }
  }

  private async extractMatchupHistory(dgId: number) {
    // This would query actual matchup results from parlays/parlay_picks
    // For now, return defaults
    return {
      twoBall_rate: 0.5,
      threeBall_rate: 0.33,
      h2h_rate: 0.5
    }
  }

  private async extractCourseContext(dgId: number, options: FeatureExtractionOptions) {
    // Course-specific performance would be calculated here
    return {
      history_avg: 0,
      fit_score: 0,
      weather_performance: 0
    }
  }

  private async extractAdvancedMetrics(dgId: number) {
    const { data: finishes } = await this.supabase
      .from('tournament_round_snapshots')
      .select('position_numeric')
      .eq('dg_id', dgId)
      .eq('snapshot_type', 'final')
      .not('position_numeric', 'is', null)
      .gte('snapshot_timestamp', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())

    if (!finishes || finishes.length === 0) {
      return {
        consistency: 0,
        clutch: 0,
        cut_rate: 0,
        top10_rate: 0
      }
    }

    const positions = finishes.map(f => f.position_numeric)
    const madecuts = positions.filter(p => p < 999).length
    const top10s = positions.filter(p => p <= 10).length

    return {
      consistency: 100 - this.calculateStandardDeviation(positions.filter(p => p < 999)),
      clutch: this.calculateClutchPerformance(dgId), // Would need separate calculation
      cut_rate: madecuts / finishes.length,
      top10_rate: top10s / finishes.length
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private calculateAverage(values: number[]): number {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v))
    return validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0
  }

  private calculateStandardDeviation(values: number[]): number {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v))
    if (validValues.length < 2) return 0
    
    const mean = this.calculateAverage(validValues)
    const squaredDiffs = validValues.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = this.calculateAverage(squaredDiffs)
    return Math.sqrt(avgSquaredDiff)
  }

  private groupByTournament(data: any[]) {
    const grouped = data.reduce((acc, row) => {
      if (!acc[row.event_id]) {
        acc[row.event_id] = []
      }
      acc[row.event_id].push(row)
      return acc
    }, {})

    return Object.values(grouped).map((tournamentRounds: any) => ({
      event_id: tournamentRounds[0].event_id,
      avg_position: this.calculateAverage(tournamentRounds.map((r: any) => r.position_numeric)),
      avg_sg_total: this.calculateAverage(tournamentRounds.map((r: any) => r.sg_total)),
      avg_sg_ott: this.calculateAverage(tournamentRounds.map((r: any) => r.sg_ott)),
      avg_sg_app: this.calculateAverage(tournamentRounds.map((r: any) => r.sg_app)),
      avg_sg_arg: this.calculateAverage(tournamentRounds.map((r: any) => r.sg_arg)),
      avg_sg_putt: this.calculateAverage(tournamentRounds.map((r: any) => r.sg_putt))
    }))
  }

  private calculateFormTrend(tournamentData: any[]): 'hot' | 'cold' | 'steady' | 'volatile' {
    if (tournamentData.length < 3) return 'steady'
    
    const recentFinishes = tournamentData.slice(0, 3).map(t => t.avg_position)
    const olderFinishes = tournamentData.slice(3, 6).map(t => t.avg_position)
    
    if (recentFinishes.length === 0 || olderFinishes.length === 0) return 'steady'
    
    const recentAvg = this.calculateAverage(recentFinishes)
    const olderAvg = this.calculateAverage(olderFinishes)
    const improvement = olderAvg - recentAvg // Positive = better (lower position)
    
    const volatility = this.calculateStandardDeviation(recentFinishes)
    
    if (volatility > 15) return 'volatile'
    if (improvement > 5) return 'hot'
    if (improvement < -5) return 'cold'
    return 'steady'
  }

  private calculateMomentumScore(positionChanges: any[]): number {
    if (positionChanges.length === 0) return 0
    
    // Weight recent changes more heavily
    let weightedScore = 0
    let totalWeight = 0
    
    positionChanges.forEach((change, index) => {
      const weight = Math.pow(0.8, index) // Decay factor
      const score = change.improving ? 1 : -1
      weightedScore += score * weight
      totalWeight += weight
    })
    
    return totalWeight > 0 ? (weightedScore / totalWeight) * 50 : 0 // Scale to -50 to +50
  }

  private calculateCurrentStreak(positionChanges: any[], improving: boolean): number {
    let streak = 0
    for (const change of positionChanges) {
      if (change.improving === improving) {
        streak++
      } else {
        break
      }
    }
    return streak
  }

  private calculateComparativeFeatures(playerFeatures: PlayerFeatures[]) {
    const sgTotals = playerFeatures.map(p => p.recent_sg_total)
    const forms = playerFeatures.map(p => this.formToNumeric(p.recent_form_trend))
    
    return {
      sg_spread: Math.max(...sgTotals) - Math.min(...sgTotals),
      form_diff: Math.max(...forms) - Math.min(...forms),
      odds_spread: 0, // Would calculate from odds data
      experience_gap: 0, // Would calculate from career data
      favorite_index: sgTotals.indexOf(Math.max(...sgTotals)),
      underdog_index: sgTotals.indexOf(Math.min(...sgTotals)),
      group_avg_sg: this.calculateAverage(sgTotals),
      group_volatility: this.calculateStandardDeviation(sgTotals)
    }
  }

  private async extractHistoricalMatchupData(dgIds: number[]) {
    // Would query actual head-to-head data
    return {
      total_meetings: 0,
      h2h_results: dgIds.reduce((acc, id) => ({ ...acc, [id]: 0.5 }), {})
    }
  }

  private async calculateContextFeatures(eventId: number, roundNum: number, playerFeatures: PlayerFeatures[]) {
    return {
      course_advantages: playerFeatures.reduce((acc, p) => ({ ...acc, [p.dg_id]: p.course_fit_score }), {}),
      weather_impact: 0,
      pressure_level: roundNum >= 3 ? 0.8 : 0.3,
      market_confidence: 0.5,
      value_opportunities: playerFeatures.reduce((acc, p) => ({ ...acc, [p.dg_id]: 0 }), {})
    }
  }

  private calculateDataCompleteness(data: any): number {
    // Calculate how complete the data is (0-1 score)
    let completeness = 0
    let categories = 0
    
    Object.values(data).forEach((category: any) => {
      categories++
      if (category && Object.keys(category).length > 0) {
        completeness++
      }
    })
    
    return categories > 0 ? completeness / categories : 0
  }

  private calculatePredictionConfidence(completeness: number, data: any): number {
    // Combine data completeness with data quality indicators
    const baseConfidence = completeness * 70 // 70% max from completeness
    const qualityBonus = data.recentPerformance && data.seasonPerformance ? 20 : 0
    const advancedBonus = data.advancedMetrics ? 10 : 0
    
    return Math.min(100, baseConfidence + qualityBonus + advancedBonus)
  }

  private calculateClutchPerformance(dgId: number): number {
    // Would calculate R3/R4 performance vs R1/R2
    return 0
  }

  private formToNumeric(form: string): number {
    const formMap = { 'hot': 3, 'steady': 2, 'cold': 1, 'volatile': 0 }
    return formMap[form as keyof typeof formMap] || 1
  }

  private getDefaultPerformanceMetrics() {
    return {
      avg_finish: 50,
      sg_total: 0,
      sg_ott: 0,
      sg_app: 0,
      sg_arg: 0,
      sg_putt: 0,
      form_trend: 'steady' as const
    }
  }
}

// ============================================================================
// FEATURE NORMALIZATION & PREPROCESSING
// ============================================================================

export class FeaturePreprocessor {
  /**
   * Normalize features using specified method
   */
  static normalizeFeatures(
    features: PlayerFeatures[],
    method: 'zscore' | 'minmax' | 'robust' = 'zscore'
  ): PlayerFeatures[] {
    const numericFields = [
      'recent_avg_finish', 'recent_sg_total', 'recent_sg_ott', 'recent_sg_app', 'recent_sg_arg', 'recent_sg_putt',
      'season_avg_finish', 'season_sg_total', 'season_sg_ott', 'season_sg_app', 'season_sg_arg', 'season_sg_putt',
      'r1_avg_score', 'r2_avg_score', 'r3_avg_score', 'r4_avg_score', 'weekend_performance',
      'position_volatility', 'momentum_score', 'improving_streak', 'declining_streak',
      'twoBall_win_rate', 'threeBall_win_rate', 'head_to_head_record',
      'course_history_avg', 'course_fit_score', 'weather_performance',
      'consistency_score', 'clutch_performance', 'cut_make_rate', 'top10_rate'
    ]

    return features.map(feature => {
      const normalized = { ...feature }
      
      numericFields.forEach(field => {
        const values = features.map(f => (f as any)[field]).filter(v => !isNaN(v))
        if (values.length > 1) {
          (normalized as any)[field] = this.normalizeValue(
            (feature as any)[field],
            values,
            method
          )
        }
      })
      
      return normalized
    })
  }

  private static normalizeValue(value: number, allValues: number[], method: string): number {
    if (isNaN(value)) return 0

    switch (method) {
      case 'zscore':
        const mean = allValues.reduce((sum, val) => sum + val, 0) / allValues.length
        const std = Math.sqrt(allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allValues.length)
        return std > 0 ? (value - mean) / std : 0

      case 'minmax':
        const min = Math.min(...allValues)
        const max = Math.max(...allValues)
        return max > min ? (value - min) / (max - min) : 0

      case 'robust':
        const sorted = allValues.sort((a, b) => a - b)
        const q1 = sorted[Math.floor(sorted.length * 0.25)]
        const q3 = sorted[Math.floor(sorted.length * 0.75)]
        const iqr = q3 - q1
        return iqr > 0 ? (value - q1) / iqr : 0

      default:
        return value
    }
  }

  /**
   * Create feature vectors for ML models
   */
  static createFeatureVectors(features: PlayerFeatures[]): number[][] {
    const numericFields = [
      'recent_avg_finish', 'recent_sg_total', 'recent_sg_ott', 'recent_sg_app', 'recent_sg_arg', 'recent_sg_putt',
      'season_avg_finish', 'season_sg_total', 'season_sg_ott', 'season_sg_app', 'season_sg_arg', 'season_sg_putt',
      'r1_avg_score', 'r2_avg_score', 'r3_avg_score', 'r4_avg_score', 'weekend_performance',
      'position_volatility', 'momentum_score', 'improving_streak', 'declining_streak',
      'twoBall_win_rate', 'threeBall_win_rate', 'head_to_head_record',
      'course_history_avg', 'course_fit_score', 'weather_performance',
      'consistency_score', 'clutch_performance', 'cut_make_rate', 'top10_rate',
      'data_completeness', 'prediction_confidence'
    ]

    return features.map(feature => 
      numericFields.map(field => (feature as any)[field] || 0)
    )
  }

  /**
   * Handle missing values in features
   */
  static imputeMissingValues(features: PlayerFeatures[]): PlayerFeatures[] {
    // For now, missing values are already handled in extraction
    // Could implement more sophisticated imputation here
    return features
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { GolfFeatureEngineering as default } 
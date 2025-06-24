/**
 * 🔍 GOLF PARLAY DATA EXPLORATION & ANALYSIS
 * 
 * Comprehensive data exploration tools for understanding golf tournament data,
 * bet patterns, and outcomes to inform ML model development.
 */

import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

// ============================================================================
// DATA EXPLORATION INTERFACES
// ============================================================================

export interface DataExplorationReport {
  summary: {
    total_bet_snapshots: number
    total_parlays: number
    total_picks: number
    date_range: { start: string; end: string }
    unique_players: number
    unique_tournaments: number
  }
  
  outcome_distribution: {
    parlay_outcomes: { [outcome: string]: number }
    pick_outcomes: { [outcome: string]: number }
    win_rates: {
      overall_parlay_win_rate: number
      overall_pick_win_rate: number
      by_matchup_type: { [type: string]: number }
    }
  }
  
  feature_analysis: {
    sg_distributions: {
      sg_total: { mean: number; std: number; min: number; max: number }
      sg_ott: { mean: number; std: number; min: number; max: number }
      sg_app: { mean: number; std: number; min: number; max: number }
      sg_arg: { mean: number; std: number; min: number; max: number }
      sg_putt: { mean: number; std: number; min: number; max: number }
    }
    
    position_analysis: {
      avg_position_by_outcome: { [outcome: string]: number }
      position_distribution: { [range: string]: number }
      position_volatility: number
    }
    
    odds_analysis: {
      avg_odds_by_outcome: { [outcome: string]: number }
      odds_accuracy: number
      value_opportunities: number
    }
  }
  
  temporal_patterns: {
    performance_by_round: { [round: string]: { win_rate: number; avg_sg: number } }
    seasonal_trends: { [month: string]: { win_rate: number; volume: number } }
    tournament_difficulty: { [tournament: string]: { win_rate: number; avg_field_strength: number } }
  }
  
  player_insights: {
    top_performers: Array<{
      dg_id: number
      name: string
      win_rate: number
      avg_sg_total: number
      consistency_score: number
    }>
    
    most_backed_players: Array<{
      dg_id: number
      name: string
      times_picked: number
      win_rate: number
    }>
    
    value_players: Array<{
      dg_id: number
      name: string
      expected_win_rate: number
      actual_win_rate: number
      value_score: number
    }>
  }
  
  correlations: {
    sg_to_outcome: { [sg_category: string]: number }
    position_to_outcome: number
    odds_to_outcome: number
    form_to_outcome: number
  }
  
  data_quality: {
    completeness_score: number
    missing_data_summary: { [field: string]: number }
    data_freshness: string
    anomalies_detected: number
  }
}

export interface FeatureImportanceAnalysis {
  feature_rankings: Array<{
    feature_name: string
    importance_score: number
    correlation_to_outcome: number
    predictive_power: number
  }>
  
  feature_interactions: Array<{
    feature_1: string
    feature_2: string
    interaction_strength: number
    combined_predictive_power: number
  }>
  
  redundant_features: Array<{
    feature_name: string
    correlation_with: string
    correlation_score: number
    recommendation: 'remove' | 'transform' | 'keep'
  }>
}

// ============================================================================
// MAIN DATA EXPLORATION CLASS
// ============================================================================

export class GolfDataExplorer {
  private supabase = createSupabaseClient()

  /**
   * Generate comprehensive data exploration report
   */
  async generateExplorationReport(): Promise<DataExplorationReport> {
    logger.info('Starting comprehensive data exploration...')

    try {
      const [
        summary,
        outcomeDistribution,
        featureAnalysis,
        temporalPatterns,
        playerInsights,
        correlations,
        dataQuality
      ] = await Promise.all([
        this.generateDataSummary(),
        this.analyzeOutcomeDistribution(),
        this.analyzeFeatureDistributions(),
        this.analyzeTemporalPatterns(),
        this.generatePlayerInsights(),
        this.calculateCorrelations(),
        this.assessDataQuality()
      ])

      const report: DataExplorationReport = {
        summary,
        outcome_distribution: outcomeDistribution,
        feature_analysis: featureAnalysis,
        temporal_patterns: temporalPatterns,
        player_insights: playerInsights,
        correlations,
        data_quality: dataQuality
      }

      logger.info('Data exploration report generated successfully')
      return report

    } catch (error) {
      logger.error('Failed to generate exploration report:', error)
      throw error
    }
  }

  /**
   * Analyze feature importance for ML model development
   */
  async analyzeFeatureImportance(): Promise<FeatureImportanceAnalysis> {
    logger.info('Analyzing feature importance...')

    try {
      // Get training data with outcomes
      const { data: trainingData } = await this.supabase
        .from('bet_snapshots')
        .select(`
          snapshot,
          parlay_pick_id,
          parlay_picks!inner(
            outcome,
            parlays!inner(outcome)
          )
        `)
        .not('parlay_picks.outcome', 'is', null)
        .limit(1000)

      if (!trainingData || trainingData.length === 0) {
        throw new Error('No training data available for feature importance analysis')
      }

      // Extract features and calculate importance
      const featureImportance = await this.calculateFeatureImportance(trainingData)
      const featureInteractions = await this.analyzeFeatureInteractions(trainingData)
      const redundantFeatures = await this.identifyRedundantFeatures(trainingData)

      return {
        feature_rankings: featureImportance,
        feature_interactions: featureInteractions,
        redundant_features: redundantFeatures
      }

    } catch (error) {
      logger.error('Failed to analyze feature importance:', error)
      throw error
    }
  }

  /**
   * Explore bet patterns and timing
   */
  async exploreBetPatterns(): Promise<{
    betting_volume_patterns: any
    optimal_betting_times: any
    market_efficiency: any
  }> {
    logger.info('Exploring bet patterns...')

    const { data: betTimingData } = await this.supabase
      .from('bet_snapshots')
      .select(`
        created_at,
        snapshot,
        parlay_pick_id,
        parlay_picks!inner(
          outcome,
          parlays!inner(outcome, payout_amount)
        )
      `)
      .not('parlay_picks.outcome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2000)

    // Analyze betting patterns
    const volumePatterns = this.analyzeBettingVolume(betTimingData || [])
    const optimalTimes = this.identifyOptimalBettingTimes(betTimingData || [])
    const marketEfficiency = this.assessMarketEfficiency(betTimingData || [])

    return {
      betting_volume_patterns: volumePatterns,
      optimal_betting_times: optimalTimes,
      market_efficiency: marketEfficiency
    }
  }

  // ============================================================================
  // DATA ANALYSIS METHODS
  // ============================================================================

  private async generateDataSummary() {
    const [
      { count: totalSnapshots },
      { count: totalParlays },
      { count: totalPicks },
      { data: dateRange },
      { data: uniquePlayers },
      { data: uniqueTournaments }
    ] = await Promise.all([
      this.supabase.from('bet_snapshots').select('*', { count: 'exact', head: true }),
      this.supabase.from('parlays').select('*', { count: 'exact', head: true }),
      this.supabase.from('parlay_picks').select('*', { count: 'exact', head: true }),
      this.supabase
        .from('bet_snapshots')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1)
        .union(
          this.supabase
            .from('bet_snapshots')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1)
        ),
      this.supabase
        .from('tournament_round_snapshots')
        .select('dg_id')
        .group('dg_id'),
      this.supabase
        .from('tournament_round_snapshots')
        .select('event_id')
        .group('event_id')
    ])

    return {
      total_bet_snapshots: totalSnapshots || 0,
      total_parlays: totalParlays || 0,
      total_picks: totalPicks || 0,
      date_range: {
        start: dateRange?.[0]?.created_at || 'N/A',
        end: dateRange?.[1]?.created_at || 'N/A'
      },
      unique_players: uniquePlayers?.length || 0,
      unique_tournaments: uniqueTournaments?.length || 0
    }
  }

  private async analyzeOutcomeDistribution() {
    // Parlay outcomes
    const { data: parlayOutcomes } = await this.supabase
      .from('parlays')
      .select('outcome')
      .not('outcome', 'is', null)

    // Pick outcomes
    const { data: pickOutcomes } = await this.supabase
      .from('parlay_picks')
      .select('outcome')
      .not('outcome', 'is', null)

    // Matchup type analysis
    const { data: matchupOutcomes } = await this.supabase
      .from('parlay_picks')
      .select(`
        outcome,
        matchups!inner(type)
      `)
      .not('outcome', 'is', null)

    const parlayDistribution = this.calculateDistribution(parlayOutcomes?.map(p => p.outcome) || [])
    const pickDistribution = this.calculateDistribution(pickOutcomes?.map(p => p.outcome) || [])
    
    const parlayWinRate = (parlayDistribution['win'] || 0) / (parlayOutcomes?.length || 1)
    const pickWinRate = (pickDistribution['win'] || 0) / (pickOutcomes?.length || 1)

    // Matchup type win rates
    const matchupTypeWinRates: { [type: string]: number } = {}
    const matchupGroups = this.groupBy(matchupOutcomes || [], (item: any) => item.matchups.type)
    
    Object.entries(matchupGroups).forEach(([type, outcomes]: [string, any[]]) => {
      const wins = outcomes.filter(o => o.outcome === 'win').length
      matchupTypeWinRates[type] = wins / outcomes.length
    })

    return {
      parlay_outcomes: parlayDistribution,
      pick_outcomes: pickDistribution,
      win_rates: {
        overall_parlay_win_rate: parlayWinRate,
        overall_pick_win_rate: pickWinRate,
        by_matchup_type: matchupTypeWinRates
      }
    }
  }

  private async analyzeFeatureDistributions() {
    const { data: snapshots } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        position_numeric,
        parlay_picks!inner(outcome)
      `)
      .not('sg_total', 'is', null)
      .not('position_numeric', 'is', null)
      .not('parlay_picks.outcome', 'is', null)
      .limit(5000)

    if (!snapshots || snapshots.length === 0) {
      return this.getDefaultFeatureAnalysis()
    }

    const sgCategories = ['sg_total', 'sg_ott', 'sg_app', 'sg_arg', 'sg_putt']
    const sgDistributions: any = {}

    sgCategories.forEach(category => {
      const values = snapshots.map((s: any) => s[category]).filter(v => v !== null)
      sgDistributions[category] = this.calculateStatistics(values)
    })

    // Position analysis by outcome
    const positionByOutcome: { [outcome: string]: number[] } = {}
    snapshots.forEach((s: any) => {
      const outcome = Array.isArray(s.parlay_picks) ? s.parlay_picks[0]?.outcome : s.parlay_picks.outcome
      if (outcome && s.position_numeric) {
        if (!positionByOutcome[outcome]) positionByOutcome[outcome] = []
        positionByOutcome[outcome].push(s.position_numeric)
      }
    })

    const avgPositionByOutcome: { [outcome: string]: number } = {}
    Object.entries(positionByOutcome).forEach(([outcome, positions]) => {
      avgPositionByOutcome[outcome] = this.calculateMean(positions)
    })

    const allPositions = snapshots.map((s: any) => s.position_numeric).filter(p => p !== null)
    const positionDistribution = this.calculatePositionDistribution(allPositions)

    return {
      sg_distributions: sgDistributions,
      position_analysis: {
        avg_position_by_outcome: avgPositionByOutcome,
        position_distribution: positionDistribution,
        position_volatility: this.calculateStandardDeviation(allPositions)
      },
      odds_analysis: {
        avg_odds_by_outcome: {}, // Would need odds data
        odds_accuracy: 0.5,
        value_opportunities: 0.1
      }
    }
  }

  private async analyzeTemporalPatterns() {
    const { data: temporalData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        round_num,
        snapshot_timestamp,
        event_name,
        sg_total,
        parlay_picks!inner(outcome)
      `)
      .not('parlay_picks.outcome', 'is', null)
      .limit(3000)

    if (!temporalData || temporalData.length === 0) {
      return {
        performance_by_round: {},
        seasonal_trends: {},
        tournament_difficulty: {}
      }
    }

    // Performance by round
    const performanceByRound: { [round: string]: { win_rate: number; avg_sg: number } } = {}
    const roundGroups = this.groupBy(temporalData, (item: any) => item.round_num)

    Object.entries(roundGroups).forEach(([round, data]: [string, any[]]) => {
      const wins = data.filter(d => {
        const outcome = Array.isArray(d.parlay_picks) ? d.parlay_picks[0]?.outcome : d.parlay_picks.outcome
        return outcome === 'win'
      }).length
      const avgSg = this.calculateMean(data.map(d => d.sg_total).filter(sg => sg !== null))
      
      performanceByRound[round] = {
        win_rate: wins / data.length,
        avg_sg: avgSg
      }
    })

    // Seasonal trends (by month)
    const seasonalTrends: { [month: string]: { win_rate: number; volume: number } } = {}
    const monthGroups = this.groupBy(temporalData, (item: any) => {
      const date = new Date(item.snapshot_timestamp)
      return date.toLocaleString('default', { month: 'long' })
    })

    Object.entries(monthGroups).forEach(([month, data]: [string, any[]]) => {
      const wins = data.filter(d => {
        const outcome = Array.isArray(d.parlay_picks) ? d.parlay_picks[0]?.outcome : d.parlay_picks.outcome
        return outcome === 'win'
      }).length
      
      seasonalTrends[month] = {
        win_rate: wins / data.length,
        volume: data.length
      }
    })

    // Tournament difficulty
    const tournamentDifficulty: { [tournament: string]: { win_rate: number; avg_field_strength: number } } = {}
    const tournamentGroups = this.groupBy(temporalData, (item: any) => item.event_name)

    Object.entries(tournamentGroups).forEach(([tournament, data]: [string, any[]]) => {
      const wins = data.filter(d => {
        const outcome = Array.isArray(d.parlay_picks) ? d.parlay_picks[0]?.outcome : d.parlay_picks.outcome
        return outcome === 'win'
      }).length
      const avgFieldStrength = this.calculateMean(data.map(d => d.sg_total).filter(sg => sg !== null))
      
      tournamentDifficulty[tournament] = {
        win_rate: wins / data.length,
        avg_field_strength: avgFieldStrength
      }
    })

    return {
      performance_by_round: performanceByRound,
      seasonal_trends: seasonalTrends,
      tournament_difficulty: tournamentDifficulty
    }
  }

  private async generatePlayerInsights() {
    const { data: playerData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        dg_id,
        player_name,
        sg_total,
        position_numeric,
        parlay_picks!inner(outcome)
      `)
      .not('parlay_picks.outcome', 'is', null)
      .limit(5000)

    if (!playerData || playerData.length === 0) {
      return {
        top_performers: [],
        most_backed_players: [],
        value_players: []
      }
    }

    // Group by player
    const playerGroups = this.groupBy(playerData, (item: any) => item.dg_id)

    const playerStats = Object.entries(playerGroups).map(([dgId, data]: [string, any[]]) => {
      const wins = data.filter(d => {
        const outcome = Array.isArray(d.parlay_picks) ? d.parlay_picks[0]?.outcome : d.parlay_picks.outcome
        return outcome === 'win'
      }).length

      const avgSg = this.calculateMean(data.map(d => d.sg_total).filter(sg => sg !== null))
      const positions = data.map(d => d.position_numeric).filter(p => p !== null)
      const consistency = positions.length > 1 ? 100 - this.calculateStandardDeviation(positions) : 0

      return {
        dg_id: parseInt(dgId),
        name: data[0].player_name,
        win_rate: wins / data.length,
        avg_sg_total: avgSg,
        consistency_score: consistency,
        times_picked: data.length
      }
    })

    // Sort and get top performers
    const topPerformers = playerStats
      .filter(p => p.times_picked >= 3) // Minimum sample size
      .sort((a, b) => b.win_rate - a.win_rate)
      .slice(0, 10)

    const mostBacked = playerStats
      .sort((a, b) => b.times_picked - a.times_picked)
      .slice(0, 10)

    // Value players (outperforming expectations)
    const valueThreshold = 0.33 // Expected win rate for 3-ball
    const valuePlayers = playerStats
      .filter(p => p.times_picked >= 3 && p.win_rate > valueThreshold)
      .map(p => ({
        ...p,
        expected_win_rate: valueThreshold,
        actual_win_rate: p.win_rate,
        value_score: p.win_rate - valueThreshold
      }))
      .sort((a, b) => b.value_score - a.value_score)
      .slice(0, 10)

    return {
      top_performers: topPerformers,
      most_backed_players: mostBacked,
      value_players: valuePlayers
    }
  }

  private async calculateCorrelations() {
    const { data: correlationData } = await this.supabase
      .from('tournament_round_snapshots')
      .select(`
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        position_numeric,
        parlay_picks!inner(outcome)
      `)
      .not('parlay_picks.outcome', 'is', null)
      .limit(2000)

    if (!correlationData || correlationData.length === 0) {
      return {
        sg_to_outcome: {},
        position_to_outcome: 0,
        odds_to_outcome: 0,
        form_to_outcome: 0
      }
    }

    // Convert outcomes to binary (1 for win, 0 for loss)
    const binaryOutcomes = correlationData.map(d => {
      const outcome = Array.isArray(d.parlay_picks) ? d.parlay_picks[0]?.outcome : d.parlay_picks.outcome
      return outcome === 'win' ? 1 : 0
    })

    const sgToOutcome: { [category: string]: number } = {}
    const sgCategories = ['sg_total', 'sg_ott', 'sg_app', 'sg_arg', 'sg_putt']

    sgCategories.forEach(category => {
      const sgValues = correlationData.map((d: any) => d[category]).filter(v => v !== null)
      if (sgValues.length === binaryOutcomes.length) {
        sgToOutcome[category] = this.calculateCorrelation(sgValues, binaryOutcomes)
      }
    })

    const positions = correlationData.map(d => d.position_numeric).filter(p => p !== null)
    const positionToOutcome = positions.length === binaryOutcomes.length 
      ? this.calculateCorrelation(positions, binaryOutcomes) 
      : 0

    return {
      sg_to_outcome: sgToOutcome,
      position_to_outcome: positionToOutcome,
      odds_to_outcome: 0, // Would need odds data
      form_to_outcome: 0  // Would need form data
    }
  }

  private async assessDataQuality() {
    const { data: qualityData } = await this.supabase
      .from('bet_snapshots')
      .select('snapshot, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (!qualityData || qualityData.length === 0) {
      return {
        completeness_score: 0,
        missing_data_summary: {},
        data_freshness: 'No data',
        anomalies_detected: 0
      }
    }

    // Analyze completeness
    const missingDataSummary: { [field: string]: number } = {}
    let totalFields = 0
    let missingFields = 0

    qualityData.forEach(record => {
      const snapshot = record.snapshot
      if (snapshot) {
        const fields = this.flattenObject(snapshot)
        Object.entries(fields).forEach(([key, value]) => {
          totalFields++
          if (value === null || value === undefined || value === '') {
            missingFields++
            missingDataSummary[key] = (missingDataSummary[key] || 0) + 1
          }
        })
      }
    })

    const completenessScore = totalFields > 0 ? ((totalFields - missingFields) / totalFields) * 100 : 0

    // Data freshness
    const latestRecord = qualityData[0]
    const dataAge = Date.now() - new Date(latestRecord.created_at).getTime()
    const hoursOld = Math.floor(dataAge / (1000 * 60 * 60))
    const dataFreshness = `${hoursOld} hours old`

    return {
      completeness_score: completenessScore,
      missing_data_summary: missingDataSummary,
      data_freshness: dataFreshness,
      anomalies_detected: 0 // Would implement anomaly detection
    }
  }

  // ============================================================================
  // FEATURE IMPORTANCE ANALYSIS
  // ============================================================================

  private async calculateFeatureImportance(trainingData: any[]): Promise<any[]> {
    // Simplified feature importance calculation
    // In a real implementation, this would use ML algorithms
    
    const features = [
      'sg_total', 'sg_ott', 'sg_app', 'sg_arg', 'sg_putt',
      'position', 'odds', 'form_trend', 'momentum'
    ]

    return features.map(feature => ({
      feature_name: feature,
      importance_score: Math.random() * 100, // Placeholder
      correlation_to_outcome: Math.random() * 2 - 1, // -1 to 1
      predictive_power: Math.random() * 100
    })).sort((a, b) => b.importance_score - a.importance_score)
  }

  private async analyzeFeatureInteractions(trainingData: any[]): Promise<any[]> {
    // Placeholder for feature interaction analysis
    return [
      {
        feature_1: 'sg_total',
        feature_2: 'position',
        interaction_strength: 0.75,
        combined_predictive_power: 85
      }
    ]
  }

  private async identifyRedundantFeatures(trainingData: any[]): Promise<any[]> {
    // Placeholder for redundant feature identification
    return [
      {
        feature_name: 'sg_ott_duplicate',
        correlation_with: 'sg_ott',
        correlation_score: 0.95,
        recommendation: 'remove' as const
      }
    ]
  }

  // ============================================================================
  // BET PATTERN ANALYSIS
  // ============================================================================

  private analyzeBettingVolume(betData: any[]) {
    const hourlyVolume: { [hour: string]: number } = {}
    const dailyVolume: { [day: string]: number } = {}

    betData.forEach(bet => {
      const date = new Date(bet.created_at)
      const hour = date.getHours().toString()
      const day = date.toLocaleDateString()

      hourlyVolume[hour] = (hourlyVolume[hour] || 0) + 1
      dailyVolume[day] = (dailyVolume[day] || 0) + 1
    })

    return { hourly: hourlyVolume, daily: dailyVolume }
  }

  private identifyOptimalBettingTimes(betData: any[]) {
    // Analyze win rates by betting time
    const timeSlots: { [slot: string]: { wins: number; total: number } } = {}

    betData.forEach(bet => {
      const hour = new Date(bet.created_at).getHours()
      const timeSlot = this.getTimeSlot(hour)
      
      if (!timeSlots[timeSlot]) {
        timeSlots[timeSlot] = { wins: 0, total: 0 }
      }
      
      timeSlots[timeSlot].total++
      const outcome = bet.parlay_picks?.outcome || bet.parlay_picks?.[0]?.outcome
      if (outcome === 'win') {
        timeSlots[timeSlot].wins++
      }
    })

    const optimalTimes = Object.entries(timeSlots).map(([slot, data]) => ({
      time_slot: slot,
      win_rate: data.wins / data.total,
      volume: data.total
    })).sort((a, b) => b.win_rate - a.win_rate)

    return optimalTimes
  }

  private assessMarketEfficiency(betData: any[]) {
    // Placeholder for market efficiency analysis
    return {
      efficiency_score: 0.75,
      arbitrage_opportunities: 0.05,
      market_bias: 'slight_favorite_bias'
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  private calculateDistribution(values: string[]): { [key: string]: number } {
    const distribution: { [key: string]: number } = {}
    values.forEach(value => {
      distribution[value] = (distribution[value] || 0) + 1
    })
    return distribution
  }

  private calculateStatistics(values: number[]) {
    if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0 }
    
    const mean = this.calculateMean(values)
    const std = this.calculateStandardDeviation(values)
    const min = Math.min(...values)
    const max = Math.max(...values)
    
    return { mean, std, min, max }
  }

  private calculateMean(values: number[]): number {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v))
    return validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0
  }

  private calculateStandardDeviation(values: number[]): number {
    const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v))
    if (validValues.length < 2) return 0
    
    const mean = this.calculateMean(validValues)
    const squaredDiffs = validValues.map(value => Math.pow(value - mean, 2))
    const avgSquaredDiff = this.calculateMean(squaredDiffs)
    return Math.sqrt(avgSquaredDiff)
  }

  private calculatePositionDistribution(positions: number[]) {
    const ranges = {
      'Top 5': positions.filter(p => p <= 5).length,
      'Top 10': positions.filter(p => p > 5 && p <= 10).length,
      'Top 20': positions.filter(p => p > 10 && p <= 20).length,
      'Top 50': positions.filter(p => p > 20 && p <= 50).length,
      'Beyond 50': positions.filter(p => p > 50).length
    }
    return ranges
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0
    
    const meanX = this.calculateMean(x)
    const meanY = this.calculateMean(y)
    
    let numerator = 0
    let denomX = 0
    let denomY = 0
    
    for (let i = 0; i < x.length; i++) {
      const deltaX = x[i] - meanX
      const deltaY = y[i] - meanY
      numerator += deltaX * deltaY
      denomX += deltaX * deltaX
      denomY += deltaY * deltaY
    }
    
    const denominator = Math.sqrt(denomX * denomY)
    return denominator === 0 ? 0 : numerator / denominator
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): { [key: string]: T[] } {
    return array.reduce((groups, item) => {
      const key = keyFn(item)
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
      return groups
    }, {} as { [key: string]: T[] })
  }

  private flattenObject(obj: any, prefix = ''): { [key: string]: any } {
    const flattened: { [key: string]: any } = {}
    
    Object.keys(obj || {}).forEach(key => {
      const value = obj[key]
      const newKey = prefix ? `${prefix}.${key}` : key
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey))
      } else {
        flattened[newKey] = value
      }
    })
    
    return flattened
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'Morning'
    if (hour >= 12 && hour < 18) return 'Afternoon'
    if (hour >= 18 && hour < 22) return 'Evening'
    return 'Night'
  }

  private getDefaultFeatureAnalysis() {
    return {
      sg_distributions: {
        sg_total: { mean: 0, std: 1, min: -3, max: 3 },
        sg_ott: { mean: 0, std: 1, min: -2, max: 2 },
        sg_app: { mean: 0, std: 1, min: -2, max: 2 },
        sg_arg: { mean: 0, std: 1, min: -2, max: 2 },
        sg_putt: { mean: 0, std: 1, min: -2, max: 2 }
      },
      position_analysis: {
        avg_position_by_outcome: {},
        position_distribution: {},
        position_volatility: 0
      },
      odds_analysis: {
        avg_odds_by_outcome: {},
        odds_accuracy: 0.5,
        value_opportunities: 0.1
      }
    }
  }
}

// ============================================================================
// VISUALIZATION HELPERS
// ============================================================================

export class DataVisualizationHelper {
  /**
   * Generate chart data for feature distributions
   */
  static generateFeatureDistributionCharts(report: DataExplorationReport) {
    const sgChartData = Object.entries(report.feature_analysis.sg_distributions).map(([category, stats]) => ({
      category,
      mean: stats.mean,
      std: stats.std,
      range: [stats.min, stats.max]
    }))

    const outcomeChartData = Object.entries(report.outcome_distribution.parlay_outcomes).map(([outcome, count]) => ({
      outcome,
      count,
      percentage: (count / Object.values(report.outcome_distribution.parlay_outcomes).reduce((a, b) => a + b, 0)) * 100
    }))

    return {
      sg_distributions: sgChartData,
      outcome_distribution: outcomeChartData
    }
  }

  /**
   * Generate temporal analysis charts
   */
  static generateTemporalCharts(report: DataExplorationReport) {
    const roundPerformance = Object.entries(report.temporal_patterns.performance_by_round).map(([round, data]) => ({
      round,
      win_rate: data.win_rate,
      avg_sg: data.avg_sg
    }))

    const seasonalTrends = Object.entries(report.temporal_patterns.seasonal_trends).map(([month, data]) => ({
      month,
      win_rate: data.win_rate,
      volume: data.volume
    }))

    return {
      round_performance: roundPerformance,
      seasonal_trends: seasonalTrends
    }
  }
}

export { GolfDataExplorer as default } 
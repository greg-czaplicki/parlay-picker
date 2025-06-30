#!/usr/bin/env node

/**
 * Score Format Analysis Script
 * 
 * This script performs detailed analysis of score formats to determine
 * whether scores are stored as actual values (68, 71) or relative to par (-2, +1)
 */

import { supabase, logger, config } from './config.js'
import fs from 'fs-extra'
import path from 'path'

class ScoreFormatAnalyzer {
  constructor() {
    this.analysisResults = {
      timestamp: new Date().toISOString(),
      tournaments_analyzed: [],
      score_format_summary: {},
      par_inference_results: {},
      recommendations: []
    }
  }

  /**
   * Analyze score formats across all tournaments
   */
  async analyzeAllTournaments() {
    logger.info('Starting comprehensive score format analysis...')

    try {
      // Get all tournaments with results
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true })

      if (tournamentsError) throw tournamentsError

      // Get all tournament results with round scores
      const { data: results, error: resultsError } = await supabase
        .from('tournament_results')
        .select('*')
        .not('round_scores', 'is', null)

      if (resultsError) throw resultsError

      // Get live tournament stats for additional context
      const { data: liveStats, error: liveError } = await supabase
        .from('live_tournament_stats')
        .select('*')

      if (liveError) throw liveError

      logger.info(`Analyzing ${tournaments.length} tournaments, ${results.length} results, ${liveStats.length} live stats`)

      // Group results by tournament
      const resultsByTournament = this.groupResultsByTournament(results)
      const liveStatsByTournament = this.groupLiveStatsByTournament(liveStats)

      // Analyze each tournament
      for (const tournament of tournaments) {
        const tournamentResults = resultsByTournament.get(tournament.event_id) || []
        const tournamentLiveStats = liveStatsByTournament.get(tournament.event_name) || []

        if (tournamentResults.length > 0 || tournamentLiveStats.length > 0) {
          const analysis = await this.analyzeTournament(tournament, tournamentResults, tournamentLiveStats)
          this.analysisResults.tournaments_analyzed.push(analysis)
        }
      }

      this.generateSummary()
      await this.saveResults()

      logger.info('Score format analysis completed successfully!')
      return this.analysisResults

    } catch (error) {
      logger.error('Score format analysis failed:', error)
      throw error
    }
  }

  /**
   * Group tournament results by tournament
   */
  groupResultsByTournament(results) {
    const grouped = new Map()
    results.forEach(result => {
      if (!grouped.has(result.event_id)) {
        grouped.set(result.event_id, [])
      }
      grouped.get(result.event_id).push(result)
    })
    return grouped
  }

  /**
   * Group live stats by tournament
   */
  groupLiveStatsByTournament(liveStats) {
    const grouped = new Map()
    liveStats.forEach(stat => {
      if (!grouped.has(stat.event_name)) {
        grouped.set(stat.event_name, [])
      }
      grouped.get(stat.event_name).push(stat)
    })
    return grouped
  }

  /**
   * Analyze score format for a specific tournament
   */
  async analyzeTournament(tournament, results, liveStats) {
    logger.info(`Analyzing tournament: ${tournament.event_name} (${tournament.event_id})`)

    const analysis = {
      tournament_id: tournament.event_id,
      tournament_name: tournament.event_name,
      start_date: tournament.start_date,
      course_name: tournament.course,
      results_count: results.length,
      live_stats_count: liveStats.length,
      round_scores_analysis: null,
      live_stats_analysis: null,
      inferred_par: null,
      final_format_determination: null,
      confidence_level: null,
      issues: []
    }

    // Analyze round scores from tournament results
    if (results.length > 0) {
      analysis.round_scores_analysis = this.analyzeRoundScores(results)
    }

    // Analyze live stats scores
    if (liveStats.length > 0) {
      analysis.live_stats_analysis = this.analyzeLiveStats(liveStats)
    }

    // Infer course par if possible
    analysis.inferred_par = this.inferCoursePar(analysis)

    // Make final format determination
    analysis.final_format_determination = this.determineFinalFormat(analysis)

    return analysis
  }

  /**
   * Analyze round scores from tournament results
   */
  analyzeRoundScores(results) {
    const allScores = []
    const roundScoresByRound = { 1: [], 2: [], 3: [], 4: [] }
    let validResults = 0

    results.forEach(result => {
      if (result.round_scores && Array.isArray(result.round_scores)) {
        const scores = result.round_scores.filter(score => score !== null && score !== 0)
        if (scores.length > 0) {
          validResults++
          allScores.push(...scores)
          
          // Distribute scores by round position
          scores.forEach((score, index) => {
            if (index < 4 && roundScoresByRound[index + 1]) {
              roundScoresByRound[index + 1].push(score)
            }
          })
        }
      }
    })

    if (allScores.length === 0) {
      return {
        status: 'no_data',
        message: 'No valid round scores found'
      }
    }

    const stats = this.calculateScoreStatistics(allScores)
    const formatAnalysis = this.analyzeScoreFormat(allScores)

    return {
      status: 'analyzed',
      valid_results: validResults,
      total_scores: allScores.length,
      statistics: stats,
      format_analysis: formatAnalysis,
      round_breakdown: {
        round_1: this.calculateScoreStatistics(roundScoresByRound[1]),
        round_2: this.calculateScoreStatistics(roundScoresByRound[2]),
        round_3: this.calculateScoreStatistics(roundScoresByRound[3]),
        round_4: this.calculateScoreStatistics(roundScoresByRound[4])
      }
    }
  }

  /**
   * Analyze live stats scores
   */
  analyzeLiveStats(liveStats) {
    const todayScores = liveStats.map(s => s.today).filter(score => score !== null && score !== undefined)
    const totalScores = liveStats.map(s => s.total).filter(score => score !== null && score !== undefined)
    const allScores = [...todayScores, ...totalScores]

    if (allScores.length === 0) {
      return {
        status: 'no_data',
        message: 'No valid live scores found'
      }
    }

    const stats = this.calculateScoreStatistics(allScores)
    const formatAnalysis = this.analyzeScoreFormat(allScores)

    return {
      status: 'analyzed',
      today_scores_count: todayScores.length,
      total_scores_count: totalScores.length,
      statistics: stats,
      format_analysis: formatAnalysis
    }
  }

  /**
   * Calculate basic statistics for a set of scores
   */
  calculateScoreStatistics(scores) {
    if (scores.length === 0) {
      return { count: 0 }
    }

    const sortedScores = [...scores].sort((a, b) => a - b)
    const sum = scores.reduce((acc, score) => acc + score, 0)
    const mean = sum / scores.length
    const median = sortedScores[Math.floor(sortedScores.length / 2)]

    return {
      count: scores.length,
      min: sortedScores[0],
      max: sortedScores[sortedScores.length - 1],
      mean: Math.round(mean * 100) / 100,
      median,
      range: sortedScores[sortedScores.length - 1] - sortedScores[0],
      q1: sortedScores[Math.floor(scores.length * 0.25)],
      q3: sortedScores[Math.floor(scores.length * 0.75)]
    }
  }

  /**
   * Analyze score format (actual vs relative to par)
   */
  analyzeScoreFormat(scores) {
    const { scoreThresholds } = config.validation
    let actualCount = 0
    let relativeCount = 0
    let uncertainCount = 0

    scores.forEach(score => {
      if (score >= scoreThresholds.minActualScore && score <= scoreThresholds.maxActualScore) {
        actualCount++
      } else if (score >= scoreThresholds.minRelativeScore && score <= scoreThresholds.maxRelativeScore) {
        relativeCount++
      } else {
        uncertainCount++
      }
    })

    const total = scores.length
    const actualPercent = (actualCount / total) * 100
    const relativePercent = (relativeCount / total) * 100
    const uncertainPercent = (uncertainCount / total) * 100

    // Determine most likely format
    let likelyFormat = 'unknown'
    let confidence = 0

    if (actualPercent > 80) {
      likelyFormat = 'actual'
      confidence = actualPercent / 100
    } else if (relativePercent > 80) {
      likelyFormat = 'relative'
      confidence = relativePercent / 100
    } else if (actualPercent > relativePercent) {
      likelyFormat = 'actual'
      confidence = actualPercent / 100
    } else if (relativePercent > actualPercent) {
      likelyFormat = 'relative'
      confidence = relativePercent / 100
    }

    return {
      likely_format: likelyFormat,
      confidence,
      distribution: {
        actual_count: actualCount,
        actual_percent: Math.round(actualPercent * 100) / 100,
        relative_count: relativeCount,
        relative_percent: Math.round(relativePercent * 100) / 100,
        uncertain_count: uncertainCount,
        uncertain_percent: Math.round(uncertainPercent * 100) / 100
      }
    }
  }

  /**
   * Infer course par from score distribution
   */
  inferCoursePar(tournamentAnalysis) {
    const { parInference } = config.validation
    
    // Try to infer from round scores
    if (tournamentAnalysis.round_scores_analysis?.format_analysis?.likely_format === 'actual') {
      const stats = tournamentAnalysis.round_scores_analysis.statistics
      if (stats.count > 10) { // Need sufficient data
        // Professional golf average is typically around par
        // Infer par based on average score
        const estimatedPar = Math.round(stats.mean)
        
        if (estimatedPar >= parInference.minPar && estimatedPar <= parInference.maxPar) {
          return {
            inferred_par: estimatedPar,
            confidence: 0.7,
            method: 'round_score_average',
            data_points: stats.count
          }
        }
      }
    }

    // Try to infer from live stats
    if (tournamentAnalysis.live_stats_analysis?.format_analysis?.likely_format === 'actual') {
      const stats = tournamentAnalysis.live_stats_analysis.statistics
      if (stats.count > 20) { // Need more data for live stats
        const estimatedPar = Math.round(stats.mean)
        
        if (estimatedPar >= parInference.minPar && estimatedPar <= parInference.maxPar) {
          return {
            inferred_par: estimatedPar,
            confidence: 0.6,
            method: 'live_stats_average',
            data_points: stats.count
          }
        }
      }
    }

    // Default fallback
    return {
      inferred_par: parInference.defaultPar,
      confidence: 0.1,
      method: 'default_fallback',
      data_points: 0
    }
  }

  /**
   * Make final format determination for tournament
   */
  determineFinalFormat(tournamentAnalysis) {
    const roundAnalysis = tournamentAnalysis.round_scores_analysis
    const liveAnalysis = tournamentAnalysis.live_stats_analysis

    let format = 'unknown'
    let confidence = 0
    let primarySource = null
    let reasoning = []

    // Prioritize round scores analysis if available
    if (roundAnalysis?.format_analysis) {
      const roundFormat = roundAnalysis.format_analysis
      if (roundFormat.confidence > 0.7) {
        format = roundFormat.likely_format
        confidence = roundFormat.confidence
        primarySource = 'round_scores'
        reasoning.push(`High confidence from round scores analysis (${Math.round(confidence * 100)}%)`)
      }
    }

    // Use live stats if round scores are not conclusive
    if (confidence < 0.7 && liveAnalysis?.format_analysis) {
      const liveFormat = liveAnalysis.format_analysis
      if (liveFormat.confidence > confidence) {
        format = liveFormat.likely_format
        confidence = liveFormat.confidence
        primarySource = 'live_stats'
        reasoning.push(`Better confidence from live stats analysis (${Math.round(confidence * 100)}%)`)
      }
    }

    // Cross-validation
    if (roundAnalysis?.format_analysis && liveAnalysis?.format_analysis) {
      const roundFormat = roundAnalysis.format_analysis.likely_format
      const liveFormat = liveAnalysis.format_analysis.likely_format
      
      if (roundFormat === liveFormat) {
        confidence = Math.max(confidence, 0.8)
        reasoning.push('Round scores and live stats agree on format')
      } else {
        confidence = Math.min(confidence, 0.5)
        reasoning.push('Round scores and live stats disagree on format')
      }
    }

    return {
      determined_format: format,
      confidence,
      primary_source: primarySource,
      reasoning
    }
  }

  /**
   * Generate overall summary
   */
  generateSummary() {
    const formatCounts = {
      actual: 0,
      relative: 0,
      unknown: 0
    }

    const confidenceLevels = {
      high: 0,    // > 0.8
      medium: 0,  // 0.5 - 0.8
      low: 0      // < 0.5
    }

    const parInferences = []

    this.analysisResults.tournaments_analyzed.forEach(tournament => {
      const format = tournament.final_format_determination?.determined_format || 'unknown'
      const confidence = tournament.final_format_determination?.confidence || 0

      formatCounts[format]++

      if (confidence > 0.8) {
        confidenceLevels.high++
      } else if (confidence >= 0.5) {
        confidenceLevels.medium++
      } else {
        confidenceLevels.low++
      }

      if (tournament.inferred_par) {
        parInferences.push({
          tournament: tournament.tournament_name,
          par: tournament.inferred_par.inferred_par,
          confidence: tournament.inferred_par.confidence
        })
      }
    })

    this.analysisResults.score_format_summary = {
      total_tournaments: this.analysisResults.tournaments_analyzed.length,
      format_distribution: formatCounts,
      confidence_distribution: confidenceLevels,
      format_percentages: {
        actual: Math.round((formatCounts.actual / this.analysisResults.tournaments_analyzed.length) * 100),
        relative: Math.round((formatCounts.relative / this.analysisResults.tournaments_analyzed.length) * 100),
        unknown: Math.round((formatCounts.unknown / this.analysisResults.tournaments_analyzed.length) * 100)
      }
    }

    this.analysisResults.par_inference_results = {
      tournaments_with_par: parInferences.length,
      average_par: parInferences.length > 0 ? 
        Math.round(parInferences.reduce((sum, p) => sum + p.par, 0) / parInferences.length) : 72,
      par_distribution: this.countParValues(parInferences)
    }

    this.generateRecommendations()
  }

  /**
   * Count par value distribution
   */
  countParValues(parInferences) {
    const distribution = {}
    parInferences.forEach(inference => {
      const par = inference.par
      distribution[par] = (distribution[par] || 0) + 1
    })
    return distribution
  }

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations() {
    const recommendations = []
    const summary = this.analysisResults.score_format_summary

    if (summary.format_percentages.unknown > 20) {
      recommendations.push('High percentage of tournaments with unknown score format - manual review recommended')
    }

    if (summary.format_percentages.actual > 60) {
      recommendations.push('Majority of tournaments use actual scores - configure migration to preserve actual values')
    } else if (summary.format_percentages.relative > 60) {
      recommendations.push('Majority of tournaments use relative scores - configure migration to convert to actual scores')
    } else {
      recommendations.push('Mixed score formats detected - implement tournament-specific conversion logic')
    }

    if (summary.confidence_distribution.low > summary.confidence_distribution.high) {
      recommendations.push('Many tournaments have low confidence in format detection - consider additional validation')
    }

    const parResults = this.analysisResults.par_inference_results
    if (parResults.tournaments_with_par < this.analysisResults.tournaments_analyzed.length * 0.5) {
      recommendations.push('Par inference success rate is low - consider using default par values for migration')
    }

    this.analysisResults.recommendations = recommendations
  }

  /**
   * Save analysis results
   */
  async saveResults() {
    const outputPath = path.join(config.migration.outputDir, 'score-format-analysis.json')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    try {
      await fs.writeJson(outputPath, this.analysisResults, { spaces: 2 })
      
      const backupPath = path.join(
        config.migration.backupDir,
        `score-format-analysis-${timestamp}.json`
      )
      await fs.writeJson(backupPath, this.analysisResults, { spaces: 2 })

      logger.info(`Score format analysis saved to ${outputPath}`)
      
    } catch (error) {
      logger.error('Failed to save analysis results:', error)
      throw error
    }
  }
}

// Run analysis if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const analyzer = new ScoreFormatAnalyzer()
  analyzer.analyzeAllTournaments()
    .then(results => {
      console.log('\n=== SCORE FORMAT ANALYSIS COMPLETE ===')
      console.log('Tournaments Analyzed:', results.score_format_summary.total_tournaments)
      console.log('Format Distribution:', results.score_format_summary.format_distribution)
      console.log('Format Percentages:', results.score_format_summary.format_percentages)
      console.log('\nRecommendations:')
      results.recommendations.forEach(rec => console.log(`  - ${rec}`))
      process.exit(0)
    })
    .catch(error => {
      console.error('Analysis failed:', error)
      process.exit(1)
    })
}

export default ScoreFormatAnalyzer
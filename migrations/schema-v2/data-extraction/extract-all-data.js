#!/usr/bin/env node

/**
 * Data Extraction Script for v2 Schema Migration
 * 
 * This script extracts all data from the current database schema
 * and prepares it for migration to the v2 schema.
 */

import { supabase, logger, config } from './config.js'
import fs from 'fs-extra'
import path from 'path'

class DataExtractor {
  constructor() {
    this.extractedData = {
      tournaments: [],
      players: [],
      tournamentResults: [],
      liveStats: [],
      seasonStats: [],
      extractionMetadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        sourceSchema: 'original',
        targetSchema: 'v2'
      }
    }
  }

  /**
   * Extract all tournaments data
   */
  async extractTournaments() {
    logger.info('Extracting tournaments data...')
    
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: true })

      if (error) throw error

      this.extractedData.tournaments = data || []
      logger.info(`Extracted ${this.extractedData.tournaments.length} tournaments`)
      
      return this.extractedData.tournaments
    } catch (error) {
      logger.error('Failed to extract tournaments:', error)
      throw error
    }
  }

  /**
   * Extract all players data
   */
  async extractPlayers() {
    logger.info('Extracting players data...')
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('dg_id', { ascending: true })

      if (error) throw error

      this.extractedData.players = data || []
      logger.info(`Extracted ${this.extractedData.players.length} players`)
      
      return this.extractedData.players
    } catch (error) {
      logger.error('Failed to extract players:', error)
      throw error
    }
  }

  /**
   * Extract tournament results with round score analysis
   */
  async extractTournamentResults() {
    logger.info('Extracting tournament results...')
    
    try {
      const { data, error } = await supabase
        .from('tournament_results')
        .select('*')
        .order('event_id', { ascending: true })

      if (error) throw error

      // Analyze round scores for format detection
      const enhancedResults = data?.map(result => {
        const analysis = this.analyzeRoundScores(result.round_scores)
        return {
          ...result,
          score_analysis: analysis
        }
      }) || []

      this.extractedData.tournamentResults = enhancedResults
      logger.info(`Extracted ${this.extractedData.tournamentResults.length} tournament results`)
      
      return this.extractedData.tournamentResults
    } catch (error) {
      logger.error('Failed to extract tournament results:', error)
      throw error
    }
  }

  /**
   * Extract live tournament stats
   */
  async extractLiveStats() {
    logger.info('Extracting live tournament stats...')
    
    try {
      const { data, error } = await supabase
        .from('live_tournament_stats')
        .select('*')
        .order('event_name', { ascending: true })

      if (error) throw error

      // Analyze scores for format detection
      const enhancedStats = data?.map(stat => {
        const scoreAnalysis = this.analyzeIndividualScore(stat.today, stat.total)
        return {
          ...stat,
          score_analysis: scoreAnalysis
        }
      }) || []

      this.extractedData.liveStats = enhancedStats
      logger.info(`Extracted ${this.extractedData.liveStats.length} live stats records`)
      
      return this.extractedData.liveStats
    } catch (error) {
      logger.error('Failed to extract live stats:', error)
      throw error
    }
  }

  /**
   * Extract player season stats
   */
  async extractSeasonStats() {
    logger.info('Extracting player season stats...')
    
    try {
      const { data, error } = await supabase
        .from('player_season_stats')
        .select('*')
        .order('dg_id', { ascending: true })

      if (error) throw error

      this.extractedData.seasonStats = data || []
      logger.info(`Extracted ${this.extractedData.seasonStats.length} season stats records`)
      
      return this.extractedData.seasonStats
    } catch (error) {
      logger.error('Failed to extract season stats:', error)
      throw error
    }
  }

  /**
   * Analyze round scores array to detect format (actual vs relative)
   */
  analyzeRoundScores(roundScores) {
    if (!roundScores || !Array.isArray(roundScores) || roundScores.length === 0) {
      return {
        format: 'unknown',
        confidence: 0,
        issues: ['no_scores_available']
      }
    }

    const scores = roundScores.filter(score => score !== null && score !== 0)
    if (scores.length === 0) {
      return {
        format: 'unknown',
        confidence: 0,
        issues: ['all_scores_null_or_zero']
      }
    }

    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length

    // Detection logic
    const { scoreThresholds } = config.validation
    let format = 'unknown'
    let confidence = 0
    let issues = []

    if (minScore >= scoreThresholds.minActualScore && maxScore <= scoreThresholds.maxActualScore) {
      format = 'actual'
      confidence = 0.9
    } else if (minScore >= scoreThresholds.minRelativeScore && maxScore <= scoreThresholds.maxRelativeScore) {
      format = 'relative'
      confidence = 0.9
    } else {
      issues.push('scores_outside_expected_ranges')
      // Try to guess based on average
      if (avgScore > 40) {
        format = 'actual'
        confidence = 0.3
      } else {
        format = 'relative'
        confidence = 0.3
      }
    }

    return {
      format,
      confidence,
      minScore,
      maxScore,
      avgScore: Math.round(avgScore * 100) / 100,
      scoreCount: scores.length,
      issues
    }
  }

  /**
   * Analyze individual score values from live stats
   */
  analyzeIndividualScore(todayScore, totalScore) {
    const scores = [todayScore, totalScore].filter(score => score !== null && score !== undefined)
    
    if (scores.length === 0) {
      return { format: 'unknown', confidence: 0 }
    }

    const { scoreThresholds } = config.validation
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)

    if (minScore >= scoreThresholds.minActualScore && maxScore <= scoreThresholds.maxActualScore) {
      return { format: 'actual', confidence: 0.8 }
    } else if (minScore >= scoreThresholds.minRelativeScore && maxScore <= scoreThresholds.maxRelativeScore) {
      return { format: 'relative', confidence: 0.8 }
    }

    return { format: 'mixed', confidence: 0.2 }
  }

  /**
   * Save extracted data to files
   */
  async saveExtractedData() {
    const outputPath = path.join(config.migration.outputDir, 'extracted-data.json')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    try {
      // Save main extraction file
      await fs.writeJson(outputPath, this.extractedData, { spaces: 2 })
      
      // Save timestamped backup
      const backupPath = path.join(
        config.migration.backupDir, 
        `extracted-data-${timestamp}.json`
      )
      await fs.writeJson(backupPath, this.extractedData, { spaces: 2 })
      
      // Save individual files for easier analysis
      for (const [key, data] of Object.entries(this.extractedData)) {
        if (key !== 'extractionMetadata' && Array.isArray(data)) {
          const filePath = path.join(config.migration.outputDir, `${key}.json`)
          await fs.writeJson(filePath, data, { spaces: 2 })
        }
      }

      logger.info(`Data saved to ${outputPath}`)
      logger.info(`Backup saved to ${backupPath}`)
      
    } catch (error) {
      logger.error('Failed to save extracted data:', error)
      throw error
    }
  }

  /**
   * Generate extraction summary
   */
  generateSummary() {
    const summary = {
      extraction_timestamp: this.extractedData.extractionMetadata.timestamp,
      total_records: {
        tournaments: this.extractedData.tournaments.length,
        players: this.extractedData.players.length,
        tournament_results: this.extractedData.tournamentResults.length,
        live_stats: this.extractedData.liveStats.length,
        season_stats: this.extractedData.seasonStats.length
      },
      score_format_analysis: this.analyzeScoreFormats(),
      data_quality_summary: this.analyzeDataQuality()
    }

    logger.info('Extraction Summary:', summary)
    return summary
  }

  /**
   * Analyze score formats across all data
   */
  analyzeScoreFormats() {
    const formatCounts = {
      actual: 0,
      relative: 0,
      unknown: 0,
      mixed: 0
    }

    // Analyze tournament results
    this.extractedData.tournamentResults.forEach(result => {
      if (result.score_analysis) {
        formatCounts[result.score_analysis.format] = (formatCounts[result.score_analysis.format] || 0) + 1
      }
    })

    // Analyze live stats
    this.extractedData.liveStats.forEach(stat => {
      if (stat.score_analysis) {
        formatCounts[stat.score_analysis.format] = (formatCounts[stat.score_analysis.format] || 0) + 1
      }
    })

    return formatCounts
  }

  /**
   * Analyze overall data quality
   */
  analyzeDataQuality() {
    return {
      players_missing_country: this.extractedData.players.filter(p => !p.country).length,
      tournaments_missing_course: this.extractedData.tournaments.filter(t => !t.course).length,
      results_missing_scores: this.extractedData.tournamentResults.filter(r => !r.round_scores || r.round_scores.length === 0).length,
      live_stats_missing_scores: this.extractedData.liveStats.filter(s => s.today === null && s.total === null).length
    }
  }

  /**
   * Extract all data
   */
  async extractAll() {
    logger.info('Starting data extraction process...')
    
    try {
      await this.extractTournaments()
      await this.extractPlayers()
      await this.extractTournamentResults()
      await this.extractLiveStats()
      await this.extractSeasonStats()
      
      await this.saveExtractedData()
      const summary = this.generateSummary()
      
      logger.info('Data extraction completed successfully!')
      return summary
      
    } catch (error) {
      logger.error('Data extraction failed:', error)
      throw error
    }
  }
}

// Run extraction if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const extractor = new DataExtractor()
  extractor.extractAll()
    .then(summary => {
      console.log('\n=== EXTRACTION COMPLETE ===')
      console.log(JSON.stringify(summary, null, 2))
      process.exit(0)
    })
    .catch(error => {
      console.error('Extraction failed:', error)
      process.exit(1)
    })
}

export default DataExtractor
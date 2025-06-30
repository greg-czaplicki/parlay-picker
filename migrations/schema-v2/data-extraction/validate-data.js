#!/usr/bin/env node

/**
 * Data Validation Script for v2 Schema Migration
 * 
 * This script validates extracted data and identifies potential issues
 * before migration to the v2 schema.
 */

import { logger, config } from './config.js'
import fs from 'fs-extra'
import path from 'path'

class DataValidator {
  constructor() {
    this.validationResults = {
      timestamp: new Date().toISOString(),
      overall_status: 'unknown',
      validation_summary: {},
      detailed_issues: {},
      recommendations: [],
      migration_readiness: {
        ready: false,
        blockers: [],
        warnings: []
      }
    }
  }

  /**
   * Load extracted data
   */
  async loadExtractedData() {
    const dataPath = path.join(config.migration.outputDir, 'extracted-data.json')
    
    try {
      if (!await fs.pathExists(dataPath)) {
        throw new Error('Extracted data not found. Run extract-all-data.js first.')
      }
      
      this.data = await fs.readJson(dataPath)
      logger.info('Extracted data loaded successfully')
      
    } catch (error) {
      logger.error('Failed to load extracted data:', error)
      throw error
    }
  }

  /**
   * Validate tournaments data for v2 migration
   */
  validateTournaments() {
    logger.info('Validating tournaments data...')
    
    const tournaments = this.data.tournaments || []
    const issues = []
    const warnings = []
    
    // Check required fields
    tournaments.forEach((tournament, index) => {
      if (!tournament.event_id) {
        issues.push(`Tournament ${index}: Missing event_id`)
      }
      if (!tournament.event_name || tournament.event_name.trim().length < config.validation.tournamentValidation.minTournamentNameLength) {
        issues.push(`Tournament ${index}: Invalid event_name`)
      }
      if (!tournament.start_date) {
        warnings.push(`Tournament ${tournament.event_id}: Missing start_date`)
      }
      if (!tournament.course) {
        warnings.push(`Tournament ${tournament.event_id}: Missing course name`)
      }
    })

    // Check for duplicates
    const eventIds = tournaments.map(t => t.event_id)
    const duplicateIds = eventIds.filter((id, index) => eventIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate event_ids found: ${duplicateIds.join(', ')}`)
    }

    // Check date validity
    tournaments.forEach(tournament => {
      if (tournament.start_date && tournament.end_date) {
        const startDate = new Date(tournament.start_date)
        const endDate = new Date(tournament.end_date)
        if (startDate > endDate) {
          issues.push(`Tournament ${tournament.event_id}: Start date after end date`)
        }
      }
    })

    const result = {
      total_count: tournaments.length,
      issues_count: issues.length,
      warnings_count: warnings.length,
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.tournaments = result
    return result
  }

  /**
   * Validate players data for v2 migration
   */
  validatePlayers() {
    logger.info('Validating players data...')
    
    const players = this.data.players || []
    const issues = []
    const warnings = []
    
    // Check required fields
    players.forEach((player, index) => {
      if (!player.dg_id) {
        issues.push(`Player ${index}: Missing dg_id`)
      }
      if (!player.name || player.name.trim().length < config.validation.playerValidation.minNameLength) {
        issues.push(`Player ${index}: Invalid name`)
      }
      if (player.name && player.name.length > config.validation.playerValidation.maxNameLength) {
        warnings.push(`Player ${player.dg_id}: Name very long (${player.name.length} chars)`)
      }
      if (!player.country) {
        warnings.push(`Player ${player.dg_id}: Missing country`)
      }
      if (player.country_code && player.country_code.length !== 2) {
        warnings.push(`Player ${player.dg_id}: Invalid country_code length`)
      }
    })

    // Check for duplicates
    const dgIds = players.map(p => p.dg_id).filter(id => id)
    const duplicateIds = dgIds.filter((id, index) => dgIds.indexOf(id) !== index)
    if (duplicateIds.length > 0) {
      issues.push(`Duplicate dg_ids found: ${duplicateIds.join(', ')}`)
    }

    // Check name consistency
    const nameMap = new Map()
    players.forEach(player => {
      if (player.dg_id && player.name) {
        if (nameMap.has(player.dg_id) && nameMap.get(player.dg_id) !== player.name) {
          warnings.push(`Player ${player.dg_id}: Inconsistent names: '${nameMap.get(player.dg_id)}' vs '${player.name}'`)
        }
        nameMap.set(player.dg_id, player.name)
      }
    })

    const result = {
      total_count: players.length,
      issues_count: issues.length,
      warnings_count: warnings.length,
      missing_country_count: players.filter(p => !p.country).length,
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.players = result
    return result
  }

  /**
   * Validate tournament results and score formats
   */
  validateTournamentResults() {
    logger.info('Validating tournament results...')
    
    const results = this.data.tournamentResults || []
    const issues = []
    const warnings = []
    const scoreFormatAnalysis = {
      actual: 0,
      relative: 0,
      unknown: 0,
      mixed: 0,
      low_confidence: 0
    }

    results.forEach((result, index) => {
      // Basic validation
      if (!result.dg_id) {
        issues.push(`Result ${index}: Missing dg_id`)
      }
      if (!result.event_id) {
        issues.push(`Result ${index}: Missing event_id`)
      }
      if (!result.player_name) {
        warnings.push(`Result ${index}: Missing player_name`)
      }

      // Score format analysis
      if (result.score_analysis) {
        scoreFormatAnalysis[result.score_analysis.format]++
        
        if (result.score_analysis.confidence < 0.5) {
          scoreFormatAnalysis.low_confidence++
          warnings.push(`Result ${index}: Low confidence in score format detection (${result.score_analysis.confidence})`)
        }

        if (result.score_analysis.issues && result.score_analysis.issues.length > 0) {
          warnings.push(`Result ${index}: Score issues: ${result.score_analysis.issues.join(', ')}`)
        }
      }

      // Round scores validation
      if (!result.round_scores || result.round_scores.length === 0) {
        warnings.push(`Result ${index}: No round scores available`)
      } else {
        const nonZeroScores = result.round_scores.filter(score => score !== 0 && score !== null)
        if (nonZeroScores.length === 0) {
          warnings.push(`Result ${index}: All round scores are zero or null`)
        }
      }
    })

    const result = {
      total_count: results.length,
      issues_count: issues.length,
      warnings_count: warnings.length,
      score_format_analysis: scoreFormatAnalysis,
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.tournament_results = result
    return result
  }

  /**
   * Validate live tournament stats
   */
  validateLiveStats() {
    logger.info('Validating live tournament stats...')
    
    const stats = this.data.liveStats || []
    const issues = []
    const warnings = []
    const eventCoverage = new Map()

    stats.forEach((stat, index) => {
      // Basic validation
      if (!stat.dg_id) {
        issues.push(`Live stat ${index}: Missing dg_id`)
      }
      if (!stat.event_name) {
        issues.push(`Live stat ${index}: Missing event_name`)
      }
      if (!stat.player_name) {
        warnings.push(`Live stat ${index}: Missing player_name`)
      }

      // Score validation
      if (stat.today === null && stat.total === null) {
        warnings.push(`Live stat ${index}: No score data available`)
      }

      // Track event coverage
      if (stat.event_name) {
        if (!eventCoverage.has(stat.event_name)) {
          eventCoverage.set(stat.event_name, new Set())
        }
        if (stat.dg_id) {
          eventCoverage.get(stat.event_name).add(stat.dg_id)
        }
      }

      // Strokes gained validation
      const sgFields = ['sg_app', 'sg_ott', 'sg_putt', 'sg_arg', 'sg_t2g', 'sg_total']
      sgFields.forEach(field => {
        const value = stat[field]
        if (value !== null && (value < -15 || value > 15)) {
          warnings.push(`Live stat ${index}: Extreme ${field} value: ${value}`)
        }
      })
    })

    // Event coverage analysis
    const coverageAnalysis = Array.from(eventCoverage.entries()).map(([eventName, players]) => ({
      event_name: eventName,
      player_count: players.size
    })).sort((a, b) => b.player_count - a.player_count)

    const result = {
      total_count: stats.length,
      issues_count: issues.length,
      warnings_count: warnings.length,
      unique_events: eventCoverage.size,
      event_coverage: coverageAnalysis.slice(0, 10), // Top 10 events by coverage
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.live_stats = result
    return result
  }

  /**
   * Validate season stats
   */
  validateSeasonStats() {
    logger.info('Validating season stats...')
    
    const stats = this.data.seasonStats || []
    const issues = []
    const warnings = []

    stats.forEach((stat, index) => {
      // Basic validation
      if (!stat.dg_id) {
        issues.push(`Season stat ${index}: Missing dg_id`)
      }
      if (!stat.player_name) {
        warnings.push(`Season stat ${index}: Missing player_name`)
      }

      // Strokes gained validation with reasonable ranges
      const sgFields = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_total']
      sgFields.forEach(field => {
        const value = stat[field]
        if (value !== null && (value < -5 || value > 5)) {
          warnings.push(`Season stat ${index}: Extreme ${field} value: ${value}`)
        }
      })

      // Percentage stats validation
      const percentageFields = ['driving_accuracy', 'gir']
      percentageFields.forEach(field => {
        const value = stat[field]
        if (value !== null && (value < 0 || value > 100)) {
          warnings.push(`Season stat ${index}: Invalid ${field} percentage: ${value}`)
        }
      })

      // Distance validation
      if (stat.driving_distance !== null && (stat.driving_distance < 200 || stat.driving_distance > 400)) {
        warnings.push(`Season stat ${index}: Unusual driving distance: ${stat.driving_distance}`)
      }
    })

    const result = {
      total_count: stats.length,
      issues_count: issues.length,
      warnings_count: warnings.length,
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.season_stats = result
    return result
  }

  /**
   * Cross-reference validation between tables
   */
  validateCrossReferences() {
    logger.info('Validating cross-references...')
    
    const issues = []
    const warnings = []

    // Get all unique IDs
    const tournamentIds = new Set((this.data.tournaments || []).map(t => t.event_id))
    const playerIds = new Set((this.data.players || []).map(p => p.dg_id))
    const resultTournamentIds = new Set((this.data.tournamentResults || []).map(r => r.event_id))
    const resultPlayerIds = new Set((this.data.tournamentResults || []).map(r => r.dg_id))

    // Check tournament references
    resultTournamentIds.forEach(eventId => {
      if (!tournamentIds.has(eventId)) {
        issues.push(`Tournament result references non-existent tournament: ${eventId}`)
      }
    })

    // Check player references
    resultPlayerIds.forEach(dgId => {
      if (!playerIds.has(dgId)) {
        warnings.push(`Tournament result references unknown player: ${dgId}`)
      }
    })

    // Check live stats references
    const liveStatsPlayerIds = new Set((this.data.liveStats || []).map(s => s.dg_id).filter(id => id))
    liveStatsPlayerIds.forEach(dgId => {
      if (!playerIds.has(dgId)) {
        warnings.push(`Live stats references unknown player: ${dgId}`)
      }
    })

    const result = {
      total_tournaments: tournamentIds.size,
      total_players: playerIds.size,
      referenced_tournaments: resultTournamentIds.size,
      referenced_players: resultPlayerIds.size,
      issues_count: issues.length,
      warnings_count: warnings.length,
      issues,
      warnings,
      status: issues.length === 0 ? 'valid' : 'invalid'
    }

    this.validationResults.detailed_issues.cross_references = result
    return result
  }

  /**
   * Determine migration readiness
   */
  assessMigrationReadiness() {
    logger.info('Assessing migration readiness...')
    
    const blockers = []
    const warnings = []
    
    // Check each validation category
    Object.entries(this.validationResults.detailed_issues).forEach(([category, result]) => {
      if (result.status === 'invalid') {
        blockers.push(`${category}: ${result.issues_count} critical issues`)
      }
      if (result.warnings_count > 0) {
        warnings.push(`${category}: ${result.warnings_count} warnings`)
      }
    })

    // Special checks for migration readiness
    const tournaments = this.validationResults.detailed_issues.tournaments
    const players = this.validationResults.detailed_issues.players
    const results = this.validationResults.detailed_issues.tournament_results

    if (tournaments && tournaments.total_count === 0) {
      blockers.push('No tournaments data available')
    }
    
    if (players && players.total_count === 0) {
      blockers.push('No players data available')
    }

    // Check score format distribution
    if (results && results.score_format_analysis) {
      const { unknown, mixed } = results.score_format_analysis
      if (unknown + mixed > results.total_count * 0.1) {
        warnings.push(`High percentage of unclear score formats: ${unknown + mixed}/${results.total_count}`)
      }
    }

    const ready = blockers.length === 0

    this.validationResults.migration_readiness = {
      ready,
      blockers,
      warnings,
      confidence: ready ? (warnings.length === 0 ? 'high' : 'medium') : 'low'
    }

    // Generate recommendations
    this.generateRecommendations()

    return this.validationResults.migration_readiness
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations() {
    const recommendations = []

    // Based on validation results
    if (this.validationResults.detailed_issues.players?.missing_country_count > 0) {
      recommendations.push('Consider enriching player data with country information before migration')
    }

    if (this.validationResults.detailed_issues.tournament_results?.score_format_analysis?.unknown > 0) {
      recommendations.push('Review and manually classify tournaments with unknown score formats')
    }

    if (this.validationResults.detailed_issues.cross_references?.warnings_count > 0) {
      recommendations.push('Resolve player ID mismatches between tables')
    }

    // Migration strategy recommendations
    if (this.validationResults.migration_readiness.ready) {
      recommendations.push('Data quality is sufficient for migration - proceed with phased approach')
      recommendations.push('Start with tournaments and players tables, then migrate results')
      recommendations.push('Run additional validation after each migration phase')
    } else {
      recommendations.push('Resolve blocking issues before attempting migration')
      recommendations.push('Consider data cleaning procedures for problematic records')
    }

    this.validationResults.recommendations = recommendations
  }

  /**
   * Generate validation summary
   */
  generateSummary() {
    const summary = {
      total_issues: 0,
      total_warnings: 0,
      categories_validated: 0,
      categories_valid: 0
    }

    Object.values(this.validationResults.detailed_issues).forEach(result => {
      summary.total_issues += result.issues_count || 0
      summary.total_warnings += result.warnings_count || 0
      summary.categories_validated++
      if (result.status === 'valid') {
        summary.categories_valid++
      }
    })

    summary.overall_health = summary.total_issues === 0 ? 'healthy' : 'issues_detected'
    
    this.validationResults.validation_summary = summary
    this.validationResults.overall_status = summary.overall_health

    return summary
  }

  /**
   * Save validation results
   */
  async saveResults() {
    const outputPath = path.join(config.migration.outputDir, 'validation-results.json')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    try {
      // Save main results file
      await fs.writeJson(outputPath, this.validationResults, { spaces: 2 })
      
      // Save timestamped backup
      const backupPath = path.join(
        config.migration.backupDir,
        `validation-results-${timestamp}.json`
      )
      await fs.writeJson(backupPath, this.validationResults, { spaces: 2 })

      logger.info(`Validation results saved to ${outputPath}`)
      
    } catch (error) {
      logger.error('Failed to save validation results:', error)
      throw error
    }
  }

  /**
   * Run complete validation
   */
  async validate() {
    logger.info('Starting data validation...')
    
    try {
      await this.loadExtractedData()
      
      this.validateTournaments()
      this.validatePlayers()
      this.validateTournamentResults()
      this.validateLiveStats()
      this.validateSeasonStats()
      this.validateCrossReferences()
      
      this.assessMigrationReadiness()
      this.generateSummary()
      
      await this.saveResults()
      
      logger.info('Data validation completed successfully!')
      return this.validationResults
      
    } catch (error) {
      logger.error('Data validation failed:', error)
      throw error
    }
  }
}

// Run validation if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const validator = new DataValidator()
  validator.validate()
    .then(results => {
      console.log('\n=== VALIDATION COMPLETE ===')
      console.log('Overall Status:', results.overall_status)
      console.log('Migration Ready:', results.migration_readiness.ready)
      console.log('Summary:', results.validation_summary)
      
      if (!results.migration_readiness.ready) {
        console.log('\nBlockers:')
        results.migration_readiness.blockers.forEach(blocker => console.log(`  - ${blocker}`))
      }
      
      if (results.migration_readiness.warnings.length > 0) {
        console.log('\nWarnings:')
        results.migration_readiness.warnings.forEach(warning => console.log(`  - ${warning}`))
      }
      
      console.log('\nRecommendations:')
      results.recommendations.forEach(rec => console.log(`  - ${rec}`))
      
      process.exit(results.migration_readiness.ready ? 0 : 1)
    })
    .catch(error => {
      console.error('Validation failed:', error)
      process.exit(1)
    })
}

export default DataValidator
#!/usr/bin/env node

/**
 * Full Data Analysis Coordinator
 * 
 * This script runs the complete data extraction and validation pipeline
 */

import { logger } from './config.js'
import DataExtractor from './extract-all-data.js'
import DataValidator from './validate-data.js'
import ScoreFormatAnalyzer from './analyze-score-formats.js'
import fs from 'fs-extra'
import path from 'path'

class FullAnalysisCoordinator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      pipeline_status: 'starting',
      phases_completed: [],
      final_summary: null
    }
  }

  /**
   * Run the complete analysis pipeline
   */
  async runFullAnalysis() {
    logger.info('Starting full data analysis pipeline...')
    
    try {
      // Phase 1: Data Extraction
      logger.info('=== PHASE 1: DATA EXTRACTION ===')
      const extractor = new DataExtractor()
      const extractionResults = await extractor.extractAll()
      this.results.phases_completed.push({
        phase: 'extraction',
        status: 'completed',
        results: extractionResults
      })
      logger.info('✓ Data extraction completed successfully')

      // Phase 2: Score Format Analysis
      logger.info('=== PHASE 2: SCORE FORMAT ANALYSIS ===')
      const analyzer = new ScoreFormatAnalyzer()
      const analysisResults = await analyzer.analyzeAllTournaments()
      this.results.phases_completed.push({
        phase: 'score_analysis',
        status: 'completed',
        results: {
          tournaments_analyzed: analysisResults.tournaments_analyzed.length,
          format_summary: analysisResults.score_format_summary,
          recommendations: analysisResults.recommendations
        }
      })
      logger.info('✓ Score format analysis completed successfully')

      // Phase 3: Data Validation
      logger.info('=== PHASE 3: DATA VALIDATION ===')
      const validator = new DataValidator()
      const validationResults = await validator.validate()
      this.results.phases_completed.push({
        phase: 'validation',
        status: 'completed',
        results: {
          overall_status: validationResults.overall_status,
          migration_ready: validationResults.migration_readiness.ready,
          validation_summary: validationResults.validation_summary,
          recommendations: validationResults.recommendations
        }
      })
      logger.info('✓ Data validation completed successfully')

      // Generate final summary
      this.generateFinalSummary()
      await this.saveFinalResults()

      this.results.pipeline_status = 'completed'
      logger.info('✓ Full analysis pipeline completed successfully!')

      return this.results

    } catch (error) {
      this.results.pipeline_status = 'failed'
      logger.error('Full analysis pipeline failed:', error)
      throw error
    }
  }

  /**
   * Generate comprehensive final summary
   */
  generateFinalSummary() {
    const extraction = this.results.phases_completed.find(p => p.phase === 'extraction')?.results
    const scoreAnalysis = this.results.phases_completed.find(p => p.phase === 'score_analysis')?.results
    const validation = this.results.phases_completed.find(p => p.phase === 'validation')?.results

    this.results.final_summary = {
      data_overview: {
        total_tournaments: extraction?.total_records?.tournaments || 0,
        total_players: extraction?.total_records?.players || 0,
        total_tournament_results: extraction?.total_records?.tournament_results || 0,
        total_live_stats: extraction?.total_records?.live_stats || 0,
        total_season_stats: extraction?.total_records?.season_stats || 0
      },
      
      score_format_findings: {
        tournaments_analyzed: scoreAnalysis?.tournaments_analyzed || 0,
        format_distribution: scoreAnalysis?.format_summary?.format_distribution || {},
        primary_format: this.determinePrimaryFormat(scoreAnalysis?.format_summary?.format_distribution),
        confidence_assessment: this.assessOverallConfidence(scoreAnalysis)
      },
      
      data_quality_assessment: {
        overall_status: validation?.overall_status || 'unknown',
        migration_readiness: validation?.migration_ready || false,
        critical_issues: validation?.validation_summary?.total_issues || 0,
        warnings: validation?.validation_summary?.total_warnings || 0,
        data_completeness: this.assessDataCompleteness(extraction, validation)
      },
      
      migration_recommendations: this.compileMigrationRecommendations(scoreAnalysis, validation),
      
      next_steps: this.generateNextSteps(validation?.migration_ready, scoreAnalysis, validation)
    }
  }

  /**
   * Determine the primary score format across all tournaments
   */
  determinePrimaryFormat(formatDistribution) {
    if (!formatDistribution) return 'unknown'
    
    const formats = Object.entries(formatDistribution)
    if (formats.length === 0) return 'unknown'
    
    // Find the format with the highest count
    const primaryFormat = formats.reduce((prev, current) => 
      current[1] > prev[1] ? current : prev
    )
    
    return {
      format: primaryFormat[0],
      count: primaryFormat[1],
      percentage: formatDistribution.total ? 
        Math.round((primaryFormat[1] / formatDistribution.total) * 100) : 0
    }
  }

  /**
   * Assess overall confidence in score format detection
   */
  assessOverallConfidence(scoreAnalysis) {
    if (!scoreAnalysis?.format_summary?.confidence_distribution) {
      return 'unknown'
    }
    
    const { high, medium, low } = scoreAnalysis.format_summary.confidence_distribution
    const total = high + medium + low
    
    if (total === 0) return 'unknown'
    
    const highPercent = (high / total) * 100
    const mediumPercent = (medium / total) * 100
    
    if (highPercent >= 70) return 'high'
    if (highPercent + mediumPercent >= 70) return 'medium'
    return 'low'
  }

  /**
   * Assess data completeness
   */
  assessDataCompleteness(extraction, validation) {
    const completeness = {
      tournaments: 'good', // Most tournaments have complete data
      players: 'partial',  // Missing country data
      scores: 'variable',  // Depends on tournament and score format
      overall: 'partial'
    }

    // Assess based on validation results
    if (validation?.validation_summary) {
      const { total_issues, total_warnings } = validation.validation_summary
      if (total_issues === 0 && total_warnings < 10) {
        completeness.overall = 'good'
      } else if (total_issues === 0) {
        completeness.overall = 'acceptable'
      } else {
        completeness.overall = 'poor'
      }
    }

    return completeness
  }

  /**
   * Compile migration recommendations from all phases
   */
  compileMigrationRecommendations(scoreAnalysis, validation) {
    const recommendations = []

    // Score format recommendations
    if (scoreAnalysis?.recommendations) {
      recommendations.push(...scoreAnalysis.recommendations.map(rec => ({
        category: 'score_format',
        recommendation: rec,
        priority: 'high'
      })))
    }

    // Validation recommendations
    if (validation?.recommendations) {
      recommendations.push(...validation.recommendations.map(rec => ({
        category: 'data_quality',
        recommendation: rec,
        priority: rec.includes('blocking') ? 'critical' : 'medium'
      })))
    }

    // Additional strategic recommendations
    recommendations.push({
      category: 'strategy',
      recommendation: 'Implement phased migration approach: tournaments → players → results → advanced stats',
      priority: 'high'
    })

    recommendations.push({
      category: 'testing',
      recommendation: 'Create comprehensive test dataset for migration validation',
      priority: 'high'
    })

    recommendations.push({
      category: 'monitoring',
      recommendation: 'Set up data quality monitoring during migration process',
      priority: 'medium'
    })

    return recommendations
  }

  /**
   * Generate next steps based on analysis results
   */
  generateNextSteps(migrationReady, scoreAnalysis, validation) {
    const steps = []

    if (migrationReady) {
      steps.push({
        step: 1,
        action: 'Create migration data transformation scripts',
        description: 'Build scripts to transform extracted data to v2 schema format',
        estimated_effort: '2-3 days'
      })
      
      steps.push({
        step: 2,
        action: 'Implement score format conversion logic',
        description: 'Handle conversion from relative to actual scores where needed',
        estimated_effort: '1-2 days'
      })
      
      steps.push({
        step: 3,
        action: 'Execute phased migration',
        description: 'Migrate data in phases: tournaments → players → results → stats',
        estimated_effort: '1 day per phase'
      })
      
      steps.push({
        step: 4,
        action: 'Validate migrated data',
        description: 'Run comprehensive validation on v2 schema data',
        estimated_effort: '1 day'
      })
      
    } else {
      steps.push({
        step: 1,
        action: 'Resolve blocking data quality issues',
        description: 'Address critical issues identified in validation',
        estimated_effort: '2-5 days'
      })
      
      steps.push({
        step: 2,
        action: 'Re-run validation pipeline',
        description: 'Validate that issues have been resolved',
        estimated_effort: '0.5 days'
      })
      
      steps.push({
        step: 3,
        action: 'Proceed with migration once validation passes',
        description: 'Continue with migration process after validation success',
        estimated_effort: 'TBD'
      })
    }

    return steps
  }

  /**
   * Save final results
   */
  async saveFinalResults() {
    const outputPath = path.join('./migration-output', 'full-analysis-results.json')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    try {
      await fs.ensureDir('./migration-output')
      await fs.ensureDir('./migration-backup')
      
      await fs.writeJson(outputPath, this.results, { spaces: 2 })
      
      const backupPath = path.join('./migration-backup', `full-analysis-${timestamp}.json`)
      await fs.writeJson(backupPath, this.results, { spaces: 2 })

      // Create a summary report
      const summaryPath = path.join('./migration-output', 'migration-readiness-report.md')
      await this.createSummaryReport(summaryPath)

      logger.info(`Full analysis results saved to ${outputPath}`)
      logger.info(`Summary report created at ${summaryPath}`)
      
    } catch (error) {
      logger.error('Failed to save final results:', error)
      throw error
    }
  }

  /**
   * Create a human-readable summary report
   */
  async createSummaryReport(filePath) {
    const summary = this.results.final_summary
    const timestamp = new Date().toLocaleString()

    const report = `# Golf Parlay Picker - Migration Readiness Report

Generated: ${timestamp}

## Executive Summary

**Migration Status**: ${summary.data_quality_assessment.migration_readiness ? '✅ READY' : '❌ NOT READY'}
**Overall Data Quality**: ${summary.data_quality_assessment.overall_status.toUpperCase()}
**Primary Score Format**: ${summary.score_format_findings.primary_format?.format || 'unknown'} (${summary.score_format_findings.primary_format?.percentage || 0}%)

## Data Overview

- **Tournaments**: ${summary.data_overview.total_tournaments}
- **Players**: ${summary.data_overview.total_players}
- **Tournament Results**: ${summary.data_overview.total_tournament_results}
- **Live Stats Records**: ${summary.data_overview.total_live_stats}
- **Season Stats Records**: ${summary.data_overview.total_season_stats}

## Score Format Analysis

**Tournaments Analyzed**: ${summary.score_format_findings.tournaments_analyzed}

**Format Distribution**:
${Object.entries(summary.score_format_findings.format_distribution || {})
  .map(([format, count]) => `- ${format}: ${count}`)
  .join('\n')}

**Confidence Level**: ${summary.score_format_findings.confidence_assessment}

## Data Quality Assessment

- **Critical Issues**: ${summary.data_quality_assessment.critical_issues}
- **Warnings**: ${summary.data_quality_assessment.warnings}
- **Data Completeness**: ${summary.data_quality_assessment.data_completeness.overall}

## Migration Recommendations

${summary.migration_recommendations
  .map((rec, index) => `${index + 1}. **[${rec.priority.toUpperCase()}]** ${rec.recommendation}`)
  .join('\n')}

## Next Steps

${summary.next_steps
  .map(step => `### Step ${step.step}: ${step.action}
${step.description}
**Estimated Effort**: ${step.estimated_effort}`)
  .join('\n\n')}

## Conclusion

${summary.data_quality_assessment.migration_readiness 
  ? 'The data is ready for migration to the v2 schema. Proceed with the recommended phased approach.'
  : 'Data quality issues must be resolved before migration can proceed. Address the critical issues listed above and re-run the validation pipeline.'
}

---
*Report generated by Golf Parlay Picker Migration Analysis Pipeline*
`

    await fs.writeFile(filePath, report)
  }
}

// Run full analysis if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const coordinator = new FullAnalysisCoordinator()
  coordinator.runFullAnalysis()
    .then(results => {
      console.log('\n=== FULL ANALYSIS PIPELINE COMPLETE ===')
      console.log('Pipeline Status:', results.pipeline_status)
      console.log('Phases Completed:', results.phases_completed.length)
      
      if (results.final_summary) {
        console.log('\n=== FINAL SUMMARY ===')
        console.log('Migration Ready:', results.final_summary.data_quality_assessment.migration_readiness)
        console.log('Data Quality:', results.final_summary.data_quality_assessment.overall_status)
        console.log('Primary Score Format:', results.final_summary.score_format_findings.primary_format?.format)
        
        console.log('\n=== NEXT STEPS ===')
        results.final_summary.next_steps.forEach(step => {
          console.log(`${step.step}. ${step.action} (${step.estimated_effort})`)
        })
      }
      
      console.log('\nDetailed results saved to migration-output/full-analysis-results.json')
      console.log('Summary report created at migration-output/migration-readiness-report.md')
      
      process.exit(0)
    })
    .catch(error => {
      console.error('Full analysis pipeline failed:', error)
      process.exit(1)
    })
}

export default FullAnalysisCoordinator
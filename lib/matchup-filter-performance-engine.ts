import { MatchupRow } from '@/types/matchups';
import { PlayerStat } from '@/hooks/use-player-stats-query';
import { LiveTournamentStat } from '@/types/definitions';
import { MatchupComparisonEngine, MatchupComparison } from '@/lib/matchup-comparison-engine';
import { 
  FilterPreset, 
  FILTER_PRESETS,
  MatchupRelativeFilters 
} from '@/types/matchup-filters';

// Types for performance tracking
export interface MatchupResult {
  matchupId: number;
  eventId: number;
  roundNum: number;
  winnerDgId: number;
  winnerName: string;
  player1Score?: number | null;
  player2Score?: number | null;
  player3Score?: number | null;
  resultDeterminedAt: Date;
}

export interface FilterAnalysisResult {
  matchupId: number;
  flaggedByFilter: boolean;
  predictedWinnerDgId?: number; // Who the filter thought would win
  predictedWinnerName?: string;
  confidence: number; // 0-1 confidence score
  reason: string; // Why this matchup was flagged
  actualWinnerDgId?: number; // Set after result is known
  wasCorrect?: boolean; // Set after result is known
  potentialPayout?: number; // Based on odds if bet was placed
  actualPayout?: number; // Actual payout if bet won
}

export interface FilterPerformanceSnapshot {
  eventId: number;
  eventName: string;
  roundNum: number;
  filterPreset: FilterPreset;
  filterConfig: MatchupRelativeFilters;
  
  // Raw counts
  totalMatchupsAnalyzed: number;
  matchupsFlaggedByFilter: number;
  flaggedMatchupsWon: number;
  flaggedMatchupsLost: number;
  
  // Performance metrics
  winRate: number; // Percentage of flagged matchups that won
  expectedWinRate: number; // Based on odds
  edgeDetected: number; // winRate - expectedWinRate
  
  // Value metrics
  totalPotentialPayout: number; // If $1 bet on each flagged matchup
  actualPayout: number; // Actual winnings
  roiPercentage: number; // Return on investment
  
  // Confidence
  sampleSizeConfidence: 'low' | 'medium' | 'high';
  statisticalSignificance: number; // p-value
  
  // Breakdown by matchup type
  performance2Ball: {
    flagged: number;
    won: number;
    winRate: number;
  };
  performance3Ball: {
    flagged: number;
    won: number;
    winRate: number;
  };
  
  analysisTimestamp: Date;
}

export class MatchupFilterPerformanceEngine {
  private comparisonEngine: MatchupComparisonEngine;
  private analysisCache: Map<string, FilterAnalysisResult[]> = new Map();

  constructor(
    playerStats?: PlayerStat[],
    tournamentStats?: LiveTournamentStat[]
  ) {
    this.comparisonEngine = new MatchupComparisonEngine(playerStats, tournamentStats);
  }

  /**
   * Analyze all matchups against a specific filter preset
   */
  analyzeMatchupsWithFilter(
    matchups: MatchupRow[],
    filterPreset: FilterPreset,
    eventId: number,
    roundNum: number
  ): FilterAnalysisResult[] {
    const cacheKey = `${eventId}-${roundNum}-${filterPreset}`;
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    const filterConfig = FILTER_PRESETS[filterPreset];
    const results: FilterAnalysisResult[] = [];

    matchups.forEach(matchup => {
      const comparison = this.comparisonEngine.analyzeMatchup(matchup);
      const analysis = this.analyzeMatchupWithFilter(comparison, filterConfig, filterPreset);
      results.push(analysis);
    });

    this.analysisCache.set(cacheKey, results);
    return results;
  }

  /**
   * Analyze a single matchup against filter criteria
   */
  private analyzeMatchupWithFilter(
    comparison: MatchupComparison,
    filterConfig: MatchupRelativeFilters,
    filterPreset: FilterPreset
  ): FilterAnalysisResult {
    let flaggedByFilter = false;
    let predictedWinnerDgId: number | undefined;
    let predictedWinnerName: string | undefined;
    let confidence = 0;
    let reason = '';

    // Apply filter logic to determine if this matchup should be flagged
    const filterChecks = this.evaluateFilterCriteria(comparison, filterConfig);
    
    if (filterChecks.passes) {
      flaggedByFilter = true;
      predictedWinnerDgId = filterChecks.recommendedPlayerDgId;
      predictedWinnerName = filterChecks.recommendedPlayerName;
      confidence = filterChecks.confidence;
      reason = filterChecks.reason;
    }

    return {
      matchupId: comparison.matchupId,
      flaggedByFilter,
      predictedWinnerDgId,
      predictedWinnerName,
      confidence,
      reason
    };
  }

  /**
   * Evaluate filter criteria against matchup comparison
   */
  private evaluateFilterCriteria(
    comparison: MatchupComparison,
    filterConfig: MatchupRelativeFilters
  ): {
    passes: boolean;
    recommendedPlayerDgId?: number;
    recommendedPlayerName?: string;
    confidence: number;
    reason: string;
  } {
    const checks: boolean[] = [];
    let recommendedPlayer: { dgId: number; name: string } | null = null;
    let confidence = 0;
    let reasons: string[] = [];

    // Fade Chalk logic
    if (filterConfig.showOddsSgMismatch && comparison.analysis.hasOddsSgMismatch) {
      checks.push(true);
      const sgLeaderPlayer = comparison.players.find(p => p.name === comparison.analysis.sgLeader);
      if (sgLeaderPlayer) {
        recommendedPlayer = { dgId: sgLeaderPlayer.dgId, name: sgLeaderPlayer.name };
        confidence += 0.3;
        reasons.push('Better SG than betting favorite');
      }
    }

    if (filterConfig.showPositionMismatch && comparison.analysis.hasPositionMismatch) {
      checks.push(true);
      confidence += 0.2;
      reasons.push('Better leaderboard position but not betting favorite');
    }

    // Stat Dominance logic
    if (filterConfig.sgCategoryDominance && comparison.analysis.sgCategoryDominance) {
      const threshold = filterConfig.sgCategoryDominance;
      if (comparison.analysis.sgCategoryDominance.categories >= threshold) {
        checks.push(true);
        const dominantPlayer = comparison.players.find(p => p.name === comparison.analysis.sgCategoryDominance?.player);
        if (dominantPlayer) {
          recommendedPlayer = { dgId: dominantPlayer.dgId, name: dominantPlayer.name };
          confidence += 0.4;
          reasons.push(`Dominates ${comparison.analysis.sgCategoryDominance.categories} SG categories`);
        }
      }
    }

    if (filterConfig.sgTotalGapMin && comparison.analysis.sgGapSize >= filterConfig.sgTotalGapMin) {
      checks.push(true);
      confidence += 0.3;
      reasons.push(`${comparison.analysis.sgGapSize.toFixed(2)} SG advantage`);
    }

    // Value hunting logic
    if (filterConfig.minOddsGap && comparison.analysis.hasOddsGap && comparison.analysis.oddsGapSize >= filterConfig.minOddsGap) {
      checks.push(true);
      // Find the underdog with competitive SG
      const competitiveUnderdog = this.findValueUnderdog(comparison);
      if (competitiveUnderdog) {
        recommendedPlayer = { dgId: competitiveUnderdog.dgId, name: competitiveUnderdog.name };
        confidence += 0.25;
        reasons.push(`Value underdog with competitive stats`);
      }
    }

    if (filterConfig.showDgFdDisagreement) {
      const disagreement = this.checkDgFdDisagreement(comparison);
      if (disagreement.hasDisagreement) {
        checks.push(true);
        if (disagreement.dgFavorite) {
          recommendedPlayer = { dgId: disagreement.dgFavorite.dgId, name: disagreement.dgFavorite.name };
          confidence += 0.3;
          reasons.push('DataGolf favorite differs from betting favorite');
        }
      }
    }

    // Data Intelligence logic
    if (filterConfig.showDataSourceDisagreement && comparison.analysis.hasDataSourceDisagreement) {
      checks.push(true);
      const dgAdvantagePlayer = comparison.players.find(p => p.name === comparison.analysis.dgAdvantagePlayer);
      if (dgAdvantagePlayer) {
        recommendedPlayer = { dgId: dgAdvantagePlayer.dgId, name: dgAdvantagePlayer.name };
        confidence += 0.35;
        reasons.push(`DataGolf rates significantly higher than PGA Tour data`);
      }
    }

    if (filterConfig.dgAdvantageMin && comparison.analysis.dgAdvantageSize >= filterConfig.dgAdvantageMin) {
      checks.push(true);
      confidence += 0.2;
      reasons.push(`${comparison.analysis.dgAdvantageSize.toFixed(2)} DataGolf advantage`);
    }

    // Form Play logic
    if (filterConfig.scoreGapToday !== undefined) {
      const scoreGap = this.calculateTodayScoreGap(comparison);
      if (scoreGap >= filterConfig.scoreGapToday) {
        checks.push(true);
        const formLeader = this.findTodayFormLeader(comparison);
        if (formLeader) {
          recommendedPlayer = { dgId: formLeader.dgId, name: formLeader.name };
          confidence += 0.2;
          reasons.push(`Strong current round form`);
        }
      }
    }

    // Determine if filter passes (AND vs OR logic)
    const passes = filterConfig.requireAll ? checks.every(c => c) : checks.some(c => c);
    
    // Normalize confidence to 0-1 range
    confidence = Math.min(1, confidence);

    return {
      passes,
      recommendedPlayerDgId: recommendedPlayer?.dgId,
      recommendedPlayerName: recommendedPlayer?.name,
      confidence,
      reason: reasons.join(', ')
    };
  }

  /**
   * Calculate performance metrics after results are known
   */
  calculateFilterPerformance(
    analyses: FilterAnalysisResult[],
    results: MatchupResult[],
    eventId: number,
    eventName: string,
    roundNum: number,
    filterPreset: FilterPreset
  ): FilterPerformanceSnapshot {
    // Match analyses with results
    const matchedAnalyses = analyses.map(analysis => {
      const result = results.find(r => r.matchupId === analysis.matchupId);
      if (result) {
        analysis.actualWinnerDgId = result.winnerDgId;
        analysis.wasCorrect = analysis.predictedWinnerDgId === result.winnerDgId;
        
        // Calculate payouts (simplified - assuming $1 bet)
        if (analysis.flaggedByFilter && analysis.predictedWinnerDgId) {
          analysis.potentialPayout = 1; // Would need actual odds calculation
          analysis.actualPayout = analysis.wasCorrect ? 1.8 : 0; // Simplified odds
        }
      }
      return analysis;
    });

    // Calculate metrics
    const flaggedMatchups = matchedAnalyses.filter(a => a.flaggedByFilter);
    const flaggedWithResults = flaggedMatchups.filter(a => a.actualWinnerDgId !== undefined);
    const correctPredictions = flaggedWithResults.filter(a => a.wasCorrect);

    const totalMatchupsAnalyzed = analyses.length;
    const matchupsFlaggedByFilter = flaggedMatchups.length;
    const flaggedMatchupsWon = correctPredictions.length;
    const flaggedMatchupsLost = flaggedWithResults.length - correctPredictions.length;

    const winRate = flaggedWithResults.length > 0 ? correctPredictions.length / flaggedWithResults.length : 0;
    const expectedWinRate = 0.5; // Simplified - would need actual odds-based calculation
    const edgeDetected = winRate - expectedWinRate;

    // Calculate payout metrics
    const totalPotentialPayout = flaggedMatchups.reduce((sum, a) => sum + (a.potentialPayout || 0), 0);
    const actualPayout = flaggedMatchups.reduce((sum, a) => sum + (a.actualPayout || 0), 0);
    const roiPercentage = totalPotentialPayout > 0 ? ((actualPayout - totalPotentialPayout) / totalPotentialPayout) * 100 : 0;

    // Calculate confidence metrics
    const sampleSizeConfidence: 'low' | 'medium' | 'high' = 
      matchupsFlaggedByFilter < 10 ? 'low' :
      matchupsFlaggedByFilter < 30 ? 'medium' : 'high';

    const statisticalSignificance = this.calculateStatisticalSignificance(
      flaggedMatchupsWon,
      flaggedWithResults.length,
      expectedWinRate
    );

    // Breakdown by matchup type (simplified)
    const performance2Ball = {
      flagged: 0,
      won: 0,
      winRate: 0
    };
    const performance3Ball = {
      flagged: matchupsFlaggedByFilter,
      won: flaggedMatchupsWon,
      winRate: winRate
    };

    return {
      eventId,
      eventName,
      roundNum,
      filterPreset,
      filterConfig: FILTER_PRESETS[filterPreset],
      totalMatchupsAnalyzed,
      matchupsFlaggedByFilter,
      flaggedMatchupsWon,
      flaggedMatchupsLost,
      winRate,
      expectedWinRate,
      edgeDetected,
      totalPotentialPayout,
      actualPayout,
      roiPercentage,
      sampleSizeConfidence,
      statisticalSignificance,
      performance2Ball,
      performance3Ball,
      analysisTimestamp: new Date()
    };
  }

  /**
   * Helper methods
   */
  private findValueUnderdog(comparison: MatchupComparison): { dgId: number; name: string } | null {
    const playersWithOdds = comparison.players.filter(p => p.odds !== null);
    if (playersWithOdds.length < 2) return null;

    const sortedByOdds = [...playersWithOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
    const favorite = sortedByOdds[0];
    const underdogs = sortedByOdds.slice(1);

    // Find underdog with competitive SG
    return underdogs.find(dog => {
      const favSg = favorite.dgSgTotal ?? favorite.sgTotal ?? 0;
      const dogSg = dog.dgSgTotal ?? dog.sgTotal ?? 0;
      return (favSg - dogSg) <= 0.3; // Within 0.3 SG
    }) || null;
  }

  private checkDgFdDisagreement(comparison: MatchupComparison): {
    hasDisagreement: boolean;
    dgFavorite?: { dgId: number; name: string };
  } {
    const playersWithBothOdds = comparison.players.filter(p => p.odds !== null && p.dgOdds !== null);
    if (playersWithBothOdds.length < 2) return { hasDisagreement: false };

    const fdRanking = [...playersWithBothOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
    const dgRanking = [...playersWithBothOdds].sort((a, b) => (a.dgOdds ?? 0) - (b.dgOdds ?? 0));

    const hasDisagreement = fdRanking[0]?.dgId !== dgRanking[0]?.dgId;
    
    return {
      hasDisagreement,
      dgFavorite: hasDisagreement ? dgRanking[0] : undefined
    };
  }

  private calculateTodayScoreGap(comparison: MatchupComparison): number {
    const scores = comparison.players.map(p => p.todayScore).filter(s => s !== null) as number[];
    if (scores.length < 2) return 0;
    return Math.max(...scores) - Math.min(...scores);
  }

  private findTodayFormLeader(comparison: MatchupComparison): { dgId: number; name: string } | null {
    const playersWithScore = comparison.players.filter(p => p.todayScore !== null);
    if (playersWithScore.length === 0) return null;

    return [...playersWithScore].sort((a, b) => (a.todayScore ?? 0) - (b.todayScore ?? 0))[0];
  }

  private calculateStatisticalSignificance(wins: number, total: number, expectedRate: number): number {
    if (total < 10) return 1.0; // Not enough sample size

    const observedRate = wins / total;
    const zScore = (observedRate - expectedRate) / Math.sqrt(expectedRate * (1 - expectedRate) / total);
    
    // Convert z-score to p-value (simplified)
    if (Math.abs(zScore) < 1.96) return 0.5; // Not significant
    if (Math.abs(zScore) < 2.58) return 0.05; // 5% significance
    if (Math.abs(zScore) < 3.29) return 0.01; // 1% significance
    return 0.001; // Highly significant
  }

  /**
   * Analyze all filters against a set of matchups
   */
  analyzeAllFilters(
    matchups: MatchupRow[],
    eventId: number,
    roundNum: number
  ): Map<FilterPreset, FilterAnalysisResult[]> {
    const results = new Map<FilterPreset, FilterAnalysisResult[]>();
    
    const filterPresets: FilterPreset[] = ['fade-chalk', 'stat-dom', 'form-play', 'value', 'data-intel'];
    
    filterPresets.forEach(preset => {
      const analysis = this.analyzeMatchupsWithFilter(matchups, preset, eventId, roundNum);
      results.set(preset, analysis);
    });

    return results;
  }

  /**
   * Clear analysis cache (call when data changes)
   */
  clearCache(): void {
    this.analysisCache.clear();
  }
}
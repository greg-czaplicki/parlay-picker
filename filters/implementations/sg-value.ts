import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';
import { CourseDNAService } from '@/lib/services/course-dna-service';
import type { PlayerCourseFit } from '@/lib/types/course-dna';

// Player interface for SG Value filtering system
interface Player {
  dg_id: number;
  name: string;
  odds: number | null;
  sgTotal: number;
  sg_total?: number | null;  // Tournament SG total from API
  season_sg_total?: number | null;  // Season SG total from PGA Tour data
  dgSeasonSgTotal?: number | null; // Season SG total from DataGolf
  
  // Individual SG category data (tournament)
  sgPutt?: number | null;
  sg_putt?: number | null;  // API field name
  sgApp?: number | null;
  sg_app?: number | null;  // API field name
  sgArg?: number | null;
  sg_arg?: number | null;  // API field name
  sgOtt?: number | null;
  sg_ott?: number | null;  // API field name
  
  // Individual SG category data (season)
  season_sg_putt?: number | null;
  season_sg_app?: number | null;
  season_sg_arg?: number | null;
  season_sg_ott?: number | null;
  
  valueRating: number;
  confidenceScore: number;
  isRecommended: boolean;
  matchupId: string; // UUID string format
  eventName?: string;
  roundNum?: number;
}

/**
 * Enhanced SG Value Filter Options
 */
interface SGValueOptions extends FilterOptions {
  /** Minimum value score threshold to qualify (default: 0.1) */
  minValueScore?: number;
  /** Time period for performance calculation: 'recent' (10 rounds) | 'extended' (20 rounds) | 'season' (40+ rounds) */
  timePeriod?: 'recent' | 'extended' | 'season';
  /** Weight for recent performance vs historical (default: 0.7) */
  recencyWeight?: number;
  /** Maximum odds to consider (default: no limit) */
  maxOdds?: number;
  /** Minimum odds to consider (default: no limit) */  
  minOdds?: number;
  /** Course fit factor weight in value calculation (default: 0.2) */
  courseFitWeight?: number;
  /** Sort results by: 'value-score' | 'performance-percentile' | 'odds-value' | 'value-quality' (default: 'value-score') */
  sortBy?: 'value-score' | 'performance-percentile' | 'odds-value' | 'value-quality';
  /** Odds format: 'auto' | 'american' | 'decimal' | 'fractional' (default: 'auto') */
  oddsFormat?: 'auto' | 'american' | 'decimal' | 'fractional';
  /** Remove bookmaker vig from odds calculations (default: true) */
  removeVig?: boolean;
  /** Event name for course fit analysis (required for course fit integration) */
  eventName?: string;
}

/**
 * SG Value Filter
 * Identifies undervalued players by comparing their SG performance percentiles 
 * to their implied betting odds probabilities, factoring in course fit and recency.
 * 
 * Value Score = (Performance Percentile - Implied Probability Percentile) * Course Fit Factor
 * Higher scores indicate better value (performance exceeds market expectations)
 */
export function createSGValueFilter(): Filter<Player> {
  return {
    id: 'sg-value',
    name: 'SG Value',
    description: 'Identifies undervalued players by comparing SG performance to betting market expectations.',
    category: FilterCategory.PLAYER,
    applyFilter: async (data: Player[], options?: SGValueOptions): Promise<FilterResult<Player>> => {
      // Extract options with defaults
      const {
        minValueScore = 0.1,
        timePeriod = 'recent',
        recencyWeight = 0.7,
        maxOdds = Infinity,
        minOdds = -Infinity,
        courseFitWeight = 0.2,
        sortBy = 'value-score',
        oddsFormat = 'auto',
        removeVig = true
      } = options || {};
      
      if (!Array.isArray(data) || data.length === 0) {
        return { filtered: [] };
      }

      // Filter players with required data
      const eligiblePlayers = data.filter(player => {
        // Must have SG data
        const hasSGData = typeof player.sgTotal === 'number' || 
                         typeof player.season_sg_total === 'number' ||
                         typeof player.dgSeasonSgTotal === 'number';
        
        // Must have odds data
        const hasOdds = typeof player.odds === 'number';
        
        // Must be within odds range
        const oddsInRange = !hasOdds || (
          player.odds! >= minOdds && player.odds! <= maxOdds
        );
        
        return hasSGData && hasOdds && oddsInRange;
      });

      if (eligiblePlayers.length === 0) {
        return { 
          filtered: [],
          meta: {
            error: 'No players with required SG and odds data',
            totalPlayers: data.length,
            eligiblePlayers: 0
          }
        };
      }

      // Calculate performance percentiles for all eligible players
      const playersWithPercentiles = calculatePerformancePercentiles(eligiblePlayers, timePeriod, recencyWeight);
      
      // Calculate implied probability percentiles from odds
      const playersWithOddsPercentiles = calculateOddsPercentiles(playersWithPercentiles, oddsFormat, removeVig);
      
      // Calculate course fit factors
      const playersWithCourseFit = await calculateCourseFitFactors(playersWithOddsPercentiles, options?.eventName);
      
      // Calculate value scores with enhanced algorithm
      const playersWithValueScores = playersWithCourseFit.map(player => {
        const performancePercentile = player.performancePercentile || 0;
        const oddsPercentile = player.oddsPercentile || 0;
        const courseFitFactor = player.courseFitFactor || 1;
        
        // Enhanced Value Score Algorithm
        // Base score: Performance percentile - Market expectation percentile  
        const baseValueScore = performancePercentile - oddsPercentile;
        
        // Apply course fit adjustment with configurable weight
        // courseFitWeight determines how much course fit affects final score
        const courseAdjustment = (courseFitFactor - 1) * courseFitWeight;
        const valueScore = baseValueScore * (1 + courseAdjustment);
        
        // Calculate confidence metrics
        const performanceConfidence = calculatePerformanceConfidence(player);
        const oddsConfidence = calculateOddsConfidence(player);
        const overallConfidence = (performanceConfidence + oddsConfidence) / 2;
        
        // Value quality rating (combines score with confidence)
        const valueQuality = valueScore * overallConfidence;
        
        return {
          ...player,
          valueScore,
          baseValueScore,
          performanceVsMarket: baseValueScore,
          courseAdjustment,
          performanceConfidence,
          oddsConfidence,
          overallConfidence,
          valueQuality,
          debugInfo: {
            performancePercentile,
            oddsPercentile,
            courseFitFactor,
            courseFitWeight,
            timePeriod,
            recencyWeight
          }
        };
      });

      // Filter by minimum value score
      const qualifiedPlayers = playersWithValueScores.filter(player => 
        player.valueScore >= minValueScore
      );

      // Sort results
      sortValueResults(qualifiedPlayers, sortBy);

      // Calculate summary statistics
      const avgValueScore = qualifiedPlayers.length > 0 
        ? qualifiedPlayers.reduce((sum, p) => sum + p.valueScore, 0) / qualifiedPlayers.length 
        : 0;
      const avgPerformancePercentile = qualifiedPlayers.length > 0
        ? qualifiedPlayers.reduce((sum, p) => sum + p.performancePercentile, 0) / qualifiedPlayers.length
        : 0;
      const avgOddsPercentile = qualifiedPlayers.length > 0
        ? qualifiedPlayers.reduce((sum, p) => sum + p.oddsPercentile, 0) / qualifiedPlayers.length
        : 0;
      const avgCourseFitFactor = qualifiedPlayers.length > 0
        ? qualifiedPlayers.reduce((sum, p) => sum + p.courseFitFactor, 0) / qualifiedPlayers.length
        : 1;

      return {
        filtered: qualifiedPlayers,
        meta: {
          totalPlayers: data.length,
          eligiblePlayers: eligiblePlayers.length,
          qualifiedPlayers: qualifiedPlayers.length,
          optionsUsed: options,
          calculationDetails: {
            timePeriod,
            recencyWeight,
            courseFitWeight,
            sortBy,
            oddsFormat,
            removeVig
          },
          summaryStats: {
            avgValueScore: Number(avgValueScore.toFixed(3)),
            avgPerformancePercentile: Number(avgPerformancePercentile.toFixed(3)),
            avgOddsPercentile: Number(avgOddsPercentile.toFixed(3)),
            avgCourseFitFactor: Number(avgCourseFitFactor.toFixed(3)),
            topValueScore: qualifiedPlayers.length > 0 ? qualifiedPlayers[0].valueScore : 0,
            cacheSize: timeWeightedSGCache.size
          },
          eventName: options?.eventName || 'unknown'
        }
      };
    },
  };
}

/**
 * Calculate performance percentiles based on SG data
 */
function calculatePerformancePercentiles(
  players: Player[], 
  timePeriod: string, 
  recencyWeight: number
): (Player & { performancePercentile: number; weightedSG: number })[] {
  // Calculate weighted SG for each player
  const playersWithWeightedSG = players.map(player => {
    const weightedSG = calculateTimeWeightedSG(player, timePeriod, recencyWeight);
    return { ...player, weightedSG };
  });

  // Calculate percentiles
  const sgValues = playersWithWeightedSG.map(p => p.weightedSG).sort((a, b) => a - b);
  
  return playersWithWeightedSG.map(player => {
    const rank = sgValues.filter(sg => sg < player.weightedSG).length;
    const percentile = sgValues.length > 1 ? rank / (sgValues.length - 1) : 0.5;
    
    return {
      ...player,
      performancePercentile: percentile
    };
  });
}

// Memoization cache for time-weighted SG calculations
const timeWeightedSGCache = new Map<string, number>();

/**
 * Calculate time-weighted SG performance with memoization and sophisticated weighting
 */
function calculateTimeWeightedSG(
  player: Player, 
  timePeriod: string, 
  recencyWeight: number
): number {
  // Create cache key
  const cacheKey = `${player.dg_id}-${timePeriod}-${recencyWeight}-${player.sgTotal || 0}-${player.season_sg_total || 0}-${player.dgSeasonSgTotal || 0}`;
  
  // Check cache first
  if (timeWeightedSGCache.has(cacheKey)) {
    return timeWeightedSGCache.get(cacheKey)!;
  }

  const tournamentSG = player.sgTotal || player.sg_total || 0;
  const seasonSG = player.season_sg_total || player.dgSeasonSgTotal || 0;
  
  let weightedSG: number;
  
  // Enhanced time period weighting with decay functions
  switch (timePeriod) {
    case 'recent':
      // Exponential decay favoring very recent data
      // 85% tournament (recent rounds), 15% season context
      weightedSG = applyExponentialDecay(tournamentSG, seasonSG, 0.85);
      break;
      
    case 'extended':
      // Linear decay with configurable recency weight
      // Balanced approach with user-configurable weighting
      weightedSG = applyLinearDecay(tournamentSG, seasonSG, recencyWeight);
      break;
      
    case 'season':
      // Inverse weighting favoring longer-term trends
      // 75% season data, 25% tournament for context
      weightedSG = applyLongTermWeighting(tournamentSG, seasonSG, 0.25);
      break;
      
    default:
      // Default to extended period logic
      weightedSG = applyLinearDecay(tournamentSG, seasonSG, recencyWeight);
      break;
  }
  
  // Cache the result
  timeWeightedSGCache.set(cacheKey, weightedSG);
  
  return weightedSG;
}

/**
 * Apply exponential decay weighting (for recent performance emphasis)
 */
function applyExponentialDecay(tournamentSG: number, seasonSG: number, tournamentWeight: number): number {
  // If we have both data sources, use exponential weighting
  if (tournamentSG !== 0 && seasonSG !== 0) {
    return tournamentSG * tournamentWeight + seasonSG * (1 - tournamentWeight);
  }
  
  // Fallback to available data
  return tournamentSG || seasonSG;
}

/**
 * Apply linear decay weighting (for balanced approach)
 */
function applyLinearDecay(tournamentSG: number, seasonSG: number, recencyWeight: number): number {
  // Ensure recency weight is within bounds
  const clampedWeight = Math.max(0, Math.min(1, recencyWeight));
  
  // If we have both data sources, use linear weighting
  if (tournamentSG !== 0 && seasonSG !== 0) {
    return tournamentSG * clampedWeight + seasonSG * (1 - clampedWeight);
  }
  
  // Fallback to available data
  return tournamentSG || seasonSG;
}

/**
 * Apply long-term weighting (for season-long consistency emphasis)
 */
function applyLongTermWeighting(tournamentSG: number, seasonSG: number, tournamentWeight: number): number {
  // If we have both data sources, favor season data
  if (tournamentSG !== 0 && seasonSG !== 0) {
    return seasonSG * (1 - tournamentWeight) + tournamentSG * tournamentWeight;
  }
  
  // Prefer season data if available, otherwise use tournament
  return seasonSG || tournamentSG;
}

/**
 * Clear the time-weighted SG cache (useful for testing or memory management)
 */
function clearTimeWeightedSGCache(): void {
  timeWeightedSGCache.clear();
}

/**
 * Calculate implied probability percentiles from betting odds
 * Includes vig removal and configurable odds format detection
 */
function calculateOddsPercentiles(
  players: (Player & { performancePercentile: number; weightedSG: number })[],
  oddsFormat: 'auto' | 'american' | 'decimal' | 'fractional' = 'auto',
  removeVigEnabled: boolean = true
): (Player & { performancePercentile: number; weightedSG: number; oddsPercentile: number; impliedProbability: number; vigAdjustedProbability: number })[] {
  // Convert odds to implied probabilities
  const playersWithProbabilities = players.map(player => {
    const detectedFormat = oddsFormat === 'auto' ? detectOddsFormat(player.odds!) : oddsFormat;
    const impliedProbability = oddsToImpliedProbability(player.odds!, detectedFormat);
    return { 
      ...player, 
      impliedProbability,
      detectedOddsFormat: detectedFormat
    };
  });

  let playersWithVigAdjusted: any[] = [];
  
  if (removeVigEnabled) {
    // Remove vig from probabilities by matchup groups
    const groupedPlayers = groupPlayersByMatchup(playersWithProbabilities);
    
    Object.values(groupedPlayers).forEach(group => {
      const groupProbabilities = group.map(p => p.impliedProbability);
      const vigAdjustedProbabilities = removeVigFromProbabilities(groupProbabilities);
      
      group.forEach((player, index) => {
        playersWithVigAdjusted.push({
          ...player,
          vigAdjustedProbability: vigAdjustedProbabilities[index]
        });
      });
    });
  } else {
    // Use raw implied probabilities without vig adjustment
    playersWithVigAdjusted = playersWithProbabilities.map(player => ({
      ...player,
      vigAdjustedProbability: player.impliedProbability
    }));
  }

  // Calculate percentiles using (potentially) vig-adjusted probabilities
  const adjustedProbabilities = playersWithVigAdjusted.map(p => p.vigAdjustedProbability).sort((a, b) => a - b);
  
  return playersWithVigAdjusted.map(player => {
    const rank = adjustedProbabilities.filter(prob => prob < player.vigAdjustedProbability).length;
    const percentile = adjustedProbabilities.length > 1 ? rank / (adjustedProbabilities.length - 1) : 0.5;
    
    return {
      ...player,
      oddsPercentile: percentile
    };
  });
}

/**
 * Group players by matchup for vig removal
 */
function groupPlayersByMatchup(players: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  players.forEach(player => {
    const matchupId = player.matchupId;
    if (!groups[matchupId]) {
      groups[matchupId] = [];
    }
    groups[matchupId].push(player);
  });
  
  return groups;
}

/**
 * Convert betting odds to implied probability
 * Supports American, Decimal, and Fractional odds formats
 */
function oddsToImpliedProbability(odds: number, format: 'american' | 'decimal' | 'fractional' = 'american'): number {
  switch (format) {
    case 'american':
      return convertAmericanOddsToImpliedProbability(odds);
    case 'decimal':
      return convertDecimalOddsToImpliedProbability(odds);
    case 'fractional':
      return convertFractionalOddsToImpliedProbability(odds);
    default:
      return convertAmericanOddsToImpliedProbability(odds);
  }
}

/**
 * Convert American odds to implied probability
 */
function convertAmericanOddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    // Positive American odds: +150 means 100/(150+100) = 0.4
    return 100 / (odds + 100);
  } else if (odds < 0) {
    // Negative American odds: -150 means 150/(150+100) = 0.6
    return Math.abs(odds) / (Math.abs(odds) + 100);
  } else {
    return 0.5; // Even odds
  }
}

/**
 * Convert Decimal odds to implied probability
 */
function convertDecimalOddsToImpliedProbability(odds: number): number {
  if (odds <= 1) return 0; // Invalid decimal odds
  return 1 / odds;
}

/**
 * Convert Fractional odds to implied probability  
 */
function convertFractionalOddsToImpliedProbability(odds: number): number {
  // Assuming fractional odds are passed as decimal (e.g., 3/2 = 1.5)
  return 1 / (odds + 1);
}

/**
 * Detect odds format based on typical ranges
 */
function detectOddsFormat(odds: number): 'american' | 'decimal' | 'fractional' {
  if (odds < 0 || odds >= 100) {
    return 'american'; // Negative or large positive numbers
  } else if (odds >= 1 && odds <= 50) {
    return 'decimal'; // Typical decimal odds range
  } else {
    return 'fractional'; // Fractional odds represented as decimals
  }
}

/**
 * Remove vig (bookmaker margin) from implied probabilities
 */
function removeVigFromProbabilities(probabilities: number[]): number[] {
  const totalProbability = probabilities.reduce((sum, prob) => sum + prob, 0);
  
  if (totalProbability <= 1) {
    return probabilities; // No vig to remove
  }
  
  // Scale probabilities to remove vig
  return probabilities.map(prob => prob / totalProbability);
}

/**
 * Calculate course fit factors using Course DNA service
 */
async function calculateCourseFitFactors(
  players: (Player & { performancePercentile: number; weightedSG: number; oddsPercentile: number; impliedProbability: number; vigAdjustedProbability: number })[],
  eventName?: string
): Promise<(Player & { performancePercentile: number; weightedSG: number; oddsPercentile: number; impliedProbability: number; vigAdjustedProbability: number; courseFitFactor: number; courseFitScore?: number })[]> {
  
  // If no event name provided, return neutral course fit factors
  if (!eventName) {
    return players.map(player => ({
      ...player,
      courseFitFactor: 1.0,
      courseFitScore: undefined
    }));
  }

  const courseDNAService = new CourseDNAService();
  const playersWithCourseFit: any[] = [];

  // Analyze course fit for each player (with error handling)
  for (const player of players) {
    try {
      const courseFit = await courseDNAService.analyzePlayerCourseFit(player.dg_id, eventName);
      
      if (courseFit) {
        // Convert fit_score (0-100) to fit_factor (0.5-1.5)
        // Score of 50 = factor of 1.0 (neutral)
        // Score of 100 = factor of 1.5 (strong advantage)
        // Score of 0 = factor of 0.5 (disadvantage)
        const courseFitFactor = 0.5 + (courseFit.fit_score / 100);
        
        playersWithCourseFit.push({
          ...player,
          courseFitFactor,
          courseFitScore: courseFit.fit_score,
          courseFitGrade: courseFit.fit_grade,
          courseFitDetails: courseFit.category_fit
        });
      } else {
        // Fallback to neutral if course fit analysis fails
        playersWithCourseFit.push({
          ...player,
          courseFitFactor: 1.0,
          courseFitScore: undefined
        });
      }
    } catch (error) {
      console.warn(`Course fit analysis failed for player ${player.dg_id}:`, error);
      // Fallback to neutral on error
      playersWithCourseFit.push({
        ...player,
        courseFitFactor: 1.0,
        courseFitScore: undefined
      });
    }
  }

  return playersWithCourseFit;
}

/**
 * Calculate performance confidence based on data availability and quality
 */
function calculatePerformanceConfidence(player: any): number {
  let confidence = 0.5; // Base confidence
  
  // Boost confidence if we have tournament data
  if (player.sgTotal || player.sg_total) {
    confidence += 0.2;
  }
  
  // Boost confidence if we have season data
  if (player.season_sg_total || player.dgSeasonSgTotal) {
    confidence += 0.2;
  }
  
  // Boost confidence if we have both data sources
  if ((player.sgTotal || player.sg_total) && (player.season_sg_total || player.dgSeasonSgTotal)) {
    confidence += 0.1;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * Calculate odds confidence based on data quality and market efficiency
 */
function calculateOddsConfidence(player: any): number {
  let confidence = 0.6; // Base confidence in odds data
  
  // Check if odds are within reasonable range
  if (player.odds && player.odds >= -500 && player.odds <= 5000) {
    confidence += 0.2;
  }
  
  // Boost confidence if we have vig-adjusted probabilities
  if (player.vigAdjustedProbability && player.vigAdjustedProbability !== player.impliedProbability) {
    confidence += 0.1;
  }
  
  // Boost confidence if odds format was auto-detected correctly
  if (player.detectedOddsFormat) {
    confidence += 0.1;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * Sort value results based on specified criteria
 */
function sortValueResults(
  players: any[],
  sortBy: string
): void {
  switch (sortBy) {
    case 'performance-percentile':
      players.sort((a, b) => b.performancePercentile - a.performancePercentile);
      break;
    case 'odds-value':
      players.sort((a, b) => b.performanceVsMarket - a.performanceVsMarket);
      break;
    case 'value-quality':
      // Sort by value quality (value score * confidence)
      players.sort((a, b) => (b.valueQuality || b.valueScore) - (a.valueQuality || a.valueScore));
      break;
    case 'value-score':
    default:
      players.sort((a, b) => b.valueScore - a.valueScore);
      break;
  }
} 
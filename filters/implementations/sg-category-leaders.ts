import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * SG Category Leaders Filter Options
 */
interface SGCategoryLeadersOptions extends FilterOptions {
  /** Which SG category to focus on: 'total' | 'putting' | 'approach' | 'around-green' | 'off-tee' | 'all' */
  category?: 'total' | 'putting' | 'approach' | 'around-green' | 'off-tee' | 'all';
  /** Minimum SG value in the selected category (default: 0.5) */
  minCategoryValue?: number;
  /** Minimum percentile rank in category (0-100, default: 70) */
  minPercentile?: number;
  /** Include only players in top N of each group (default: 1) */
  topNPerGroup?: number;
  /** Require consistency across categories (default: false) */
  requireConsistency?: boolean;
  /** Weight for tournament vs season data (default: 0.7) */
  tournamentWeight?: number;
}

/**
 * SG Category Leaders Filter
 * Identifies players who excel in specific strokes gained categories,
 * allowing for targeted analysis of putting specialists, approach masters, etc.
 */
export function createSGCategoryLeadersFilter(): Filter<any> {
  return {
    id: 'sg-category-leaders',
    name: 'SG Category Leaders',
    description: 'Identifies players who excel in specific strokes gained categories (putting, approach, etc.)',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: SGCategoryLeadersOptions): FilterResult<any> => {
      const {
        category = 'total',
        minCategoryValue = 0.5,
        minPercentile = 70,
        topNPerGroup = 1,
        requireConsistency = false,
        tournamentWeight = 0.7
      } = options || {};

      if (!Array.isArray(data) || data.length === 0) {
        return { filtered: [] };
      }

      // Detect tournament phase
      const inTournament = detectTournamentPhase(data);
      
      // Calculate category values for all players
      const playersWithSG = data.map(player => ({
        ...player,
        sgCategories: calculateSGCategories(player, inTournament, tournamentWeight),
        tournamentPhase: inTournament
      }));

      // Filter by category-specific requirements
      let qualifiedPlayers = playersWithSG.filter(player => {
        const sgCats = player.sgCategories;
        
        if (category === 'all') {
          // For 'all', check if player is strong in any category
          return Object.values(sgCats).some((value: any) => 
            typeof value === 'number' && value >= minCategoryValue
          );
        } else {
          // Check specific category
          const categoryValue = sgCats[category];
          if (typeof categoryValue !== 'number') return false;
          return categoryValue >= minCategoryValue;
        }
      });

      // Apply percentile filtering
      if (minPercentile > 0 && qualifiedPlayers.length > 0) {
        qualifiedPlayers = filterByPercentile(qualifiedPlayers, category, minPercentile);
      }

      // Apply consistency filtering if required
      if (requireConsistency) {
        const beforeConsistency = qualifiedPlayers.length;
        qualifiedPlayers = filterByConsistency(qualifiedPlayers);
        // Debug info can be accessed via meta if needed
      }

      // Group by matchupId and select top performers
      const groups: Record<string, any[]> = {};
      qualifiedPlayers.forEach(player => {
        const groupId = player.matchupId ?? 'ungrouped';
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(player);
      });

      const categoryLeaders: any[] = [];
      
      Object.values(groups).forEach(group => {
        // Sort by the target category performance
        const sortedGroup = sortByCategoryPerformance(group, category);
        
        // Take top N from each group
        const topPerformers = sortedGroup.slice(0, topNPerGroup);
        
        topPerformers.forEach((player, index) => {
          categoryLeaders.push({
            ...player,
            categoryRankInGroup: index + 1,
            groupSize: group.length,
            categoryFocus: category,
            categoryValue: getCategoryValue(player.sgCategories, category),
            consistencyScore: calculateConsistencyScore(player.sgCategories)
          });
        });
      });

      // Sort final results by category performance
      categoryLeaders.sort((a, b) => {
        const aValue = getCategoryValue(a.sgCategories, category);
        const bValue = getCategoryValue(b.sgCategories, category);
        return bValue - aValue;
      });

      return {
        filtered: categoryLeaders,
        meta: {
          category,
          tournamentPhase: inTournament,
          totalGroups: Object.keys(groups).length,
          qualifiedPlayers: qualifiedPlayers.length,
          optionsUsed: options
        }
      };
    },
  };
}

/**
 * Calculate SG values for all categories
 */
function calculateSGCategories(player: any, inTournament: boolean, tournamentWeight: number) {
  // Use consistent field mapping that matches the data structure throughout the app
  const tournament = {
    total: player.sgTotal || player.sg_total,
    putting: player.sgPutt || player.sg_putt,
    approach: player.sgApp || player.sg_app,
    'around-green': player.sgArg || player.sg_arg,
    'off-tee': player.sgOtt || player.sg_ott
  };

  const season = {
    total: player.seasonSgTotal || player.season_sg_total,
    putting: player.season_sg_putt || player.seasonSgPutt,
    approach: player.season_sg_app || player.seasonSgApp,
    'around-green': player.season_sg_arg || player.seasonSgArg,
    'off-tee': player.season_sg_ott || player.seasonSgOtt
  };

  const result: Record<string, number> = {};

  Object.keys(tournament).forEach(key => {
    const tournamentValue = tournament[key as keyof typeof tournament];
    const seasonValue = season[key as keyof typeof season];

    if (inTournament) {
      if (typeof tournamentValue === 'number' && typeof seasonValue === 'number') {
        result[key] = tournamentWeight * tournamentValue + (1 - tournamentWeight) * seasonValue;
      } else if (typeof tournamentValue === 'number') {
        result[key] = tournamentValue;
      } else if (typeof seasonValue === 'number') {
        result[key] = seasonValue;
      } else {
        result[key] = 0;
      }
    } else {
      if (typeof seasonValue === 'number') {
        result[key] = seasonValue;
      } else if (typeof tournamentValue === 'number') {
        result[key] = tournamentValue;
      } else {
        result[key] = 0;
      }
    }
  });

  return result;
}

/**
 * Filter players by percentile in the target category
 */
function filterByPercentile(players: any[], category: string, minPercentile: number): any[] {
  if (category === 'all') {
    // For 'all', use the maximum category value for each player
    const playerMaxValues = players.map(p => ({
      player: p,
      maxValue: Math.max(...Object.values(p.sgCategories).filter((v): v is number => typeof v === 'number'))
    }));
    
    playerMaxValues.sort((a, b) => b.maxValue - a.maxValue);
    const cutoffIndex = Math.floor(players.length * (100 - minPercentile) / 100);
    return playerMaxValues.slice(0, players.length - cutoffIndex).map(p => p.player);
  } else {
    // For specific category
    const validPlayers = players.filter(p => typeof p.sgCategories[category] === 'number');
    validPlayers.sort((a, b) => b.sgCategories[category] - a.sgCategories[category]);
    const cutoffIndex = Math.floor(validPlayers.length * (100 - minPercentile) / 100);
    return validPlayers.slice(0, validPlayers.length - cutoffIndex);
  }
}

/**
 * Filter players who show consistency across SG categories
 */
function filterByConsistency(players: any[]): any[] {
  return players.filter(player => {
    const values = Object.values(player.sgCategories).filter((v): v is number => typeof v === 'number');
    if (values.length < 3) return false; // Need at least 3 categories

    // Calculate standard deviation of SG values
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // For consistency, we want:
    // 1. Standard deviation not too high (< 1.0 SG units)
    // 2. No category is extremely poor (< -2.0)
    // 3. Player has at least one category above average (> 0)
    const hasReasonableVariation = stdDev < 1.0;
    const noExtremeWeakness = values.every(val => val > -2.0);
    const hasAtLeastOneStrength = values.some(val => val > 0);
    
    return hasReasonableVariation && noExtremeWeakness && hasAtLeastOneStrength;
  });
}

/**
 * Sort group by category performance
 */
function sortByCategoryPerformance(group: any[], category: string): any[] {
  return [...group].sort((a, b) => {
    const aValue = getCategoryValue(a.sgCategories, category);
    const bValue = getCategoryValue(b.sgCategories, category);
    return bValue - aValue;
  });
}

/**
 * Get the value for a specific category or best category for 'all'
 */
function getCategoryValue(sgCategories: Record<string, number>, category: string): number {
  if (category === 'all') {
    const values = Object.values(sgCategories).filter((v): v is number => typeof v === 'number');
    return Math.max(...values, 0);
  }
  return sgCategories[category] || 0;
}

/**
 * Calculate consistency score across all SG categories
 */
function calculateConsistencyScore(sgCategories: Record<string, number>): number {
  const values = Object.values(sgCategories).filter((v): v is number => typeof v === 'number');
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Consistency score based on standard deviation
  // Lower standard deviation = higher consistency
  // Scale from 0-100 where 100 is perfect consistency (stdDev = 0)
  // and reasonable consistency (stdDev = 1.0) gets ~60 points
  const consistencyScore = Math.max(0, 100 - (stdDev * 40));
  
  return Math.round(consistencyScore);
}

/**
 * Enhanced tournament phase detection
 */
function detectTournamentPhase(data: any[]): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  
  const indicators = {
    hasSgTotal: data.some(p => typeof p.sgTotal === 'number' && p.sgTotal !== 0),
    hasPosition: data.some(p => p.position && p.position !== null),
    hasRoundScores: data.some(p => p.round_scores && Object.values(p.round_scores || {}).some(score => score !== null)),
    hasToday: data.some(p => typeof p.today === 'number'),
    hasEventName: data.some(p => p.event_name && p.event_name !== null)
  };
  
  return indicators.hasSgTotal || indicators.hasPosition || indicators.hasRoundScores;
} 
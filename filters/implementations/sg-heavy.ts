import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

// Player interface for filtering system
interface Player {
  dg_id: number;
  name: string;
  odds: number | null;
  sgTotal: number;
  seasonSgTotal?: number | null;
  
  // Individual SG category data (tournament)
  sgPutt?: number | null;
  sgApp?: number | null;
  sgArg?: number | null;
  sgOtt?: number | null;
  
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
 * Enhanced SG Heavy Filter Options
 */
interface SGHeavyOptions extends FilterOptions {
  /** Minimum weighted SG score to qualify (default: 0) */
  minSgThreshold?: number;
  /** Weight for tournament SG vs season SG when both available (default: 0.6) */
  tournamentWeight?: number;
  /** Minimum odds gap required to include player (default: 0) */
  minOddsGap?: number;
  /** Maximum odds to consider (default: no limit) */
  maxOdds?: number;
  /** Sort by: 'sg' | 'odds-gap' | 'composite' (default: 'sg') */
  sortBy?: 'sg' | 'odds-gap' | 'composite';
  /** Include players even if they're not the odds favorite in their group */
  includeUnderdogs?: boolean;
}

/**
 * SG Heavy Filter
 * For each 3-ball or 2-ball group, returns the player with the highest weighted SG 
 * (in-tournament: customizable tournament/season mix, pre-tournament: seasonSgTotal),
 * with sophisticated tournament phase detection and configurable filtering options.
 * Groups with no qualifying players (below SG threshold or no SG data) are skipped.
 */
export function createSGHeavyFilter(): Filter<Player> {
  return {
    id: 'sg-heavy',
    name: 'SG Heavy',
    description: 'Returns the top SG player from each group with configurable tournament/season weighting and filtering options.',
    category: FilterCategory.PLAYER,
    applyFilter: (data: Player[], options?: SGHeavyOptions): FilterResult<Player> => {
      // Extract options with defaults
      const {
        minSgThreshold = 0,
        tournamentWeight = 0.6,
        minOddsGap = 0,
        maxOdds = Infinity,
        sortBy = 'sg',
        includeUnderdogs = false
      } = options || {};
      
      if (!Array.isArray(data) || data.length === 0) {
        return { filtered: [] };
      }

      // Check if players have SG data
      const playersWithSG = data.filter(player => 
        typeof player.sgTotal === 'number' || 
        typeof player.seasonSgTotal === 'number'
      );

      if (playersWithSG.length === 0) {
        return { 
          filtered: [],
          meta: {
            error: 'No players with SG data available.',
            totalPlayers: data.length,
            playersWithSG: 0
          }
        };
      }

      // Enhanced tournament detection - if any player has different sgTotal vs seasonSgTotal
      const inTournament = playersWithSG.some(player => 
        typeof player.sgTotal === 'number' && 
        typeof player.seasonSgTotal === 'number' &&
        player.sgTotal !== player.seasonSgTotal
      );

      // Calculate weighted SG for each player
      const playersWithWeightedSG = playersWithSG.map(player => {
        const sgTotalWeighted = calculateWeightedSGFromPlayer(player, inTournament, tournamentWeight);
        return {
          ...player,
          sgTotalWeighted,
          tournamentPhase: inTournament,
          sgCalculationMethod: getSGCalculationMethodFromPlayer(player, inTournament)
        };
      });

      // Group by matchupId
      const groups: Record<string, typeof playersWithWeightedSG> = {};
      playersWithWeightedSG.forEach((player) => {
        const groupId = player.matchupId;
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(player);
      });

      const sgHeavy: any[] = [];
      let processedGroups = 0;
      let totalPlayersSeen = 0;
      let playersWithValidSG = 0;

      Object.values(groups).forEach(group => {
        processedGroups++;
        totalPlayersSeen += group.length;

        // Filter out players with invalid odds if maxOdds is specified
        const validOddsGroup = maxOdds < Infinity 
          ? group.filter((p: any) => typeof p.odds !== 'number' || p.odds <= maxOdds)
          : group;
          
        if (validOddsGroup.length === 0) return;

        validOddsGroup.forEach(p => {
          if (p.sgTotalWeighted > 0) playersWithValidSG++;
        });

        // Apply SG-based filtering
        const qualifiedPlayers = validOddsGroup.filter(p => p.sgTotalWeighted >= minSgThreshold);

        if (qualifiedPlayers.length === 0) {
          return;
        }

        // Sort by weighted SG descending to find the best
        qualifiedPlayers.sort((a: any, b: any) => b.sgTotalWeighted - a.sgTotalWeighted);

        // Calculate odds metrics for the group
        const oddsMetrics = calculateOddsMetrics(validOddsGroup);

        if (includeUnderdogs) {
          // Include all qualified players, not just the top SG performer
          qualifiedPlayers.forEach(player => {
            if (oddsMetrics.oddsGapToNext >= minOddsGap) {
              sgHeavy.push({
                ...player,
                ...oddsMetrics,
                isTopSGInGroup: player === qualifiedPlayers[0],
                groupSize: validOddsGroup.length,
                qualifiedInGroup: qualifiedPlayers.length
              });
            }
          });
        } else {
          // Original behavior: only the top SG player
          const best = qualifiedPlayers[0];
          if (oddsMetrics.oddsGapToNext >= minOddsGap) {
            sgHeavy.push({
              ...best,
              ...oddsMetrics,
              isTopSGInGroup: true,
              groupSize: validOddsGroup.length,
              qualifiedInGroup: qualifiedPlayers.length
            });
          }
        }
      });

      // Sort the final results based on sortBy option
      sortSGHeavyResults(sgHeavy, sortBy);

      return { 
        filtered: sgHeavy,
        meta: {
          tournamentPhase: inTournament,
          totalGroups: Object.keys(groups).length,
          playersWithSG: playersWithSG.length,
          optionsUsed: options,
          dataStructure: 'player'
        }
      };
    },
  };
}

/**
 * Calculate weighted SG from Player data
 */
function calculateWeightedSGFromPlayer(
  player: Player,
  inTournament: boolean,
  tournamentWeight: number
): number {
  const tournamentSgTotal = player.sgTotal;
  const seasonSgTotal = player.seasonSgTotal;
  
  // If we have both pieces of data and in tournament, use weighted combination
  if (inTournament &&
      tournamentSgTotal !== null && tournamentSgTotal !== undefined && 
      seasonSgTotal !== null && seasonSgTotal !== undefined) {
    return tournamentWeight * tournamentSgTotal + (1 - tournamentWeight) * seasonSgTotal;
  }
  
  if (inTournament) {
    // During tournament: prefer tournament data, fallback to season
    if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) {
      return tournamentSgTotal;
    } else if (seasonSgTotal !== null && seasonSgTotal !== undefined) {
      return seasonSgTotal;
    }
  } else {
    // Pre-tournament: prefer season data, accept tournament data as fallback
    if (seasonSgTotal !== null && seasonSgTotal !== undefined) {
      return seasonSgTotal;
    } else if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) {
      return tournamentSgTotal;
    }
  }
  
  // No valid SG data found
  return 0;
}

/**
 * Get description of how SG was calculated from Player data
 */
function getSGCalculationMethodFromPlayer(player: Player, inTournament: boolean): string {
  const tournamentSgTotal = player.sgTotal;
  const seasonSgTotal = player.seasonSgTotal;
  
  if (inTournament) {
    if (tournamentSgTotal !== null && tournamentSgTotal !== undefined && 
        seasonSgTotal !== null && seasonSgTotal !== undefined) return 'tournament+season';
    if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) return 'tournament-only';
    if (seasonSgTotal !== null && seasonSgTotal !== undefined) return 'season-fallback';
  } else {
    if (seasonSgTotal !== null && seasonSgTotal !== undefined) return 'season-primary';
    if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) return 'tournament-fallback';
  }
  
  return 'no-data';
}

/**
 * Calculate odds-related metrics for a group
 */
function calculateOddsMetrics(group: any[]) {
  const withOdds = group.filter((p: any) => typeof p.odds === 'number');
  
  if (withOdds.length < 2) {
    return {
      oddsGapToNext: 0,
      nextBestPlayer: undefined,
      nextBestOdds: undefined,
      favoriteOdds: undefined,
      hasOddsData: false
    };
  }
  
  // Sort by odds ascending (lower odds = more favored)
  withOdds.sort((a, b) => a.odds - b.odds);
  const [favorite, secondBest] = withOdds;
  
  return {
    oddsGapToNext: secondBest.odds - favorite.odds,
    nextBestPlayer: secondBest.name || secondBest.playerName || undefined,
    nextBestOdds: secondBest.odds,
    favoriteOdds: favorite.odds,
    hasOddsData: true
  };
}

/**
 * Sort SG Heavy results based on the specified method
 */
function sortSGHeavyResults(results: any[], sortBy: string) {
  switch (sortBy) {
    case 'odds-gap':
      results.sort((a, b) => {
        // Primary: odds gap (desc)
        if (b.oddsGapToNext !== a.oddsGapToNext) return b.oddsGapToNext - a.oddsGapToNext;
        // Secondary: SG Total (desc)
        return b.sgTotalWeighted - a.sgTotalWeighted;
      });
      break;
      
    case 'composite':
      // Calculate composite score: 60% SG, 40% odds advantage
      results.forEach(p => {
        const sgNorm = Math.max(0, (p.sgTotalWeighted + 3) / 6); // Normalize SG from -3 to +3 range
        const oddsAdvantage = p.hasOddsData ? Math.min(1, p.oddsGapToNext / 1.0) : 0; // Normalize odds gap
        p.compositeScore = 0.6 * sgNorm + 0.4 * oddsAdvantage;
      });
      results.sort((a, b) => b.compositeScore - a.compositeScore);
      break;
      
    case 'sg':
    default:
      results.sort((a, b) => {
        // Primary: SG Total (desc)
        if (b.sgTotalWeighted !== a.sgTotalWeighted) return b.sgTotalWeighted - a.sgTotalWeighted;
        // Secondary: odds gap (desc)
        return b.oddsGapToNext - a.oddsGapToNext;
      });
      break;
  }
}

// Helper to convert decimal odds to American odds
function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2.0) return Math.round((decimalOdds - 1) * 100);
  else if (decimalOdds > 1.0) return Math.round(-100 / (decimalOdds - 1));
  else return 0;
} 
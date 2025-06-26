import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

// Player interface for filtering system
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
  /** Data source for season stats: 'pga' | 'datagolf' | 'aggregate' (default: 'pga') */
  seasonDataSource?: 'pga' | 'datagolf' | 'aggregate';
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
        includeUnderdogs = false,
        seasonDataSource = 'pga'
      } = options || {};
      
      if (!Array.isArray(data) || data.length === 0) {
        return { filtered: [] };
      }

      // Check if players have SG data
      const playersWithSG = data.filter(player => {
        const hasTournamentSG = typeof player.sgTotal === 'number';
        const hasSeasonSG = seasonDataSource === 'pga' ? 
          typeof player.season_sg_total === 'number' :
          seasonDataSource === 'datagolf' ?
            typeof player.dgSeasonSgTotal === 'number' :
            typeof player.season_sg_total === 'number' || typeof player.dgSeasonSgTotal === 'number';
        return hasTournamentSG || hasSeasonSG;
      });

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

      // Calculate weighted SG for each player
      const playersWithWeightedSG = playersWithSG.map(player => {
        const sgTotalWeighted = calculateWeightedSGFromPlayer(player, false, tournamentWeight, options);
        const calculatedSeasonSG = calculateSeasonSGForDisplay(player, options);
        return {
          ...player,
          sgTotalWeighted,
          season_sg_total_calculated: calculatedSeasonSG, // Store the calculated season value for display
          sgCalculationMethod: getSGCalculationMethodFromPlayer(player, false, options),
          sgDebugInfo: {}
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
      let debugCalculations: any[] = [];

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
          // Collect debug info for each player
          debugCalculations.push({
            name: p.name,
            odds: p.odds,
            ...p.sgDebugInfo
          });
        });

        // Apply SG-based filtering (exclude players with -999 score indicating missing required data)
        const qualifiedPlayers = validOddsGroup.filter(p => p.sgTotalWeighted >= minSgThreshold && p.sgTotalWeighted > -900);

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
          totalGroups: Object.keys(groups).length,
          playersWithSG: playersWithSG.length,
          optionsUsed: options,
          dataStructure: 'player',
          debugCalculations,
          filterStats: {
            processedGroups,
            totalPlayersSeen,
            playersWithValidSG,
            playersInFinalResults: sgHeavy.length
          }
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
  tournamentWeight: number,
  options?: SGHeavyOptions
): number {
  const tournamentSgTotal = player.sgTotal || player.sg_total;
  const dataSource = options?.seasonDataSource || 'pga';
  
  let seasonSgTotal: number | null | undefined;
  
  switch (dataSource) {
    case 'pga':
      seasonSgTotal = player.season_sg_total;  // Use season_sg_total from API
      break;
    case 'datagolf':
      seasonSgTotal = player.dgSeasonSgTotal;
      break;
    case 'aggregate':
      // If both sources available, use average
      if (player.season_sg_total !== null && player.season_sg_total !== undefined &&
          player.dgSeasonSgTotal !== null && player.dgSeasonSgTotal !== undefined) {
        seasonSgTotal = (player.season_sg_total + player.dgSeasonSgTotal) / 2;
      } else {
        // Otherwise use whichever is available
        seasonSgTotal = player.season_sg_total ?? player.dgSeasonSgTotal;
      }
      break;
  }
  
  // Debug logging
  console.log(`[SG Heavy Debug] Calculating SG for ${player.name}:`, {
    tournamentSgTotal,
    seasonSgTotal,
    dataSource,
    tournamentWeight,
    pgaSeasonSg: player.season_sg_total,  // Update debug log field name
    dgSeasonSg: player.dgSeasonSgTotal
  });
  
  // Special cases for 0% and 100% tournament weight
  if (tournamentWeight === 0) {
    if (seasonSgTotal !== null && seasonSgTotal !== undefined) {
      console.log(`[SG Heavy Debug] Using 100% season data for ${player.name}: ${seasonSgTotal}`);
      return seasonSgTotal;
    } else {
      console.log(`[SG Heavy Debug] No season data available for ${player.name}, excluding from results`);
      return -999; // Return very low score to exclude player
    }
  }
  if (tournamentWeight === 1) {
    if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) {
      console.log(`[SG Heavy Debug] Using 100% tournament data for ${player.name}: ${tournamentSgTotal}`);
      return tournamentSgTotal;
    } else {
      console.log(`[SG Heavy Debug] No tournament data available for ${player.name}, excluding from results`);
      return -999; // Return very low score to exclude player
    }
  }

  // If we have both tournament and season data, use weighted average
  if (tournamentSgTotal !== null && tournamentSgTotal !== undefined &&
      seasonSgTotal !== null && seasonSgTotal !== undefined) {
    const weightedSG = (tournamentSgTotal * tournamentWeight) + (seasonSgTotal * (1 - tournamentWeight));
    console.log(`[SG Heavy Debug] Using weighted average for ${player.name}: ${weightedSG}`);
    return weightedSG;
  }

  // If we only have one type of data, check if it's the required type based on data source
  if (dataSource === 'pga' && (seasonSgTotal === null || seasonSgTotal === undefined)) {
    console.log(`[SG Heavy Debug] PGA data source selected but no PGA season data for ${player.name}, excluding`);
    return -999; // Exclude player when PGA data source is required but missing
  }
  
  if (dataSource === 'datagolf' && (seasonSgTotal === null || seasonSgTotal === undefined)) {
    console.log(`[SG Heavy Debug] DataGolf data source selected but no DataGolf season data for ${player.name}, excluding`);
    return -999; // Exclude player when DataGolf data source is required but missing
  }

  // If we only have one type of data and it's allowed, use that
  if (tournamentSgTotal !== null && tournamentSgTotal !== undefined) {
    console.log(`[SG Heavy Debug] Only tournament data available for ${player.name}: ${tournamentSgTotal}`);
    return tournamentSgTotal;
  }
  if (seasonSgTotal !== null && seasonSgTotal !== undefined) {
    console.log(`[SG Heavy Debug] Only season data available for ${player.name}: ${seasonSgTotal}`);
    return seasonSgTotal;
  }

  // No valid data
  console.log(`[SG Heavy Debug] No valid SG data for ${player.name}, excluding`);
  return -999;
}

/**
 * Calculate the season SG value that should be displayed based on data source
 */
function calculateSeasonSGForDisplay(
  player: Player,
  options?: SGHeavyOptions
): number | null {
  const dataSource = options?.seasonDataSource || 'pga';
  
  switch (dataSource) {
    case 'pga':
      return player.season_sg_total ?? null;
    case 'datagolf':
      return player.dgSeasonSgTotal ?? null;
    case 'aggregate':
      // If both sources available, use average
      if (player.season_sg_total !== null && player.season_sg_total !== undefined &&
          player.dgSeasonSgTotal !== null && player.dgSeasonSgTotal !== undefined) {
        return (player.season_sg_total + player.dgSeasonSgTotal) / 2;
      } else {
        // Otherwise use whichever is available
        return player.season_sg_total ?? player.dgSeasonSgTotal ?? null;
      }
    default:
      return player.season_sg_total ?? null;
  }
}

/**
 * Get description of how SG was calculated from Player data
 */
function getSGCalculationMethodFromPlayer(
  player: Player,
  inTournament: boolean,
  options?: SGHeavyOptions
): string {
  const dataSource = options?.seasonDataSource || 'pga';
  const hasTournamentSG = typeof player.sgTotal === 'number';
  const hasSeasonSG = dataSource === 'pga' ? 
    typeof player.season_sg_total === 'number' :
    dataSource === 'datagolf' ?
      typeof player.dgSeasonSgTotal === 'number' :
      typeof player.season_sg_total === 'number' || typeof player.dgSeasonSgTotal === 'number';

  if (hasTournamentSG && hasSeasonSG && inTournament) {
    return 'weighted';
  }
  if (hasTournamentSG) {
    return 'tournament-only';
  }
  if (hasSeasonSG) {
    return `season-only (${dataSource})`;
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

function filterPlayersByMinSgThreshold(
  players: Player[],
  minSgThreshold: number,
  inTournament: boolean,
  tournamentWeight: number,
  options?: SGHeavyOptions
): Player[] {
  return players.filter(player => {
    const weightedSg = calculateWeightedSGFromPlayer(player, inTournament, tournamentWeight, options);
    return weightedSg >= minSgThreshold;
  });
}

function filterPlayersByOddsGap(
  players: Player[],
  minOddsGap: number,
  maxOdds: number | undefined,
  includeUnderdogs: boolean
): Player[] {
  return players.filter(player => {
    // Skip players with no odds
    if (!player.odds) return false;
    
    // Apply max odds filter if specified
    if (maxOdds && player.odds > maxOdds) return false;
    
    // Get all players in the same matchup
    const matchupPlayers = players.filter(p => p.matchupId === player.matchupId);
    
    // Skip if we can't find the matchup
    if (matchupPlayers.length < 2) return false;
    
    // Sort by odds ascending (lowest/best odds first)
    const sortedByOdds = [...matchupPlayers].sort((a, b) => {
      if (!a.odds || !b.odds) return 0;
      return a.odds - b.odds;
    });
    
    // Get odds gap between this player and the favorite
    const favorite = sortedByOdds[0];
    const favoriteOdds = favorite.odds || 0;
    const playerOdds = player.odds;
    const oddsGap = playerOdds - favoriteOdds;
    
    // If player is the favorite, check if gap to next player is sufficient
    if (player === favorite) {
      const nextBestOdds = sortedByOdds[1].odds || 0;
      return (nextBestOdds - playerOdds) >= minOddsGap;
    }
    
    // If not the favorite and underdogs not allowed, filter out
    if (!includeUnderdogs) return false;
    
    // For underdogs, check if gap to favorite is within threshold
    return oddsGap <= minOddsGap;
  });
}

function sortPlayersByCriteria(
  players: Player[],
  sortBy: 'sg' | 'odds-gap' | 'composite',
  inTournament: boolean,
  tournamentWeight: number,
  options?: SGHeavyOptions
): Player[] {
  return [...players].sort((a, b) => {
    if (sortBy === 'sg') {
      const aWeightedSg = calculateWeightedSGFromPlayer(a, inTournament, tournamentWeight, options);
      const bWeightedSg = calculateWeightedSGFromPlayer(b, inTournament, tournamentWeight, options);
      return bWeightedSg - aWeightedSg;
    }
    
    if (sortBy === 'odds-gap') {
      const aOdds = a.odds || 0;
      const bOdds = b.odds || 0;
      return aOdds - bOdds;
    }
    
    // Composite sort (weighted SG + odds gap)
    const aWeightedSg = calculateWeightedSGFromPlayer(a, inTournament, tournamentWeight, options);
    const bWeightedSg = calculateWeightedSGFromPlayer(b, inTournament, tournamentWeight, options);
    const aOdds = a.odds || 0;
    const bOdds = b.odds || 0;
    
    // Normalize SG and odds to 0-1 range for fair comparison
    const maxSg = Math.max(aWeightedSg, bWeightedSg);
    const minSg = Math.min(aWeightedSg, bWeightedSg);
    const sgRange = maxSg - minSg || 1;
    
    const maxOdds = Math.max(aOdds, bOdds);
    const minOdds = Math.min(aOdds, bOdds);
    const oddsRange = maxOdds - minOdds || 1;
    
    const aNormalizedSg = (aWeightedSg - minSg) / sgRange;
    const bNormalizedSg = (bWeightedSg - minSg) / sgRange;
    const aNormalizedOdds = 1 - ((aOdds - minOdds) / oddsRange);
    const bNormalizedOdds = 1 - ((bOdds - minOdds) / oddsRange);
    
    // Weight SG more heavily than odds in composite score
    const aComposite = (aNormalizedSg * 0.7) + (aNormalizedOdds * 0.3);
    const bComposite = (bNormalizedSg * 0.7) + (bNormalizedOdds * 0.3);
    
    return bComposite - aComposite;
  });
} 
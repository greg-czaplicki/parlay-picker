import { MatchupRow, Supabase2BallMatchupRow, Supabase3BallMatchupRow } from '@/types/matchups';
import { PlayerStat } from '@/hooks/use-player-stats-query';
import { LiveTournamentStat } from '@/types/definitions';

export interface PlayerComparison {
  dgId: number;
  name: string;
  odds: number | null;
  dgOdds: number | null;
  // PGA Tour SG stats (current tournament/season)
  sgTotal: number | null;
  sgPutt: number | null;
  sgApp: number | null;
  sgArg: number | null;
  sgOtt: number | null;
  sgT2g: number | null;
  // DataGolf skill ratings
  dgSgTotal: number | null;
  dgSgPutt: number | null;
  dgSgApp: number | null;
  dgSgArg: number | null;
  dgSgOtt: number | null;
  position: number | null;
  todayScore: number | null;
  totalScore: number | null;
  seasonSgTotal: number | null;
}

export interface MatchupComparison {
  matchupId: number;
  type: '2ball' | '3ball';
  players: PlayerComparison[];
  analysis: {
    hasOddsGap: boolean;
    oddsGapSize: number;
    oddsLeader: string | null;
    hasOddsSgMismatch: boolean;
    sgLeader: string | null;
    sgGapSize: number;
    sgCategoryDominance: { player: string; categories: number } | null;
    hasPuttingEdge: boolean;
    puttingEdgePlayer: string | null;
    puttingGapSize: number;
    hasBallStrikingEdge: boolean;
    ballStrikingEdgePlayer: string | null;
    ballStrikingGapSize: number;
    hasPositionMismatch: boolean;
    formLeader: string | null;
    // DataGolf vs PGA Tour analysis
    dgLeader: string | null;
    dgGapSize: number;
    hasDataSourceDisagreement: boolean;
    dataSourceDisagreementType: 'mild' | 'strong' | null;
    hasDataConsensus: boolean;
    dgAdvantagePlayer: string | null;
    dgAdvantageSize: number;
  };
}

// Helper function to convert decimal odds to American odds
function convertDecimalToAmerican(decimal: number): number {
  if (decimal <= 1.01) return 0; // Invalid odds
  
  if (decimal >= 2.0) {
    // Positive American odds: (decimal - 1) * 100
    return Math.round((decimal - 1) * 100);
  } else {
    // Negative American odds: -100 / (decimal - 1)
    return Math.round(-100 / (decimal - 1));
  }
}

export class MatchupComparisonEngine {
  private playerStats: Map<number, PlayerStat> = new Map();
  private tournamentStats: Map<number, LiveTournamentStat> = new Map();

  constructor(
    playerStats?: PlayerStat[],
    tournamentStats?: LiveTournamentStat[]
  ) {
    if (playerStats) {
      playerStats.forEach(stat => {
        // Handle both string and number player_id formats
        const dgId = typeof stat.player_id === 'string' ? parseInt(stat.player_id) : stat.player_id;
        if (!isNaN(dgId)) {
          this.playerStats.set(dgId, stat);
        }
      });
    }

    if (tournamentStats) {
      tournamentStats.forEach(stat => {
        this.tournamentStats.set(Number(stat.dg_id), stat);
      });
    }
  }

  analyzeMatchup(matchup: MatchupRow): MatchupComparison {
    const players = this.extractPlayers(matchup);
    const analysis = this.performAnalysis(players);

    return {
      matchupId: matchup.id,
      type: matchup.type as '2ball' | '3ball',
      players,
      analysis
    };
  }

  private extractPlayers(matchup: MatchupRow): PlayerComparison[] {
    const players: PlayerComparison[] = [];

    if (matchup.type === '3ball') {
      const m = matchup as Supabase3BallMatchupRow;
      players.push(this.createPlayerComparison(m.player1_dg_id, m.player1_name, m.odds1, m.dg_odds1, (m as any).player1_sg_data));
      players.push(this.createPlayerComparison(m.player2_dg_id, m.player2_name, m.odds2, m.dg_odds2, (m as any).player2_sg_data));
      if (m.player3_dg_id && m.player3_name) {
        players.push(this.createPlayerComparison(m.player3_dg_id, m.player3_name, m.odds3, m.dg_odds3, (m as any).player3_sg_data));
      }
    } else {
      const m = matchup as Supabase2BallMatchupRow;
      players.push(this.createPlayerComparison(m.player1_dg_id, m.player1_name, m.odds1, m.dg_odds1, (m as any).player1_sg_data));
      players.push(this.createPlayerComparison(m.player2_dg_id, m.player2_name, m.odds2, m.dg_odds2, (m as any).player2_sg_data));
    }

    return players;
  }

  private createPlayerComparison(dgId: number, name: string, odds: number | null, dgOdds: number | null, sgData?: any): PlayerComparison {
    const stats = this.playerStats.get(dgId);
    const tourneyStats = this.tournamentStats.get(dgId);

    // Get player name from stats if not provided in matchup
    const playerName = name || stats?.player_name || tourneyStats?.player_name || `Player ${dgId}`;

    // Use season stats for SG (more reliable), tournament stats for position/scores
    const comparison = {
      dgId,
      name: playerName,
      odds,
      dgOdds,
      // PGA Tour SG stats (from season/tournament data)
      sgTotal: stats?.sg_total ?? null, 
      sgPutt: stats?.sg_putt ?? null,
      sgApp: stats?.sg_app ?? null,
      sgArg: stats?.sg_arg ?? null,
      sgOtt: stats?.sg_ott ?? null,
      sgT2g: tourneyStats?.sg_t2g ?? null,
      // DataGolf skill ratings (from player_skill_ratings table)
      dgSgTotal: sgData?.seasonSgTotal ?? null,
      dgSgPutt: sgData?.seasonSgPutt ?? null,
      dgSgApp: sgData?.seasonSgApp ?? null,
      dgSgArg: sgData?.seasonSgArg ?? null,
      dgSgOtt: sgData?.seasonSgOtt ?? null,
      position: stats?.position ? this.parsePosition(stats.position) : null,
      todayScore: stats?.today ?? null,
      totalScore: stats?.total ?? tourneyStats?.total ?? null,
      seasonSgTotal: stats?.season_sg_total ?? null
    };

    return comparison;
  }

  private parsePosition(position: string): number | null {
    if (!position) return null;
    const match = position.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  private performAnalysis(players: PlayerComparison[]): MatchupComparison['analysis'] {
    // Odds analysis
    const oddsAnalysis = this.analyzeOdds(players);
    
    // SG analysis (PGA Tour)
    const sgAnalysis = this.analyzeSG(players);
    
    // DataGolf analysis
    const dgAnalysis = this.analyzeDataGolf(players);
    
    // Data source comparison
    const dataSourceAnalysis = this.analyzeDataSourceDisagreement(players);
    
    // Form analysis
    const formAnalysis = this.analyzeForm(players);

    return {
      ...oddsAnalysis,
      ...sgAnalysis,
      ...dgAnalysis,
      ...dataSourceAnalysis,
      ...formAnalysis
    };
  }

  private analyzeOdds(players: PlayerComparison[]) {
    const playersWithOdds = players.filter(p => p.odds !== null);
    
    if (playersWithOdds.length < 2) {
      return {
        hasOddsGap: false,
        oddsGapSize: 0,
        oddsLeader: null,
        hasOddsSgMismatch: false
      };
    }

    // Sort by odds (lower is better/favorite)  
    const sortedByOdds = [...playersWithOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
    const favorite = sortedByOdds[0];
    const underdog = sortedByOdds[sortedByOdds.length - 1]; // Worst odds = biggest underdog
    const oddsGapSize = Math.abs((underdog.odds ?? 0) - (favorite.odds ?? 0));

    // Check for SG mismatch (favorite has worse SG than underdog)
    const playersWithSG = players.filter(p => p.sgTotal !== null);
    let hasOddsSgMismatch = false;
    
    if (playersWithSG.length >= 2) {
      const sortedBySG = [...playersWithSG].sort((a, b) => (b.sgTotal ?? 0) - (a.sgTotal ?? 0));
      const sgLeader = sortedBySG[0];
      hasOddsSgMismatch = favorite.dgId !== sgLeader.dgId && favorite.sgTotal !== null && sgLeader.sgTotal !== null && favorite.sgTotal < sgLeader.sgTotal;
    }

    // Convert to American odds for more intuitive gap checking
    const favoriteAmerican = convertDecimalToAmerican(favorite.odds ?? 0);
    const underdogAmerican = convertDecimalToAmerican(underdog.odds ?? 0);
    const americanGap = Math.abs(underdogAmerican - favoriteAmerican);
    
    return {
      hasOddsGap: americanGap >= 5, // 5 American odds points or more (e.g., +100 vs +105)
      oddsGapSize, // Keep decimal for compatibility
      oddsLeader: favorite.name,
      hasOddsSgMismatch
    };
  }

  private analyzeSG(players: PlayerComparison[]) {
    // Check for DataGolf SG data first (prefer it when available)
    const playersWithDgSG = players.filter(p => (p as any).dgSgTotal !== null);
    const playersWithPgaSG = players.filter(p => p.sgTotal !== null);
    
    // Determine which SG data to use - prefer DataGolf if most/all players have it
    let playersWithSG: PlayerComparison[];
    let sgProperty: string;
    
    if (playersWithDgSG.length >= playersWithPgaSG.length && playersWithDgSG.length >= 2) {
      // Use DataGolf data if it's more complete or equal
      playersWithSG = playersWithDgSG;
      sgProperty = 'dgSgTotal';
    } else if (playersWithPgaSG.length >= 2) {
      // Fall back to PGA Tour data
      playersWithSG = playersWithPgaSG;
      sgProperty = 'sgTotal';
    } else {
      // Not enough data from either source
      return {
        sgLeader: null,
        sgGapSize: 0,
        sgCategoryDominance: null,
        hasPuttingEdge: false,
        puttingEdgePlayer: null,
        puttingGapSize: 0,
        hasBallStrikingEdge: false,
        ballStrikingEdgePlayer: null,
        ballStrikingGapSize: 0
      };
    }

    // SG Total analysis using the preferred data source
    const sortedBySG = [...playersWithSG].sort((a, b) => {
      const aValue = sgProperty === 'dgSgTotal' ? (a as any).dgSgTotal : a.sgTotal;
      const bValue = sgProperty === 'dgSgTotal' ? (b as any).dgSgTotal : b.sgTotal;
      return (bValue ?? 0) - (aValue ?? 0);
    });
    const sgLeader = sortedBySG[0];
    
    // Find first player with different SG Total (handles ties)
    let sgGapSize = 0;
    for (let i = 1; i < sortedBySG.length; i++) {
      const competitor = sortedBySG[i];
      const leaderValue = sgProperty === 'dgSgTotal' ? (sgLeader as any).dgSgTotal : sgLeader.sgTotal;
      const competitorValue = sgProperty === 'dgSgTotal' ? (competitor as any).dgSgTotal : competitor.sgTotal;
      const gap = Math.abs((leaderValue ?? 0) - (competitorValue ?? 0));
      if (gap > 0.01) { // Meaningful difference (more than rounding error)
        sgGapSize = gap;
        break;
      }
    }

    // Category dominance
    const categoryDominance = this.analyzeCategoryDominance(players);

    // Putting edge - prefer DataGolf data if available
    const puttingAnalysis = this.analyzeCategoryWithFallback(players, 'dgSgPutt', 'sgPutt', 0.3);
    
    // Ball striking edge (T2G or OTT if T2G not available)
    const ballStrikingAnalysis = this.analyzeBallStriking(players);

    return {
      sgLeader: sgLeader.name,
      sgGapSize,
      sgCategoryDominance: categoryDominance,
      hasPuttingEdge: puttingAnalysis.hasEdge,
      puttingEdgePlayer: puttingAnalysis.edgePlayer,
      puttingGapSize: puttingAnalysis.gapSize,
      hasBallStrikingEdge: ballStrikingAnalysis.hasEdge,
      ballStrikingEdgePlayer: ballStrikingAnalysis.edgePlayer,
      ballStrikingGapSize: ballStrikingAnalysis.gapSize
    };
  }

  private analyzeCategoryDominance(players: PlayerComparison[]) {
    const pgaCategories = ['sgPutt', 'sgApp', 'sgArg', 'sgOtt'] as const;
    const dgCategories = ['dgSgPutt', 'dgSgApp', 'dgSgArg', 'dgSgOtt'] as const;
    const dominanceScore = new Map<string, { categories: number; totalGap: number }>();
    const MINIMUM_GAP = 0.05; // Require at least 0.05 SG advantage to count as "dominance"

    // Check if ALL players have complete DataGolf SG data (all 4 categories)
    const playersWithCompleteDgSG = players.filter(p => 
      (p as any).dgSgPutt !== null && (p as any).dgSgApp !== null && 
      (p as any).dgSgArg !== null && (p as any).dgSgOtt !== null
    );

    // Check if ALL players have complete PGA Tour SG data (all 4 categories)
    const playersWithCompletePgaSG = players.filter(p => 
      p.sgPutt !== null && p.sgApp !== null && p.sgArg !== null && p.sgOtt !== null
    );

    // Prefer DataGolf data if available for all players, otherwise use PGA Tour data
    let categoriesToUse: readonly string[];
    let playersToAnalyze: PlayerComparison[];
    
    if (playersWithCompleteDgSG.length === players.length) {
      categoriesToUse = dgCategories;
      playersToAnalyze = playersWithCompleteDgSG;
    } else if (playersWithCompletePgaSG.length === players.length) {
      categoriesToUse = pgaCategories;
      playersToAnalyze = playersWithCompletePgaSG;
    } else {
      // Not enough complete data from either source
      return null;
    }

    categoriesToUse.forEach(category => {
      const playersWithStat = playersToAnalyze.filter(p => {
        const value = category.startsWith('dg') ? (p as any)[category] : p[category as keyof PlayerComparison];
        return value !== null;
      });
      
      if (playersWithStat.length >= 2) {
        const sorted = [...playersWithStat].sort((a, b) => {
          const aValue = category.startsWith('dg') ? (a as any)[category] : a[category as keyof PlayerComparison];
          const bValue = category.startsWith('dg') ? (b as any)[category] : b[category as keyof PlayerComparison];
          return (bValue ?? 0) - (aValue ?? 0);
        });
        const leader = sorted[0];
        const secondBest = sorted[1];
        const leaderValue = category.startsWith('dg') ? (leader as any)[category] : leader[category as keyof PlayerComparison];
        const secondValue = category.startsWith('dg') ? (secondBest as any)[category] : secondBest[category as keyof PlayerComparison];
        const gap = (leaderValue ?? 0) - (secondValue ?? 0);
        
        // Only count as dominance if gap is meaningful
        if (gap >= MINIMUM_GAP) {
          const current = dominanceScore.get(leader.name) ?? { categories: 0, totalGap: 0 };
          dominanceScore.set(leader.name, {
            categories: current.categories + 1,
            totalGap: current.totalGap + gap
          });
        }
      }
    });

    let dominantPlayer = null;
    let maxCategories = 0;
    let bestTotalGap = 0;

    dominanceScore.forEach((score, player) => {
      // Prefer more categories, but use total gap as tiebreaker
      if (score.categories > maxCategories || 
          (score.categories === maxCategories && score.totalGap > bestTotalGap)) {
        maxCategories = score.categories;
        bestTotalGap = score.totalGap;
        dominantPlayer = player;
      }
    });

    return maxCategories >= 2 ? { player: dominantPlayer!, categories: maxCategories } : null;
  }

  private analyzeCategoryWithFallback(players: PlayerComparison[], primaryCategory: string, fallbackCategory: keyof PlayerComparison, threshold: number) {
    // Check which data source has better coverage
    const playersWithPrimary = players.filter(p => (p as any)[primaryCategory] !== null);
    const playersWithFallback = players.filter(p => p[fallbackCategory] !== null && typeof p[fallbackCategory] === 'number');
    
    // Prefer primary (DataGolf) if it has equal or better coverage
    if (playersWithPrimary.length >= playersWithFallback.length && playersWithPrimary.length >= 2) {
      return this.analyzeCategoryData(playersWithPrimary, primaryCategory, threshold, true);
    } else if (playersWithFallback.length >= 2) {
      return this.analyzeCategoryData(playersWithFallback, fallbackCategory, threshold, false);
    } else {
      return { hasEdge: false, edgePlayer: null, gapSize: 0 };
    }
  }

  private analyzeCategoryData(playersWithStat: PlayerComparison[], category: string | keyof PlayerComparison, threshold: number, isDataGolf: boolean) {
    if (playersWithStat.length < 2) {
      return { hasEdge: false, edgePlayer: null, gapSize: 0 };
    }

    const sorted = [...playersWithStat].sort((a, b) => {
      const aValue = isDataGolf ? (a as any)[category] : a[category as keyof PlayerComparison];
      const bValue = isDataGolf ? (b as any)[category] : b[category as keyof PlayerComparison];
      return (bValue ?? 0) - (aValue ?? 0);
    });

    const leader = sorted[0];
    const secondBest = sorted[1];
    const leaderValue = isDataGolf ? (leader as any)[category] : leader[category as keyof PlayerComparison];
    const secondValue = isDataGolf ? (secondBest as any)[category] : secondBest[category as keyof PlayerComparison];
    const gap = (leaderValue ?? 0) - (secondValue ?? 0);

    return {
      hasEdge: gap >= threshold,
      edgePlayer: gap >= threshold ? leader.name : null,
      gapSize: gap
    };
  }

  private analyzeCategory(players: PlayerComparison[], category: keyof PlayerComparison, threshold: number) {
    const playersWithStat = players.filter(p => p[category] !== null && typeof p[category] === 'number');
    
    if (playersWithStat.length < 2) {
      return { hasEdge: false, edgePlayer: null, gapSize: 0 };
    }

    const sorted = [...playersWithStat].sort((a, b) => (b[category] as number) - (a[category] as number));
    const leader = sorted[0];
    const secondBest = sorted[1];
    const gapSize = Math.abs((leader[category] as number) - (secondBest[category] as number));

    return {
      hasEdge: gapSize >= threshold,
      edgePlayer: leader.name,
      gapSize
    };
  }

  private analyzeBallStriking(players: PlayerComparison[]) {
    // Try T2G first (PGA Tour only - no DataGolf equivalent)
    const t2gPlayers = players.filter(p => p.sgT2g !== null);
    if (t2gPlayers.length >= 2) {
      return this.analyzeCategory(players, 'sgT2g', 0.5);
    }

    // Fallback to OTT - prefer DataGolf data if available
    return this.analyzeCategoryWithFallback(players, 'dgSgOtt', 'sgOtt', 0.5);
  }

  private analyzeForm(players: PlayerComparison[]) {
    const playersWithPosition = players.filter(p => p.position !== null);
    
    let hasPositionMismatch = false;
    let formLeader = null;

    // Check for position mismatch (lower ranked player favored)
    if (playersWithPosition.length >= 2) {
      const sortedByPosition = [...playersWithPosition].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));
      const sortedByOdds = [...playersWithPosition.filter(p => p.odds !== null)].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
      
      if (sortedByOdds.length > 0 && sortedByPosition.length > 0) {
        const oddsLeader = sortedByOdds[0];
        const positionLeader = sortedByPosition[0];
        hasPositionMismatch = oddsLeader.dgId !== positionLeader.dgId && oddsLeader.position !== null && positionLeader.position !== null && oddsLeader.position > positionLeader.position;
      }
    }

    // Find form leader (best today's score)
    const playersWithToday = players.filter(p => p.todayScore !== null);
    if (playersWithToday.length > 0) {
      const sortedByToday = [...playersWithToday].sort((a, b) => (a.todayScore ?? 0) - (b.todayScore ?? 0));
      formLeader = sortedByToday[0].name;
    }

    return {
      hasPositionMismatch,
      formLeader
    };
  }

  private analyzeDataGolf(players: PlayerComparison[]) {
    const playersWithDgSG = players.filter(p => p.dgSgTotal !== null);
    
    if (playersWithDgSG.length < 2) {
      return {
        dgLeader: null,
        dgGapSize: 0
      };
    }

    // DataGolf SG analysis
    const sortedByDgSG = [...playersWithDgSG].sort((a, b) => (b.dgSgTotal ?? 0) - (a.dgSgTotal ?? 0));
    const dgLeader = sortedByDgSG[0];
    const secondBest = sortedByDgSG[1];
    const dgGapSize = (dgLeader.dgSgTotal ?? 0) - (secondBest.dgSgTotal ?? 0);

    return {
      dgLeader: dgLeader.name,
      dgGapSize
    };
  }

  private analyzeDataSourceDisagreement(players: PlayerComparison[]) {
    const playersWithBothSG = players.filter(p => p.sgTotal !== null && p.dgSgTotal !== null);
    
    if (playersWithBothSG.length < 2) {
      return {
        hasDataSourceDisagreement: false,
        dataSourceDisagreementType: null,
        hasDataConsensus: false,
        dgAdvantagePlayer: null,
        dgAdvantageSize: 0
      };
    }

    // Rank players by each data source
    const pgaRanking = [...playersWithBothSG].sort((a, b) => (b.sgTotal ?? 0) - (a.sgTotal ?? 0));
    const dgRanking = [...playersWithBothSG].sort((a, b) => (b.dgSgTotal ?? 0) - (a.dgSgTotal ?? 0));

    // Check if leaders are different
    const pgaLeader = pgaRanking[0];
    const dgLeader = dgRanking[0];
    const hasLeaderDisagreement = pgaLeader.dgId !== dgLeader.dgId;

    // Calculate disagreement strength
    let disagreementType: 'mild' | 'strong' | null = null;
    let dgAdvantagePlayer: string | null = null;
    let dgAdvantageSize = 0;

    if (hasLeaderDisagreement) {
      // Find how much DataGolf disagrees with PGA Tour ranking
      const pgaLeaderDgSg = pgaLeader.dgSgTotal ?? 0;
      const dgLeaderDgSg = dgLeader.dgSgTotal ?? 0;
      const pgaLeaderPgaSg = pgaLeader.sgTotal ?? 0;
      const dgLeaderPgaSg = dgLeader.sgTotal ?? 0;

      // DataGolf advantage: how much better DG rates their leader vs PGA's leader
      dgAdvantageSize = dgLeaderDgSg - pgaLeaderDgSg;
      
      if (dgAdvantageSize > 0.2) {
        disagreementType = 'strong';
        dgAdvantagePlayer = dgLeader.name;
      } else if (dgAdvantageSize > 0.1) {
        disagreementType = 'mild';
        dgAdvantagePlayer = dgLeader.name;
      }
    }

    // Check for consensus (both sources agree on leader)
    const hasDataConsensus = !hasLeaderDisagreement && playersWithBothSG.length >= 2;

    return {
      hasDataSourceDisagreement: hasLeaderDisagreement,
      dataSourceDisagreementType: disagreementType,
      hasDataConsensus,
      dgAdvantagePlayer,
      dgAdvantageSize: Math.abs(dgAdvantageSize)
    };
  }

}
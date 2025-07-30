import { createServerClient } from "@/lib/supabase";
import { logger } from '@/lib/logger';

/**
 * Comprehensive snapshot data captured at bet placement time
 */
export interface BetSnapshot {
  // Betting context
  bet_timestamp: string;
  round_num: number | null;
  event_name: string | null;
  
  // Matchup data at bet time
  matchup: {
    id: number;
    type: '2ball' | '3ball';
    event_id: number;
    round_num: number;
    tee_time: string | null;
    players: {
      position: 1 | 2 | 3;
      dg_id: number;
      name: string;
      fanduel_odds: number | null;
      draftkings_odds: number | null;
      dg_odds: number | null;
    }[];
  };
  
  // Player stats at bet time (from player_skill_ratings)
  player_stats: {
    [dg_id: number]: {
      sg_total: number | null;
      sg_ott: number | null;
      sg_app: number | null;
      sg_arg: number | null;
      sg_putt: number | null;
      driving_acc: number | null;
      driving_dist: number | null;
      data_golf_updated_at: string | null;
    };
  };
  
  // Live tournament stats at bet time (if available)
  live_stats: {
    [dg_id: number]: {
      position: string | null;
      total: number | null;
      today: number | null;
      thru: number | null;
      sg_total: number | null;
      sg_ott: number | null;
      sg_app: number | null;
      sg_putt: number | null;
      data_golf_updated_at: string | null;
    };
  } | null;
  
  // Calculated features at bet time
  calculated_features: {
    picked_player: {
      dg_id: number;
      name: string;
      position_in_matchup: 1 | 2 | 3;
      implied_probability: number | null;
      value_rating: number | null;
      confidence_score: number | null;
    };
    group_analysis: {
      avg_sg_total: number | null;
      odds_spread: number | null;
      favorite_dg_id: number | null;
      underdog_dg_id: number | null;
    };
  };
}

/**
 * Service for capturing comprehensive feature snapshots at bet placement time
 */
export class SnapshotService {
  private supabase = createServerClient();
  
  /**
   * Captures a comprehensive snapshot when a parlay pick is created
   * @param parlayPickId - UUID of the newly created parlay pick
   * @param matchupId - UUID of the matchup being bet on
   * @param pickedPlayerPosition - Position (1, 2, or 3) of the picked player
   * @returns Promise with success/error result
   */
  async captureSnapshot(
    parlayPickId: string,
    matchupId: string, 
    pickedPlayerPosition: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`[SnapshotService] Capturing snapshot for parlay_pick ${parlayPickId}`);
      
      // 1. Get matchup data
      const { data: matchup, error: matchupError } = await this.supabase
        .from('betting_markets')
        .select('*')
        .eq('id', matchupId)
        .single();
        
      if (matchupError || !matchup) {
        throw new Error(`Failed to fetch matchup: ${matchupError?.message}`);
      }
      
      // 2. Extract player IDs from matchup
      const playerIds = [
        matchup.player1_dg_id,
        matchup.player2_dg_id,
        matchup.player3_dg_id
      ].filter(id => id !== null);
      
      if (playerIds.length === 0) {
        throw new Error(`No valid player IDs found in matchup ${matchupId}`);
      }
      
      // 3. Get player skill ratings
      const { data: playerStats, error: statsError } = await this.supabase
        .from('player_skill_ratings')
        .select('*')
        .in('dg_id', playerIds);
        
      if (statsError) {
        logger.warn(`[SnapshotService] Error fetching player stats: ${statsError.message}`);
      }
      
      // 4. Get live tournament stats (if available)
      let liveStats: any[] = [];
      if (matchup.round_num) {
        const { data: liveData, error: liveError } = await this.supabase
          .from('live_tournament_stats')
          .select('*')
          .in('dg_id', playerIds)
          .eq('round_num', String(matchup.round_num));
          
        if (liveError) {
          logger.warn(`[SnapshotService] Error fetching live stats: ${liveError.message}`);
        } else {
          liveStats = liveData || [];
        }
      }
      
      // 5. Build the comprehensive snapshot
      const snapshot = await this.buildSnapshot(
        matchup, 
        playerStats || [], 
        liveStats, 
        pickedPlayerPosition
      );
      
      // 6. Save snapshot to database
      const { error: insertError } = await this.supabase
        .from('bet_snapshots')
        .insert({
          parlay_pick_id: parlayPickId,
          snapshot: snapshot
        });
        
      if (insertError) {
        throw new Error(`Failed to save snapshot: ${insertError.message}`);
      }
      
      logger.info(`[SnapshotService] Successfully captured snapshot for parlay_pick ${parlayPickId}`);
      return { success: true };
      
    } catch (error) {
      logger.error(`[SnapshotService] Error capturing snapshot:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Builds a comprehensive snapshot object from the gathered data
   */
  private async buildSnapshot(
    matchup: any,
    playerStats: any[],
    liveStats: any[],
    pickedPlayerPosition: number
  ): Promise<BetSnapshot> {
    // Helper to get stats for a player
    const getPlayerStats = (dgId: number) => {
      return playerStats.find(s => s.dg_id === dgId);
    };
    
    const getLiveStats = (dgId: number) => {
      return liveStats.find(s => s.dg_id === dgId);
    };
    
    // Build players array with comprehensive data
    const players = [];
    const playerStatsMap: { [dg_id: number]: any } = {};
    const liveStatsMap: { [dg_id: number]: any } = {};
    
    // Player 1
    if (matchup.player1_dg_id) {
      const stats = getPlayerStats(matchup.player1_dg_id);
      const live = getLiveStats(matchup.player1_dg_id);
      
      players.push({
        position: 1 as const,
        dg_id: matchup.player1_dg_id,
        name: matchup.player1_name,
        fanduel_odds: matchup.odds1,
        draftkings_odds: matchup.dg_odds1,
        dg_odds: matchup.dg_odds1
      });
      
      if (stats) playerStatsMap[matchup.player1_dg_id] = this.formatPlayerStats(stats);
      if (live) liveStatsMap[matchup.player1_dg_id] = this.formatLiveStats(live);
    }
    
    // Player 2
    if (matchup.player2_dg_id) {
      const stats = getPlayerStats(matchup.player2_dg_id);
      const live = getLiveStats(matchup.player2_dg_id);
      
      players.push({
        position: 2 as const,
        dg_id: matchup.player2_dg_id,
        name: matchup.player2_name,
        fanduel_odds: matchup.odds2,
        draftkings_odds: matchup.dg_odds2,
        dg_odds: matchup.dg_odds2
      });
      
      if (stats) playerStatsMap[matchup.player2_dg_id] = this.formatPlayerStats(stats);
      if (live) liveStatsMap[matchup.player2_dg_id] = this.formatLiveStats(live);
    }
    
    // Player 3 (if 3-ball)
    if (matchup.player3_dg_id) {
      const stats = getPlayerStats(matchup.player3_dg_id);
      const live = getLiveStats(matchup.player3_dg_id);
      
      players.push({
        position: 3 as const,
        dg_id: matchup.player3_dg_id,
        name: matchup.player3_name,
        fanduel_odds: matchup.odds3,
        draftkings_odds: matchup.dg_odds3,
        dg_odds: matchup.dg_odds3
      });
      
      if (stats) playerStatsMap[matchup.player3_dg_id] = this.formatPlayerStats(stats);
      if (live) liveStatsMap[matchup.player3_dg_id] = this.formatLiveStats(live);
    }
    
    // Calculate features
    const pickedPlayer = players.find(p => p.position === pickedPlayerPosition);
    if (!pickedPlayer) {
      throw new Error(`Invalid picked player position: ${pickedPlayerPosition}`);
    }
    
    const calculatedFeatures = this.calculateFeatures(players, pickedPlayer, playerStatsMap);
    
    return {
      bet_timestamp: new Date().toISOString(),
      round_num: matchup.round_num,
      event_name: matchup.event_name || null,
      matchup: {
        id: matchup.id,
        type: matchup.type,
        event_id: matchup.event_id,
        round_num: matchup.round_num,
        tee_time: matchup.tee_time,
        players
      },
      player_stats: playerStatsMap,
      live_stats: Object.keys(liveStatsMap).length > 0 ? liveStatsMap : null,
      calculated_features: calculatedFeatures
    };
  }
  
  private formatPlayerStats(stats: any) {
    return {
      sg_total: stats.sg_total ? Number(stats.sg_total) : null,
      sg_ott: stats.sg_ott ? Number(stats.sg_ott) : null,
      sg_app: stats.sg_app ? Number(stats.sg_app) : null,
      sg_arg: stats.sg_arg ? Number(stats.sg_arg) : null,
      sg_putt: stats.sg_putt ? Number(stats.sg_putt) : null,
      driving_acc: stats.driving_acc ? Number(stats.driving_acc) : null,
      driving_dist: stats.driving_dist ? Number(stats.driving_dist) : null,
      data_golf_updated_at: stats.data_golf_updated_at
    };
  }
  
  private formatLiveStats(stats: any) {
    return {
      position: stats.position,
      total: stats.total ? Number(stats.total) : null,
      today: stats.today ? Number(stats.today) : null,
      thru: stats.thru ? Number(stats.thru) : null,
      sg_total: stats.sg_total ? Number(stats.sg_total) : null,
      sg_ott: stats.sg_ott ? Number(stats.sg_ott) : null,
      sg_app: stats.sg_app ? Number(stats.sg_app) : null,
      sg_putt: stats.sg_putt ? Number(stats.sg_putt) : null,
      data_golf_updated_at: stats.data_golf_updated_at
    };
  }
  
  private calculateFeatures(players: any[], pickedPlayer: any, playerStatsMap: any) {
    // Calculate implied probabilities from odds
    const americanToDecimal = (odds: number) => {
      if (odds > 0) return odds / 100 + 1;
      if (odds < 0) return 100 / Math.abs(odds) + 1;
      return 1;
    };
    
    const decimalToImpliedProbability = (decimal: number) => {
      return decimal <= 1 ? 0 : 1 / decimal;
    };
    
    // Use FanDuel odds for calculations (fallback to DK)
    const pickedOdds = pickedPlayer.fanduel_odds || pickedPlayer.draftkings_odds;
    const impliedProbability = pickedOdds ? 
      decimalToImpliedProbability(americanToDecimal(pickedOdds)) : null;
    
    // Calculate group metrics
    const sgTotals = players
      .map(p => playerStatsMap[p.dg_id]?.sg_total)
      .filter(sg => sg !== null && sg !== undefined);
    
    const avgSgTotal = sgTotals.length > 0 ? 
      sgTotals.reduce((sum, sg) => sum + sg, 0) / sgTotals.length : null;
    
    // Find favorite/underdog based on odds
    const playersWithOdds = players
      .map(p => ({
        ...p,
        odds: p.fanduel_odds || p.draftkings_odds
      }))
      .filter(p => p.odds !== null);
    
    let favoriteDgId = null;
    let underdogDgId = null;
    let oddsSpread = null;
    
    if (playersWithOdds.length > 0) {
      // Lower odds = favorite
      const sortedByOdds = playersWithOdds.sort((a, b) => Math.abs(a.odds) - Math.abs(b.odds));
      favoriteDgId = sortedByOdds[0].dg_id;
      underdogDgId = sortedByOdds[sortedByOdds.length - 1].dg_id;
      oddsSpread = Math.abs(sortedByOdds[sortedByOdds.length - 1].odds) - Math.abs(sortedByOdds[0].odds);
    }
    
    return {
      picked_player: {
        dg_id: pickedPlayer.dg_id,
        name: pickedPlayer.name,
        position_in_matchup: pickedPlayer.position,
        implied_probability: impliedProbability,
        value_rating: null, // TODO: Implement value calculation
        confidence_score: null // TODO: Implement confidence calculation
      },
      group_analysis: {
        avg_sg_total: avgSgTotal,
        odds_spread: oddsSpread,
        favorite_dg_id: favoriteDgId,
        underdog_dg_id: underdogDgId
      }
    };
  }
}

// Export singleton instance
export const snapshotService = new SnapshotService(); 
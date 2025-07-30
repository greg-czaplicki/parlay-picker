/**
 * SG Momentum Tracking Service
 * Analyzes real-time SG performance trends during tournaments
 */

import { createSupabaseClient } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { SGMomentumIndicator, SGCategory } from '../types/course-dna';

export interface MomentumAnalysisConfig {
  minRoundsForTrend: number;          // Minimum rounds to establish trend
  significanceThreshold: number;      // Z-score threshold for significance
  trendStrengthWeighting: number;     // How much to weight recent vs older data
  alertThreshold: number;             // Threshold for generating alerts
}

export interface PlayerSeasonBaseline {
  dg_id: number;
  player_name: string;
  sg_ott_avg: number;
  sg_app_avg: number;
  sg_arg_avg: number;
  sg_putt_avg: number;
  sg_total_avg: number;
  rounds_counted: number;
}

export interface TournamentRoundData {
  dg_id: number;
  player_name: string;
  event_name: string;
  round_num: number;
  sg_ott: number | null;
  sg_app: number | null;
  sg_arg: number | null;
  sg_putt: number | null;
  sg_total: number | null;
  data_golf_updated_at: string;
}

export class SGMomentumService {
  private _supabase: any = null;
  private config: MomentumAnalysisConfig;
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createSupabaseClient();
    }
    return this._supabase;
  }

  constructor(config?: Partial<MomentumAnalysisConfig>) {
    this.config = {
      minRoundsForTrend: 2,           // Need at least 2 rounds
      significanceThreshold: 1.5,     // 1.5 standard deviations
      trendStrengthWeighting: 0.7,    // Recent rounds weighted 70%
      alertThreshold: 2.0,            // 2 std devs for alerts
      ...config
    };
  }

  /**
   * 🎯 CORE: Analyze momentum for a specific player in current tournament
   */
  async analyzePlayerMomentum(dgId: number, eventName: string): Promise<SGMomentumIndicator | null> {
    logger.info(`Analyzing momentum for player ${dgId} in ${eventName}`);

    try {
      // Get player's season baseline
      const baseline = await this.getPlayerSeasonBaseline(dgId);
      if (!baseline) {
        logger.warn(`No season baseline found for player ${dgId}`);
        return null;
      }

      // Get tournament round data
      const roundData = await this.getTournamentRoundData(dgId, eventName);
      if (roundData.length < this.config.minRoundsForTrend) {
        logger.info(`Insufficient rounds for momentum analysis: ${roundData.length}`);
        return null;
      }

      // Calculate momentum indicators for each category
      const momentumIndicators = {
        sg_ott: this.calculateCategoryMomentum('sg_ott', roundData, baseline.sg_ott_avg),
        sg_app: this.calculateCategoryMomentum('sg_app', roundData, baseline.sg_app_avg),
        sg_arg: this.calculateCategoryMomentum('sg_arg', roundData, baseline.sg_arg_avg),
        sg_putt: this.calculateCategoryMomentum('sg_putt', roundData, baseline.sg_putt_avg)
      };

      // Calculate overall momentum
      const overallMomentum = this.calculateOverallMomentum(roundData, baseline);
      const momentumDirection = this.determineMomentumDirection(roundData);

      // Detect significant changes
      const significantChanges = this.detectSignificantChanges(roundData, baseline);

      return {
        dg_id: dgId,
        player_name: baseline.player_name,
        event_name: eventName,
        current_round: Math.max(...roundData.map(r => r.round_num)),
        momentum_indicators: momentumIndicators,
        overall_momentum: overallMomentum,
        momentum_direction: momentumDirection,
        significant_changes: significantChanges
      };

    } catch (error) {
      logger.error(`Error analyzing momentum for player ${dgId}:`, error);
      return null;
    }
  }

  /**
   * 🏌️ Batch analyze momentum for all players in active tournaments
   */
  async analyzeBatchMomentum(eventNames?: string[]): Promise<SGMomentumIndicator[]> {
    logger.info('Starting batch momentum analysis');

    try {
      // Get active tournaments if not specified
      const targets = eventNames || await this.getActiveTournamentNames();
      if (targets.length === 0) {
        logger.info('No active tournaments found for momentum analysis');
        return [];
      }

      const results: SGMomentumIndicator[] = [];

      for (const eventName of targets) {
        // Get all players with data in this tournament
        const players = await this.getPlayersInTournament(eventName);
        logger.info(`Analyzing momentum for ${players.length} players in ${eventName}`);

        // Analyze each player
        for (const player of players) {
          const momentum = await this.analyzePlayerMomentum(player.dg_id, eventName);
          if (momentum) {
            results.push(momentum);
          }
        }
      }

      logger.info(`Completed batch momentum analysis: ${results.length} players analyzed`);
      return results;

    } catch (error) {
      logger.error('Error in batch momentum analysis:', error);
      return [];
    }
  }

  /**
   * 📊 Calculate momentum for a specific SG category
   */
  private calculateCategoryMomentum(
    category: 'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt',
    roundData: TournamentRoundData[],
    baseline: number
  ) {
    const values = roundData
      .map(r => r[category])
      .filter((val): val is number => val !== null)
      .filter(val => !isNaN(val));

    if (values.length < this.config.minRoundsForTrend) {
      return {
        current_trend: 'steady' as const,
        trend_strength: 0,
        rounds_trending: 0,
        vs_baseline: 0
      };
    }

    // Calculate trend metrics
    const recentAvg = this.calculateWeightedAverage(values);
    const vsBaseline = recentAvg - baseline;
    const trendStrength = Math.abs(vsBaseline) / Math.max(0.1, Math.abs(baseline));
    
    // Determine trend direction
    const currentTrend = this.determineTrend(values, baseline);
    
    return {
      current_trend: currentTrend,
      trend_strength: Math.min(1, trendStrength),
      rounds_trending: values.length,
      vs_baseline: vsBaseline
    };
  }

  /**
   * 📈 Calculate overall momentum score
   */
  private calculateOverallMomentum(roundData: TournamentRoundData[], baseline: PlayerSeasonBaseline): number {
    const recentSGTotal = roundData
      .map(r => r.sg_total)
      .filter((val): val is number => val !== null && !isNaN(val));

    if (recentSGTotal.length === 0) return 0;

    const weightedAvg = this.calculateWeightedAverage(recentSGTotal);
    const momentum = weightedAvg - baseline.sg_total_avg;
    
    // Clamp to -3 to +3 range
    return Math.max(-3, Math.min(3, momentum));
  }

  /**
   * 🎯 Determine momentum direction trend
   */
  private determineMomentumDirection(roundData: TournamentRoundData[]): 'accelerating' | 'maintaining' | 'decelerating' {
    const sgTotalValues = roundData
      .map(r => r.sg_total)
      .filter((val): val is number => val !== null && !isNaN(val));

    if (sgTotalValues.length < 2) return 'maintaining';

    // Calculate acceleration (change in trend)
    const firstHalf = sgTotalValues.slice(0, Math.ceil(sgTotalValues.length / 2));
    const secondHalf = sgTotalValues.slice(Math.floor(sgTotalValues.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = secondAvg - firstAvg;
    
    if (Math.abs(change) < 0.2) return 'maintaining';
    return change > 0 ? 'accelerating' : 'decelerating';
  }

  /**
   * 🚨 Detect significant pattern changes
   */
  private detectSignificantChanges(
    roundData: TournamentRoundData[], 
    baseline: PlayerSeasonBaseline
  ): SGMomentumIndicator['significant_changes'] {
    const changes: SGMomentumIndicator['significant_changes'] = [];
    const categories: Array<{ key: 'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt', baseline: number }> = [
      { key: 'sg_ott', baseline: baseline.sg_ott_avg },
      { key: 'sg_app', baseline: baseline.sg_app_avg },
      { key: 'sg_arg', baseline: baseline.sg_arg_avg },
      { key: 'sg_putt', baseline: baseline.sg_putt_avg }
    ];

    for (const category of categories) {
      const values = roundData
        .map(r => r[category.key])
        .filter((val): val is number => val !== null && !isNaN(val));

      if (values.length < 2) continue;

      const recentAvg = this.calculateWeightedAverage(values);
      const deviation = Math.abs(recentAvg - category.baseline);
      const significance = deviation / Math.max(0.1, Math.abs(category.baseline));

      if (significance > this.config.alertThreshold) {
        const changeType = recentAvg > category.baseline + 0.5 ? 'breakthrough' 
                        : recentAvg < category.baseline - 0.5 ? 'breakdown'
                        : 'return_to_form';

        changes.push({
          category: category.key,
          change_type: changeType,
          magnitude: significance,
          since_round: roundData[0].round_num
        });
      }
    }

    return changes;
  }

  /**
   * 📊 Calculate weighted average favoring recent data
   */
  private calculateWeightedAverage(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];

    let weightedSum = 0;
    let totalWeight = 0;

    values.forEach((value, index) => {
      // More weight to recent rounds
      const weight = Math.pow(this.config.trendStrengthWeighting, values.length - index - 1);
      weightedSum += value * weight;
      totalWeight += weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * 📈 Determine trend direction for a category
   */
  private determineTrend(values: number[], baseline: number): 'hot' | 'cold' | 'steady' {
    const recentAvg = this.calculateWeightedAverage(values);
    const deviation = recentAvg - baseline;
    const threshold = 0.3; // 0.3 strokes gained threshold

    if (deviation > threshold) return 'hot';
    if (deviation < -threshold) return 'cold';
    return 'steady';
  }

  /**
   * 🎯 Get player's season baseline from skill ratings
   */
  private async getPlayerSeasonBaseline(dgId: number): Promise<PlayerSeasonBaseline | null> {
    const { data, error } = await this.supabase
      .from('player_skill_ratings')
      .select(`
        dg_id, player_name,
        sg_ott, sg_app, sg_arg, sg_putt, sg_total,
        rounds
      `)
      .eq('dg_id', dgId)
      .order('rounds', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      logger.warn(`No skill ratings found for player ${dgId}`);
      return null;
    }

    const player = data[0];
    return {
      dg_id: player.dg_id,
      player_name: player.player_name,
      sg_ott_avg: player.sg_ott || 0,
      sg_app_avg: player.sg_app || 0,
      sg_arg_avg: player.sg_arg || 0,
      sg_putt_avg: player.sg_putt || 0,
      sg_total_avg: player.sg_total || 0,
      rounds_counted: player.rounds || 0
    };
  }

  /**
   * 🏆 Get tournament round data for a player
   */
  private async getTournamentRoundData(dgId: number, eventName: string): Promise<TournamentRoundData[]> {
    const { data, error } = await this.supabase
      .from('live_tournament_stats')
      .select(`
        dg_id, player_name, event_name, round_num,
        sg_ott, sg_app, sg_arg, sg_putt, sg_total,
        data_golf_updated_at
      `)
      .eq('dg_id', dgId)
      .eq('event_name', eventName)
      .not('sg_total', 'is', null)
      .order('round_num', { ascending: true });

    if (error) {
      logger.error(`Error fetching tournament data for player ${dgId}:`, error);
      return [];
    }

    return (data || []).map((row: any) => ({
      dg_id: row.dg_id,
      player_name: row.player_name,
      event_name: row.event_name,
      round_num: parseInt(row.round_num),
      sg_ott: row.sg_ott,
      sg_app: row.sg_app,
      sg_arg: row.sg_arg,
      sg_putt: row.sg_putt,
      sg_total: row.sg_total,
      data_golf_updated_at: row.data_golf_updated_at
    }));
  }

  /**
   * 🏌️ Get all players with data in a tournament
   */
  private async getPlayersInTournament(eventName: string): Promise<Array<{ dg_id: number; player_name: string }>> {
    const { data, error } = await this.supabase
      .from('live_tournament_stats')
      .select('dg_id, player_name')
      .eq('event_name', eventName)
      .not('sg_total', 'is', null);

    if (error) {
      logger.error(`Error fetching players for tournament ${eventName}:`, error);
      return [];
    }

    // Deduplicate players
    const uniquePlayers = new Map();
    (data || []).forEach((player: any) => {
      uniquePlayers.set(player.dg_id, { dg_id: player.dg_id, player_name: player.player_name });
    });

    return Array.from(uniquePlayers.values());
  }

  /**
   * 🏆 Get active tournament names
   */
  private async getActiveTournamentNames(): Promise<string[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await this.supabase
      .from('tournaments')
      .select('event_name')
      .lte('start_date', today)
      .gte('end_date', today);

    if (error) {
      logger.error('Error fetching active tournaments:', error);
      return [];
    }

    return (data || []).map((t: any) => t.event_name);
  }
} 
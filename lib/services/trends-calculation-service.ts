import { createSupabaseClient } from '@/lib/api-utils';

export interface TournamentResult {
  dg_id: number;
  player_name: string;
  event_id: number;
  final_position: number | null;
  total_score: number | null;
  made_cut: boolean;
  rounds_completed: number;
  round_1_score: number | null;
  round_2_score: number | null;
  round_3_score: number | null;
  round_4_score: number | null;
  tournaments?: {
    event_id: number;
    event_name: string;
    start_date: string;
  };
}

export interface PlayerTrend {
  dg_id: number;
  player_name: string;
  trend_type: string;
  trend_value: number;
  trend_period: string;
  trend_category: string;
  context_data: any;
  valid_until: Date;
}

export class TrendsCalculationService {
  private supabase = createSupabaseClient();

  async calculateAdvancedTrends(period: string = 'last_10'): Promise<PlayerTrend[]> {
    const periodCount = this.getPeriodCount(period);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (periodCount * 7)); // Approximate weeks

    // First get recent tournaments
    const { data: recentTournaments, error: tourError } = await this.supabase
      .from('tournaments')
      .select('event_id, event_name, start_date')
      .gte('start_date', cutoffDate.toISOString().split('T')[0])
      .order('start_date', { ascending: false });
    
    if (tourError) throw tourError;
    if (!recentTournaments || recentTournaments.length === 0) return [];
    
    const eventIds = recentTournaments.map(t => t.event_id);
    
    // Then get results for those tournaments
    const { data: results, error } = await this.supabase
      .from('tournament_results')
      .select('*')
      .in('event_id', eventIds);

    if (error) throw error;
    if (!results) return [];
    
    // Create a map of tournament info
    const tournamentMap = new Map(recentTournaments.map(t => [t.event_id, t]));
    
    // Add tournament info to each result
    const enrichedResults = results.map(result => ({
      ...result,
      tournaments: tournamentMap.get(result.event_id)
    }));

    // Group by player
    const playerGroups = this.groupResultsByPlayer(enrichedResults);
    const trends: PlayerTrend[] = [];

    for (const [dgId, playerResults] of playerGroups) {
      const recentResults = playerResults.slice(0, periodCount);
      if (recentResults.length < 3) continue; // Need minimum data

      const playerTrends = await this.calculatePlayerTrends(
        dgId,
        recentResults[0].player_name,
        recentResults,
        period
      );
      trends.push(...playerTrends);
    }

    return trends;
  }

  private getPeriodCount(period: string): number {
    switch (period) {
      case 'last_3': return 3;
      case 'last_5': return 5;
      case 'last_10': return 10;
      case 'season': return 25; // Approximate full season
      default: return 10;
    }
  }

  private groupResultsByPlayer(results: TournamentResult[]): Map<number, TournamentResult[]> {
    const groups = new Map<number, TournamentResult[]>();
    
    results.forEach(result => {
      if (!groups.has(result.dg_id)) {
        groups.set(result.dg_id, []);
      }
      groups.get(result.dg_id)!.push(result);
    });

    // Sort each player's results by date
    for (const [, playerResults] of groups) {
      playerResults.sort((a, b) => 
        new Date(b.tournaments?.start_date || '').getTime() - new Date(a.tournaments?.start_date || '').getTime()
      );
    }

    return groups;
  }

  private async calculatePlayerTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string
  ): Promise<PlayerTrend[]> {
    const trends: PlayerTrend[] = [];
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);

    // 1. Finishing Position Trends
    const finishTrends = this.calculateFinishingTrends(dgId, playerName, results, period, validUntil);
    trends.push(...finishTrends);

    // 2. Scoring Trends
    const scoringTrends = this.calculateScoringTrends(dgId, playerName, results, period, validUntil);
    trends.push(...scoringTrends);

    // 3. Consistency Trends
    const consistencyTrends = this.calculateConsistencyTrends(dgId, playerName, results, period, validUntil);
    trends.push(...consistencyTrends);

    // 4. Momentum Trends
    const momentumTrends = this.calculateMomentumTrends(dgId, playerName, results, period, validUntil);
    trends.push(...momentumTrends);

    return trends;
  }

  private calculateFinishingTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string,
    validUntil: Date
  ): PlayerTrend[] {
    const trends: PlayerTrend[] = [];
    
    // Top 10 streak
    let top10Streak = 0;
    for (const result of results) {
      if (result.final_position && result.final_position <= 10) {
        top10Streak++;
      } else {
        break;
      }
    }

    // Top 5 count
    const top5Count = results.filter(r => r.final_position && r.final_position <= 5).length;

    // Top 3 count
    const top3Count = results.filter(r => r.final_position && r.final_position <= 3).length;

    // Missed cut streak
    let missedCutStreak = 0;
    for (const result of results) {
      if (!result.made_cut) {
        missedCutStreak++;
      } else {
        break;
      }
    }

    // Made cut percentage
    const madeCutCount = results.filter(r => r.made_cut).length;
    const madeCutPercentage = (madeCutCount / results.length) * 100;

    if (top10Streak >= 2) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'top_10_streak',
        trend_value: top10Streak,
        trend_period: period,
        trend_category: 'hot',
        context_data: { tournaments_analyzed: results.length },
        valid_until: validUntil
      });
    }

    if (top5Count >= 2) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'top_5_frequency',
        trend_value: top5Count,
        trend_period: period,
        trend_category: 'hot',
        context_data: { tournaments_analyzed: results.length, percentage: (top5Count / results.length) * 100 },
        valid_until: validUntil
      });
    }

    if (missedCutStreak >= 2) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'missed_cut_streak',
        trend_value: missedCutStreak,
        trend_period: period,
        trend_category: 'cold',
        context_data: { tournaments_analyzed: results.length },
        valid_until: validUntil
      });
    }

    if (madeCutPercentage >= 80) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'cut_making_consistency',
        trend_value: Math.round(madeCutPercentage),
        trend_period: period,
        trend_category: 'consistent',
        context_data: { 
          tournaments_analyzed: results.length,
          cuts_made: madeCutCount 
        },
        valid_until: validUntil
      });
    }

    return trends;
  }

  private calculateScoringTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string,
    validUntil: Date
  ): PlayerTrend[] {
    const trends: PlayerTrend[] = [];
    const completedTournaments = results.filter(r => r.total_score && r.rounds_completed === 4);
    
    if (completedTournaments.length === 0) return trends;

    // Scoring average (total_score is now actual total score in v2 schema)
    const avgScore = completedTournaments.reduce((sum, r) => {
      const roundAverage = r.total_score! / 4; // Per round average
      return sum + roundAverage;
    }, 0) / completedTournaments.length;

    // Sub-70 average tournaments (tournaments where average per round < 70)
    const sub70Count = completedTournaments.filter(r => (r.total_score! / 4) < 70).length;

    // Sub-68 average tournaments (exceptional scoring)
    const sub68Count = completedTournaments.filter(r => (r.total_score! / 4) < 68).length;

    // Round analysis for consistent scoring
    const allRoundScores: number[] = [];
    completedTournaments.forEach(tournament => {
      if (tournament.round_1_score) allRoundScores.push(tournament.round_1_score);
      if (tournament.round_2_score) allRoundScores.push(tournament.round_2_score);
      if (tournament.round_3_score) allRoundScores.push(tournament.round_3_score);
      if (tournament.round_4_score) allRoundScores.push(tournament.round_4_score);
    });

    const sub70RoundsCount = allRoundScores.filter(score => score < 70).length;
    const sub70RoundsPercentage = allRoundScores.length > 0 ? (sub70RoundsCount / allRoundScores.length) * 100 : 0;

    // Advanced trend analysis
    const advancedTrends = this.calculateAdvancedScoringTrends(dgId, playerName, results, period, validUntil);
    trends.push(...advancedTrends);

    // Add scoring trends
    trends.push({
      dg_id: dgId,
      player_name: playerName,
      trend_type: 'scoring_average',
      trend_value: Math.round(avgScore * 100) / 100,
      trend_period: period,
      trend_category: avgScore < 70 ? 'hot' : avgScore > 72 ? 'cold' : 'consistent',
      context_data: {
        tournaments_analyzed: completedTournaments.length,
        best_average: Math.min(...completedTournaments.map(r => r.total_score! / 4)),
        worst_average: Math.max(...completedTournaments.map(r => r.total_score! / 4))
      },
      valid_until: validUntil
    });

    if (sub70Count > 0) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'sub_70_tournaments',
        trend_value: sub70Count,
        trend_period: period,
        trend_category: 'hot',
        context_data: {
          tournaments_analyzed: completedTournaments.length,
          percentage: (sub70Count / completedTournaments.length) * 100
        },
        valid_until: validUntil
      });
    }


    if (sub70RoundsPercentage >= 30) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'sub_70_rounds_percentage',
        trend_value: Math.round(sub70RoundsPercentage),
        trend_period: period,
        trend_category: 'hot',
        context_data: {
          rounds_analyzed: allRoundScores.length,
          sub_70_rounds: sub70RoundsCount
        },
        valid_until: validUntil
      });
    }

    return trends;
  }

  private calculateConsistencyTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string,
    validUntil: Date
  ): PlayerTrend[] {
    const trends: PlayerTrend[] = [];
    const completedTournaments = results.filter(r => r.total_score && r.rounds_completed === 4);
    
    if (completedTournaments.length < 3) return trends;

    const scores = completedTournaments.map(r => r.total_score! / 4);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation for consistency
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // Consistency thresholds
    if (stdDev < 1.5) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'scoring_consistency',
        trend_value: Math.round((1 / stdDev) * 100) / 100, // Higher value = more consistent
        trend_period: period,
        trend_category: 'consistent',
        context_data: {
          tournaments_analyzed: completedTournaments.length,
          std_deviation: Math.round(stdDev * 100) / 100,
          score_range: {
            min: Math.min(...scores),
            max: Math.max(...scores)
          }
        },
        valid_until: validUntil
      });
    } else if (stdDev > 3) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'scoring_volatility',
        trend_value: Math.round(stdDev * 100) / 100,
        trend_period: period,
        trend_category: 'volatile',
        context_data: {
          tournaments_analyzed: completedTournaments.length,
          score_range: {
            min: Math.min(...scores),
            max: Math.max(...scores)
          }
        },
        valid_until: validUntil
      });
    }

    return trends;
  }

  private calculateMomentumTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string,
    validUntil: Date
  ): PlayerTrend[] {
    const trends: PlayerTrend[] = [];
    
    if (results.length < 4) return trends;

    // Recent vs earlier performance
    const recentHalf = results.slice(0, Math.floor(results.length / 2));
    const earlierHalf = results.slice(Math.floor(results.length / 2));

    const recentCompletedTournaments = recentHalf.filter(r => r.total_score && r.rounds_played === 4);
    const earlierCompletedTournaments = earlierHalf.filter(r => r.total_score && r.rounds_played === 4);

    if (recentCompletedTournaments.length > 0 && earlierCompletedTournaments.length > 0) {
      const recentAvg = recentCompletedTournaments.reduce((sum, r) => sum + (r.total_score! / 4), 0) / recentCompletedTournaments.length;
      const earlierAvg = earlierCompletedTournaments.reduce((sum, r) => sum + (r.total_score! / 4), 0) / earlierCompletedTournaments.length;
      
      const improvement = earlierAvg - recentAvg; // Positive = improvement

      if (improvement > 1) {
        trends.push({
          dg_id: dgId,
          player_name: playerName,
          trend_type: 'positive_momentum',
          trend_value: Math.round(improvement * 100) / 100,
          trend_period: period,
          trend_category: 'hot',
          context_data: {
            recent_avg: Math.round(recentAvg * 100) / 100,
            earlier_avg: Math.round(earlierAvg * 100) / 100,
            recent_tournaments: recentCompletedTournaments.length,
            earlier_tournaments: earlierCompletedTournaments.length
          },
          valid_until: validUntil
        });
      } else if (improvement < -1) {
        trends.push({
          dg_id: dgId,
          player_name: playerName,
          trend_type: 'negative_momentum',
          trend_value: Math.round(Math.abs(improvement) * 100) / 100,
          trend_period: period,
          trend_category: 'cold',
          context_data: {
            recent_avg: Math.round(recentAvg * 100) / 100,
            earlier_avg: Math.round(earlierAvg * 100) / 100,
            recent_tournaments: recentCompletedTournaments.length,
            earlier_tournaments: earlierCompletedTournaments.length
          },
          valid_until: validUntil
        });
      }
    }

    return trends;
  }

  async saveTrends(trends: PlayerTrend[], period: string): Promise<void> {
    // Clear existing trends for this period
    await this.supabase
      .from('player_trends')
      .delete()
      .eq('trend_period', period);

    // Insert new trends in batches
    const batchSize = 100;
    for (let i = 0; i < trends.length; i += batchSize) {
      const batch = trends.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from('player_trends')
        .insert(batch.map(trend => ({
          dg_id: trend.dg_id,
          player_name: trend.player_name,
          trend_type: trend.trend_type,
          trend_value: trend.trend_value,
          trend_period: trend.trend_period,
          trend_category: trend.trend_category,
          context_data: trend.context_data,
          valid_until: trend.valid_until
        })));

      if (error) {
        throw error;
      }
    }
  }

  // Comprehensive advanced scoring trends
  private calculateAdvancedScoringTrends(
    dgId: number,
    playerName: string,
    results: TournamentResult[],
    period: string,
    validUntil: Date
  ): PlayerTrend[] {
    const trends: PlayerTrend[] = [];
    const completedTournaments = results.filter(r => r.total_score && r.rounds_completed === 4);
    
    if (completedTournaments.length < 3) return trends;

    // 1. CONSECUTIVE SUB-70 ROUNDS STREAK
    const consecutiveSub70Rounds = this.getConsecutiveSub70Rounds(completedTournaments);
    if (consecutiveSub70Rounds >= 3) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'consecutive_sub_70_rounds',
        trend_value: consecutiveSub70Rounds,
        trend_period: period,
        trend_category: consecutiveSub70Rounds >= 5 ? 'hot' : 'consistent',
        context_data: {
          streak_length: consecutiveSub70Rounds,
          tournaments_analyzed: completedTournaments.length
        },
        valid_until: validUntil
      });
    }

    // 2. TOP 15 FINISH STREAK
    const top15Streak = this.getConsecutiveFinishStreak(completedTournaments, 15);
    if (top15Streak >= 3) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'consecutive_top_15',
        trend_value: top15Streak,
        trend_period: period,
        trend_category: 'hot',
        context_data: {
          streak_length: top15Streak,
          tournaments_analyzed: completedTournaments.length
        },
        valid_until: validUntil
      });
    }

    // 3. TOP 25 FINISH STREAK
    const top25Streak = this.getConsecutiveFinishStreak(completedTournaments, 25);
    if (top25Streak >= 4) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'consecutive_top_25',
        trend_value: top25Streak,
        trend_period: period,
        trend_category: 'consistent',
        context_data: {
          streak_length: top25Streak,
          tournaments_analyzed: completedTournaments.length
        },
        valid_until: validUntil
      });
    }

    // 4. SCORING IMPROVEMENT TREND
    const improvementTrend = this.getScoringImprovementTrend(completedTournaments);
    if (improvementTrend.isImproving) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'scoring_improvement',
        trend_value: Math.round(improvementTrend.improvement * 100) / 100,
        trend_period: period,
        trend_category: 'hot',
        context_data: {
          improvement_per_tournament: improvementTrend.improvement,
          recent_average: improvementTrend.recentAverage,
          early_average: improvementTrend.earlyAverage,
          tournaments_analyzed: completedTournaments.length
        },
        valid_until: validUntil
      });
    }

    // 5. SUB-70 FREQUENCY IN RECENT TOURNAMENTS
    const recentSub70Analysis = this.getRecentSub70Analysis(completedTournaments);
    if (recentSub70Analysis.qualifies) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'recent_sub_70_frequency',
        trend_value: recentSub70Analysis.count,
        trend_period: period,
        trend_category: 'hot',
        context_data: {
          sub_70_tournaments: recentSub70Analysis.count,
          tournaments_analyzed: recentSub70Analysis.analyzed,
          percentage: recentSub70Analysis.percentage,
          recent_averages: recentSub70Analysis.recentAverages
        },
        valid_until: validUntil
      });
    }

    // 6. CUT MAKING STREAK
    const cutStreak = this.getCutMakingStreak(results);
    if (cutStreak >= 5) {
      trends.push({
        dg_id: dgId,
        player_name: playerName,
        trend_type: 'cut_making_streak',
        trend_value: cutStreak,
        trend_period: period,
        trend_category: cutStreak >= 8 ? 'hot' : 'consistent',
        context_data: {
          streak_length: cutStreak,
          tournaments_analyzed: results.length
        },
        valid_until: validUntil
      });
    }

    return trends;
  }

  // Helper: Get consecutive sub-70 rounds from most recent
  private getConsecutiveSub70Rounds(tournaments: TournamentResult[]): number {
    let streak = 0;
    
    for (const tournament of tournaments) {
      const rounds = [
        tournament.round_4_score,
        tournament.round_3_score,
        tournament.round_2_score,
        tournament.round_1_score
      ].filter(score => score !== null).reverse(); // oldest to newest
      
      for (const score of rounds.reverse()) { // newest to oldest
        if (score && score < 70) {
          streak++;
        } else {
          return streak;
        }
      }
    }
    
    return streak;
  }

  // Helper: Get consecutive finish streak (top X)
  private getConsecutiveFinishStreak(tournaments: TournamentResult[], threshold: number): number {
    let streak = 0;
    
    for (const tournament of tournaments) {
      if (tournament.final_position && tournament.final_position <= threshold) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }

  // Helper: Analyze scoring improvement trend
  private getScoringImprovementTrend(tournaments: TournamentResult[]): {
    isImproving: boolean;
    improvement: number;
    recentAverage: number;
    earlyAverage: number;
  } {
    if (tournaments.length < 4) {
      return { isImproving: false, improvement: 0, recentAverage: 0, earlyAverage: 0 };
    }

    const half = Math.floor(tournaments.length / 2);
    const recentTournaments = tournaments.slice(0, half);
    const earlyTournaments = tournaments.slice(half);

    const recentAverage = recentTournaments.reduce((sum, t) => sum + (t.total_score! / 4), 0) / recentTournaments.length;
    const earlyAverage = earlyTournaments.reduce((sum, t) => sum + (t.total_score! / 4), 0) / earlyTournaments.length;
    
    const improvement = earlyAverage - recentAverage; // Positive = getting better
    const isImproving = improvement >= 0.5; // At least half stroke improvement

    return { isImproving, improvement, recentAverage, earlyAverage };
  }

  // Helper: Analyze recent sub-70 frequency
  private getRecentSub70Analysis(tournaments: TournamentResult[]): {
    qualifies: boolean;
    count: number;
    analyzed: number;
    percentage: number;
    recentAverages: number[];
  } {
    const recent = tournaments.slice(0, Math.min(5, tournaments.length)); // Last 5 tournaments
    const sub70Count = recent.filter(t => (t.total_score! / 4) < 70).length;
    const percentage = (sub70Count / recent.length) * 100;
    const recentAverages = recent.map(t => Math.round((t.total_score! / 4) * 100) / 100);
    
    // Qualifies if 60%+ of recent tournaments averaged sub-70
    const qualifies = percentage >= 60 && sub70Count >= 2;
    
    return {
      qualifies,
      count: sub70Count,
      analyzed: recent.length,
      percentage: Math.round(percentage),
      recentAverages
    };
  }

  // Helper: Get cut making streak
  private getCutMakingStreak(tournaments: TournamentResult[]): number {
    let streak = 0;
    
    for (const tournament of tournaments) {
      if (tournament.made_cut) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }
}
import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json'; // 'json' or 'csv'
    const includeContext = searchParams.get('include_context') === 'true';
    const period = searchParams.get('period') || 'last_10';

    const supabase = createSupabaseClient();

    // Get comprehensive trend data with related information
    const { data: trends, error: trendsError } = await supabase
      .from('player_trends')
      .select(`
        dg_id,
        player_name,
        trend_type,
        trend_value,
        trend_period,
        trend_category,
        context_data,
        calculated_at
      `)
      .eq('trend_period', period)
      .order('dg_id', { ascending: true });

    if (trendsError) {
      return Response.json({ success: false, error: trendsError.message }, { status: 500 });
    }

    // Get recent performance data for context
    const { data: recentPerformance, error: performanceError } = await supabase
      .from('recent_performance')
      .select('*');

    if (performanceError) {
      console.warn('Could not fetch recent performance data:', performanceError);
    }

    // Get season stats for additional features
    const { data: seasonStats, error: seasonError } = await supabase
      .from('player_skill_ratings')
      .select(`
        dg_id,
        player_name,
        sg_total,
        sg_ott,
        sg_app,
        sg_arg,
        sg_putt,
        driving_acc,
        driving_dist
      `);

    if (seasonError) {
      console.warn('Could not fetch season stats:', seasonError);
    }

    // Transform data for ML consumption
    const mlData = prepareMlData(trends || [], recentPerformance || [], seasonStats || [], includeContext);

    if (format === 'csv') {
      const csv = convertToCSV(mlData);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="golf_trends_ml_data_${period}.csv"`
        }
      });
    }

    return Response.json({
      success: true,
      data: mlData,
      metadata: {
        total_players: new Set(trends?.map(t => t.dg_id)).size,
        total_trends: trends?.length || 0,
        period,
        generated_at: new Date().toISOString(),
        feature_columns: Object.keys(mlData[0] || {}),
        trend_types: [...new Set(trends?.map(t => t.trend_type))]
      }
    });

  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

function prepareMlData(
  trends: any[],
  recentPerformance: any[],
  seasonStats: any[],
  includeContext: boolean
): any[] {
  // Group trends by player
  const playerTrends = new Map();
  trends.forEach(trend => {
    if (!playerTrends.has(trend.dg_id)) {
      playerTrends.set(trend.dg_id, {
        dg_id: trend.dg_id,
        player_name: trend.player_name,
        trends: {}
      });
    }
    playerTrends.get(trend.dg_id).trends[trend.trend_type] = {
      value: trend.trend_value,
      category: trend.trend_category,
      context: trend.context_data
    };
  });

  // Create maps for quick lookup
  const performanceMap = new Map();
  recentPerformance.forEach(perf => {
    performanceMap.set(perf.dg_id, perf);
  });

  const seasonStatsMap = new Map();
  seasonStats.forEach(stat => {
    seasonStatsMap.set(stat.dg_id, stat);
  });

  // Transform to ML-ready format
  const mlData: any[] = [];

  for (const [dgId, playerData] of playerTrends) {
    const performance = performanceMap.get(dgId);
    const seasonStat = seasonStatsMap.get(dgId);
    
    const mlRecord: any = {
      // Player identifiers
      dg_id: dgId,
      player_name: playerData.player_name,
      
      // Core trend features (binary and numerical)
      has_top_10_streak: playerData.trends.top_10_streak ? 1 : 0,
      top_10_streak_value: playerData.trends.top_10_streak?.value || 0,
      
      has_top_5_frequency: playerData.trends.top_5_frequency ? 1 : 0,
      top_5_frequency_value: playerData.trends.top_5_frequency?.value || 0,
      
      has_missed_cut_streak: playerData.trends.missed_cut_streak ? 1 : 0,
      missed_cut_streak_value: playerData.trends.missed_cut_streak?.value || 0,
      
      has_sub_70_tournaments: playerData.trends.sub_70_tournaments ? 1 : 0,
      sub_70_tournaments_value: playerData.trends.sub_70_tournaments?.value || 0,
      
      has_positive_momentum: playerData.trends.positive_momentum ? 1 : 0,
      positive_momentum_value: playerData.trends.positive_momentum?.value || 0,
      
      has_negative_momentum: playerData.trends.negative_momentum ? 1 : 0,
      negative_momentum_value: playerData.trends.negative_momentum?.value || 0,
      
      has_scoring_consistency: playerData.trends.scoring_consistency ? 1 : 0,
      scoring_consistency_value: playerData.trends.scoring_consistency?.value || 0,
      
      has_scoring_volatility: playerData.trends.scoring_volatility ? 1 : 0,
      scoring_volatility_value: playerData.trends.scoring_volatility?.value || 0,
      
      scoring_average: playerData.trends.scoring_average?.value || null,
      
      // Category encodings
      is_hot_player: Object.values(playerData.trends).some((t: any) => t.category === 'hot') ? 1 : 0,
      is_cold_player: Object.values(playerData.trends).some((t: any) => t.category === 'cold') ? 1 : 0,
      is_consistent_player: Object.values(playerData.trends).some((t: any) => t.category === 'consistent') ? 1 : 0,
      is_volatile_player: Object.values(playerData.trends).some((t: any) => t.category === 'volatile') ? 1 : 0,
      
      // Recent performance metrics
      recent_tournaments_played: performance?.tournaments_played || 0,
      recent_top_10s: performance?.top_10s || 0,
      recent_top_5s: performance?.top_5s || 0,
      recent_top_3s: performance?.top_3s || 0,
      recent_missed_cuts: performance?.missed_cuts || 0,
      recent_avg_score: performance?.avg_score || null,
      recent_best_score: performance?.best_score || null,
      recent_worst_score: performance?.worst_score || null,
      recent_score_volatility: performance?.score_volatility || null,
      
      // Season stats (skills)
      season_sg_total: seasonStat?.sg_total || null,
      season_sg_ott: seasonStat?.sg_ott || null,
      season_sg_app: seasonStat?.sg_app || null,
      season_sg_arg: seasonStat?.sg_arg || null,
      season_sg_putt: seasonStat?.sg_putt || null,
      season_driving_acc: seasonStat?.driving_acc || null,
      season_driving_dist: seasonStat?.driving_dist || null,
      
      // Derived features
      top_10_rate: performance?.tournaments_played > 0 ? 
        (performance.top_10s / performance.tournaments_played) : 0,
      cut_making_rate: performance?.tournaments_played > 0 ? 
        ((performance.tournaments_played - performance.missed_cuts) / performance.tournaments_played) : 0,
      
      // Trend diversity (how many different trend types)
      trend_diversity: Object.keys(playerData.trends).length,
      
      // Time features
      calculated_at: new Date().toISOString()
    };

    // Add context data if requested
    if (includeContext) {
      mlRecord.trend_contexts = playerData.trends;
    }

    mlData.push(mlRecord);
  }

  return mlData;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]).filter(key => key !== 'trend_contexts');
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
}
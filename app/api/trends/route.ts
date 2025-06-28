import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'all'; // 'hot', 'cold', 'consistent', 'all'
    const period = searchParams.get('period') || 'last_10'; // 'last_3', 'last_5', 'last_10', 'season'
    const trendType = searchParams.get('type'); // specific trend type filter
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = createSupabaseClient();

    // Build the query dynamically based on filters
    let query = supabase
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
      .order('trend_value', { ascending: false });

    // Apply category filter
    if (category !== 'all') {
      query = query.eq('trend_category', category);
    }

    // Apply trend type filter
    if (trendType) {
      query = query.eq('trend_type', trendType);
    }

    // Apply limit
    query = query.limit(limit);

    const { data: trends, error } = await query;

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    // Group trends by player for better organization
    const playerTrends = new Map();
    
    trends?.forEach(trend => {
      const playerId = trend.dg_id;
      if (!playerTrends.has(playerId)) {
        playerTrends.set(playerId, {
          dg_id: playerId,
          player_name: trend.player_name,
          trends: []
        });
      }
      playerTrends.get(playerId).trends.push({
        type: trend.trend_type,
        value: trend.trend_value,
        category: trend.trend_category,
        context: trend.context_data,
        calculated_at: trend.calculated_at
      });
    });

    const groupedTrends = Array.from(playerTrends.values());

    return Response.json({ 
      success: true, 
      data: groupedTrends,
      filters: {
        category,
        period,
        type: trendType,
        limit
      }
    });

  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recalculate = false, period = 'last_10' } = body;

    const supabase = createSupabaseClient();

    // If recalculate is true, trigger trend calculations
    if (recalculate) {
      // First, get recent tournament data to calculate trends from
      const { data: recentResults, error: resultsError } = await supabase
        .from('tournament_results')
        .select('*')
        .gte('start_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('start_date', { ascending: false });

      if (resultsError) {
        return Response.json({ success: false, error: resultsError.message }, { status: 500 });
      }

      // Calculate trends for each player
      const playerGroups = new Map();
      recentResults?.forEach(result => {
        if (!playerGroups.has(result.dg_id)) {
          playerGroups.set(result.dg_id, []);
        }
        playerGroups.get(result.dg_id).push(result);
      });

      const trendsToInsert = [];
      const now = new Date();
      const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Valid for 24 hours

      for (const [dgId, results] of playerGroups) {
        const playerName = results[0]?.player_name || '';
        const sortedResults = results.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
        
        // Get the most recent tournaments based on period
        const periodCount = period === 'last_3' ? 3 : period === 'last_5' ? 5 : 10;
        const recentTournaments = sortedResults.slice(0, periodCount);

        if (recentTournaments.length >= 3) { // Need at least 3 tournaments for meaningful trends
          
          // Calculate top 10 streak
          let top10Streak = 0;
          for (const tournament of recentTournaments) {
            if (tournament.finish_position && tournament.finish_position <= 10) {
              top10Streak++;
            } else {
              break;
            }
          }

          // Calculate top 5 count in period
          const top5Count = recentTournaments.filter(t => t.finish_position && t.finish_position <= 5).length;
          
          // Calculate missed cut streak
          let missedCutStreak = 0;
          for (const tournament of recentTournaments) {
            if (tournament.missed_cut) {
              missedCutStreak++;
            } else {
              break;
            }
          }

          // Calculate sub-70 average tournaments
          const sub70Tournaments = recentTournaments.filter(t => 
            t.total_score && t.rounds_played === 4 && (t.total_score / 4) < 70
          ).length;

          // Calculate scoring average
          const completedTournaments = recentTournaments.filter(t => t.total_score && t.rounds_played === 4);
          const avgScore = completedTournaments.length > 0 
            ? completedTournaments.reduce((sum, t) => sum + (t.total_score / 4), 0) / completedTournaments.length 
            : null;

          // Determine trend categories
          let category = 'consistent';
          if (top10Streak >= 2 || top5Count >= 2) category = 'hot';
          if (missedCutStreak >= 2 || (avgScore && avgScore > 72)) category = 'cold';

          // Add trends to insert array
          if (top10Streak > 0) {
            trendsToInsert.push({
              dg_id: dgId,
              player_name: playerName,
              trend_type: 'top_10_streak',
              trend_value: top10Streak,
              trend_period: period,
              trend_category: category,
              context_data: { recent_tournaments: recentTournaments.length },
              valid_until: validUntil
            });
          }

          if (top5Count > 0) {
            trendsToInsert.push({
              dg_id: dgId,
              player_name: playerName,
              trend_type: 'top_5_count',
              trend_value: top5Count,
              trend_period: period,
              trend_category: category,
              context_data: { recent_tournaments: recentTournaments.length },
              valid_until: validUntil
            });
          }

          if (sub70Tournaments > 0) {
            trendsToInsert.push({
              dg_id: dgId,
              player_name: playerName,
              trend_type: 'sub_70_avg_count',
              trend_value: sub70Tournaments,
              trend_period: period,
              trend_category: category,
              context_data: { 
                recent_tournaments: recentTournaments.length,
                avg_score: avgScore ? Math.round(avgScore * 100) / 100 : null
              },
              valid_until: validUntil
            });
          }

          if (missedCutStreak > 0) {
            trendsToInsert.push({
              dg_id: dgId,
              player_name: playerName,
              trend_type: 'missed_cut_streak',
              trend_value: missedCutStreak,
              trend_period: period,
              trend_category: 'cold',
              context_data: { recent_tournaments: recentTournaments.length },
              valid_until: validUntil
            });
          }

          if (avgScore) {
            trendsToInsert.push({
              dg_id: dgId,
              player_name: playerName,
              trend_type: 'scoring_average',
              trend_value: Math.round(avgScore * 100) / 100,
              trend_period: period,
              trend_category: category,
              context_data: { 
                recent_tournaments: completedTournaments.length,
                best_score: Math.min(...completedTournaments.map(t => t.total_score / 4)),
                worst_score: Math.max(...completedTournaments.map(t => t.total_score / 4))
              },
              valid_until: validUntil
            });
          }
        }
      }

      // Clear old trends for this period
      await supabase
        .from('player_trends')
        .delete()
        .eq('trend_period', period);

      // Insert new trends
      if (trendsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('player_trends')
          .insert(trendsToInsert);

        if (insertError) {
          return Response.json({ success: false, error: insertError.message }, { status: 500 });
        }
      }

      return Response.json({ 
        success: true, 
        message: `Calculated ${trendsToInsert.length} trends for ${playerGroups.size} players`,
        trends_calculated: trendsToInsert.length
      });
    }

    return Response.json({ success: false, error: 'No action specified' }, { status: 400 });

  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
}
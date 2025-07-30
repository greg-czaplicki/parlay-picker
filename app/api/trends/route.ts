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
      // First, get recent tournaments
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: recentTournaments, error: tourError } = await supabase
        .from('tournaments')
        .select('event_id, start_date')
        .gte('start_date', cutoffDate)
        .order('start_date', { ascending: false });
      
      if (tourError) {
        return Response.json({ success: false, error: tourError.message }, { status: 500 });
      }
      
      if (!recentTournaments || recentTournaments.length === 0) {
        return Response.json({ success: true, data: [], message: 'No recent tournaments found' });
      }
      
      const eventIds = recentTournaments.map(t => t.event_id);
      
      // Then get results for those tournaments
      const { data: recentResults, error: resultsError } = await supabase
        .from('tournament_results')
        .select('*')
        .in('event_id', eventIds);

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
        // Create a map of tournament dates for sorting
        const tournamentDates = new Map(recentTournaments.map(t => [t.event_id, t.start_date]));
        const sortedResults = results.sort((a, b) => {
          const dateA = tournamentDates.get(a.event_id) || '';
          const dateB = tournamentDates.get(b.event_id) || '';
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        
        // Get the most recent tournaments based on period
        const periodCount = period === 'last_3' ? 3 : period === 'last_5' ? 5 : 10;
        const recentResults = sortedResults.slice(0, periodCount);

        if (recentResults.length >= 3) { // Need at least 3 tournaments for meaningful trends
          
          // Calculate top 10 streak
          let top10Streak = 0;
          for (const tournament of recentResults) {
            if (tournament.final_position && tournament.final_position <= 10) {
              top10Streak++;
            } else {
              break;
            }
          }

          // Calculate top 5 count in period
          const top5Count = recentResults.filter(t => t.final_position && t.final_position <= 5).length;
          
          // Calculate missed cut streak
          let missedCutStreak = 0;
          for (const tournament of recentResults) {
            if (!tournament.made_cut) {
              missedCutStreak++;
            } else {
              break;
            }
          }

          // Calculate sub-70 average tournaments
          const sub70Tournaments = recentResults.filter(t => 
            t.total_score && t.rounds_completed === 4 && (t.total_score / 4) < 70
          ).length;

          // Calculate scoring average
          const completedTournaments = recentResults.filter(t => t.total_score && t.rounds_completed === 4);
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
              context_data: { recent_tournaments: recentResults.length },
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
              context_data: { recent_tournaments: recentResults.length },
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
                recent_tournaments: recentResults.length,
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
              context_data: { recent_tournaments: recentResults.length },
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
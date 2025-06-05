import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

/**
 * GET /api/players/season
 * 
 * Fetches season statistics for all players, with optional data source filtering.
 * Supports both PGA Tour (player_season_stats) and DataGolf (player_skill_ratings) data sources.
 * 
 * Query Parameters:
 * - dataSource: 'pga_tour' | 'data_golf' (optional, defaults to 'pga_tour')
 * - limit: number (optional, defaults to 200)
 * - offset: number (optional, defaults to 0)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dataSource = searchParams.get('dataSource') || 'pga_tour';
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate data source
    if (!['pga_tour', 'data_golf'].includes(dataSource)) {
      return Response.json(
        { 
          success: false, 
          error: 'Invalid data source. Must be "pga_tour" or "data_golf"' 
        }, 
        { status: 400 }
      );
    }

    // Validate pagination parameters
    if (isNaN(limit) || limit <= 0 || limit > 500) {
      return Response.json(
        { 
          success: false, 
          error: 'Invalid limit. Must be a number between 1 and 500' 
        }, 
        { status: 400 }
      );
    }

    if (isNaN(offset) || offset < 0) {
      return Response.json(
        { 
          success: false, 
          error: 'Invalid offset. Must be a non-negative number' 
        }, 
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    if (dataSource === 'pga_tour') {
      // Query PGA Tour season statistics
      const { data, error } = await supabase
        .from('player_season_stats')
        .select(`
          dg_id,
          pga_player_id,
          player_name,
          sg_total,
          sg_ott,
          sg_app,
          sg_arg,
          sg_putt,
          driving_accuracy,
          driving_distance,
          updated_at,
          source_updated_at
        `)
        .order('sg_total', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }

      return Response.json({
        success: true,
        data: data || [],
        metadata: {
          dataSource,
          count: data?.length || 0,
          limit,
          offset,
          hasMore: (data?.length || 0) === limit
        }
      });

    } else {
      // Query DataGolf skill ratings
      const { data, error } = await supabase
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
          driving_dist,
          data_golf_updated_at,
          updated_at
        `)
        .order('sg_total', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }

      // Normalize DataGolf data to match PGA Tour format
      const normalizedData = (data || []).map(player => ({
        dg_id: player.dg_id,
        pga_player_id: null, // DataGolf doesn't have PGA player IDs
        player_name: player.player_name,
        sg_total: player.sg_total,
        sg_ott: player.sg_ott,
        sg_app: player.sg_app,
        sg_arg: player.sg_arg,
        sg_putt: player.sg_putt,
        driving_accuracy: player.driving_acc,
        driving_distance: player.driving_dist,
        updated_at: player.updated_at,
        source_updated_at: player.data_golf_updated_at
      }));

      return Response.json({
        success: true,
        data: normalizedData,
        metadata: {
          dataSource,
          count: normalizedData.length,
          limit,
          offset,
          hasMore: normalizedData.length === limit
        }
      });
    }

  } catch (error: any) {
    return Response.json({ success: false, error: error.message || String(error) }, { status: 500 });
  }
} 
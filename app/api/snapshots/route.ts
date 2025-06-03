import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * GET /api/snapshots - Retrieve bet snapshots for ML analysis
 * Query parameters:
 * - limit: number of snapshots to return (default 50)
 * - offset: pagination offset (default 0)
 * - include_outcomes: whether to include actual outcomes from parlay_picks (default false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const includeOutcomes = searchParams.get('include_outcomes') === 'true'
    
    // Build base query conditionally
    let query;
    if (includeOutcomes) {
      query = supabase
        .from('bet_snapshots')
        .select(`
          uuid,
          parlay_pick_id,
          snapshot,
          created_at,
          parlay_picks!inner(outcome, pick)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    } else {
      query = supabase
        .from('bet_snapshots')
        .select(`
          uuid,
          parlay_pick_id,
          snapshot,
          created_at
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
    }
    
    const { data: snapshots, error } = await query
    
    if (error) {
      logger.error('[GET /api/snapshots] Error fetching snapshots:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    // Transform snapshots for ML analysis
    const transformedSnapshots = snapshots?.map(snapshot => {
      const data = snapshot.snapshot
      
      // Extract key features for ML
      const features: any = {
        // Metadata
        snapshot_id: snapshot.uuid,
        parlay_pick_id: snapshot.parlay_pick_id,
        bet_timestamp: data.bet_timestamp,
        round_num: data.round_num,
        event_name: data.event_name,
        
        // Matchup features
        matchup_type: data.matchup.type,
        num_players: data.matchup.players.length,
        
        // Picked player features
        picked_dg_id: data.calculated_features.picked_player.dg_id,
        picked_name: data.calculated_features.picked_player.name,
        picked_position: data.calculated_features.picked_player.position_in_matchup,
        picked_implied_probability: data.calculated_features.picked_player.implied_probability,
        
        // Group analysis features
        avg_sg_total: data.calculated_features.group_analysis.avg_sg_total,
        odds_spread: data.calculated_features.group_analysis.odds_spread,
        is_favorite: data.calculated_features.group_analysis.favorite_dg_id === data.calculated_features.picked_player.dg_id,
        is_underdog: data.calculated_features.group_analysis.underdog_dg_id === data.calculated_features.picked_player.dg_id,
        
        // Player stats at bet time (for picked player)
        picked_sg_total: data.player_stats[data.calculated_features.picked_player.dg_id]?.sg_total || null,
        picked_sg_ott: data.player_stats[data.calculated_features.picked_player.dg_id]?.sg_ott || null,
        picked_sg_app: data.player_stats[data.calculated_features.picked_player.dg_id]?.sg_app || null,
        picked_sg_arg: data.player_stats[data.calculated_features.picked_player.dg_id]?.sg_arg || null,
        picked_sg_putt: data.player_stats[data.calculated_features.picked_player.dg_id]?.sg_putt || null,
        
        // Live stats at bet time (if available)
        had_live_stats: data.live_stats !== null,
        picked_live_position: data.live_stats?.[data.calculated_features.picked_player.dg_id]?.position || null,
        picked_live_total: data.live_stats?.[data.calculated_features.picked_player.dg_id]?.total || null,
        picked_live_today: data.live_stats?.[data.calculated_features.picked_player.dg_id]?.today || null,
        picked_live_thru: data.live_stats?.[data.calculated_features.picked_player.dg_id]?.thru || null,
        
        // Full snapshot data (for detailed analysis)
        full_snapshot: includeOutcomes ? data : null,
        
        // Optional outcome fields
        actual_outcome: null,
        actual_pick: null
      }
      
      // Add actual outcome if available
      if (includeOutcomes && 'parlay_picks' in snapshot && snapshot.parlay_picks) {
        const parlayPickData = snapshot.parlay_picks as any;
        features.actual_outcome = Array.isArray(parlayPickData) ? parlayPickData[0]?.outcome : parlayPickData.outcome;
        features.actual_pick = Array.isArray(parlayPickData) ? parlayPickData[0]?.pick : parlayPickData.pick;
      }
      
      return features
    }) || []
    
    // Calculate summary statistics
    const summary = {
      total_snapshots: transformedSnapshots.length,
      date_range: {
        earliest: transformedSnapshots[transformedSnapshots.length - 1]?.bet_timestamp || null,
        latest: transformedSnapshots[0]?.bet_timestamp || null
      },
      matchup_types: {
        ball_2: transformedSnapshots.filter(s => s.matchup_type === '2ball').length,
        ball_3: transformedSnapshots.filter(s => s.matchup_type === '3ball').length
      },
      live_stats_availability: transformedSnapshots.filter(s => s.had_live_stats).length,
      ...(includeOutcomes ? {
        outcomes: {
          win: transformedSnapshots.filter(s => s.actual_outcome === 'win').length,
          loss: transformedSnapshots.filter(s => s.actual_outcome === 'loss').length,
          push: transformedSnapshots.filter(s => s.actual_outcome === 'push').length,
          void: transformedSnapshots.filter(s => s.actual_outcome === 'void').length
        }
      } : {})
    }
    
    logger.info(`[GET /api/snapshots] Retrieved ${transformedSnapshots.length} snapshots`)
    
    return NextResponse.json({
      snapshots: transformedSnapshots,
      summary,
      pagination: {
        limit,
        offset,
        returned: transformedSnapshots.length
      }
    })
    
  } catch (error) {
    logger.error('[GET /api/snapshots] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
} 
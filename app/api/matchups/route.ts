import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// Helper function to check if a matchup has FanDuel odds
function hasValidFanDuelOdds(matchup: any): boolean {
  const hasOdds1 = matchup.odds1 !== null && matchup.odds1 !== undefined;
  const hasOdds2 = matchup.odds2 !== null && matchup.odds2 !== undefined;
  const hasOdds3 = matchup.type === '3ball' ? (matchup.odds3 !== null && matchup.odds3 !== undefined) : true;
  
  return hasOdds1 && hasOdds2 && hasOdds3;
}

// GET: Fetch matchups using the new column-based schema
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('matchupType') || searchParams.get('type')
  const event_id = searchParams.get('eventId') || searchParams.get('event_id')
  const round_num = searchParams.get('roundNum') || searchParams.get('round_num')
  const checkOnly = searchParams.get('checkOnly') === 'true'
  const fanDuelOnly = searchParams.get('fanDuelOnly') === 'true'
  const bustCache = searchParams.get('_t') // Cache-busting timestamp

  console.log(`🔄 Matchups API: event_id=${event_id}, type=${type}, round=${round_num}, fanDuelOnly=${fanDuelOnly}`)

  try {
    // Build query using new schema columns
    let query = supabase
      .from('betting_markets')
      .select(`
        id,
        matchup_key,
        event_id,
        round_num,
        type,
        player1_dg_id,
        player1_name,
        player2_dg_id,
        player2_name,
        player3_dg_id,
        player3_name,
        odds1,
        odds2,
        odds3,
        dg_odds1,
        dg_odds2,
        dg_odds3,
        start_hole,
        tee_time,
        player1_tee_time,
        player2_tee_time,
        created_at,
        updated_at
      `)
      .not('type', 'is', null) // Only get matchups with the new schema
      .order('created_at', { ascending: false });

    // Filter by event_id if provided
    if (event_id) {
      query = query.eq('event_id', parseInt(event_id));
    }

    // Filter by round
    if (round_num) {
      query = query.eq('round_num', parseInt(round_num));
    }

    // Filter by matchup type (2ball or 3ball)
    if (type && (type === '2ball' || type === '3ball')) {
      query = query.eq('type', type);
    }

    // Filter by FanDuel odds availability
    if (fanDuelOnly) {
      query = query
        .not('odds1', 'is', null)
        .not('odds2', 'is', null);
      
      // For 3ball matchups, also require odds3
      if (type === '3ball') {
        query = query.not('odds3', 'is', null);
      }
    }

    const { data: matchups, error } = await query;

    if (error) {
      console.error('Error fetching matchups:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`📊 Found ${matchups?.length || 0} matchups`);

    // If checkOnly, just return count
    if (checkOnly) {
      const response = NextResponse.json({ 
        matchups: [], 
        count: matchups?.length || 0
      });

      if (bustCache) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }

      return response;
    }

    // Filter by FanDuel odds if requested (additional client-side filtering)
    let filteredMatchups = matchups || [];
    if (fanDuelOnly && filteredMatchups.length > 0) {
      filteredMatchups = filteredMatchups.filter(hasValidFanDuelOdds);
      console.log(`📊 After FanDuel filter: ${filteredMatchups.length} matchups`);
    }

    // Enhance matchups with SG data
    const enhancedMatchups = await enhanceMatchupsWithSGData(filteredMatchups, supabase);

    const response = NextResponse.json({ 
      matchups: enhancedMatchups,
      count: enhancedMatchups.length,
      source: 'betting_markets_v2'
    });
    
    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response

  } catch (error: any) {
    console.error('Error fetching matchup data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Enhance matchups with SG data from both PGA Tour stats and DataGolf skill ratings
async function enhanceMatchupsWithSGData(matchups: any[], supabase: any) {
  if (!matchups || matchups.length === 0) return matchups;

  // Get all unique player IDs
  const allPlayerIds = new Set<number>();
  matchups.forEach(matchup => {
    if (matchup.player1_dg_id) allPlayerIds.add(matchup.player1_dg_id);
    if (matchup.player2_dg_id) allPlayerIds.add(matchup.player2_dg_id);
    if (matchup.player3_dg_id) allPlayerIds.add(matchup.player3_dg_id);
  });

  const playerIds = Array.from(allPlayerIds);
  console.log(`🔍 Fetching SG data for ${playerIds.length} unique players`);

  // Fetch DataGolf skill ratings
  const { data: skillRatings, error: skillError } = await supabase
    .from('player_skill_ratings')
    .select(`
      dg_id,
      player_name,
      sg_total,
      sg_putt,
      sg_arg,
      sg_app,
      sg_ott,
      driving_acc,
      driving_dist
    `)
    .in('dg_id', playerIds);

  if (skillError) {
    console.error('Error fetching skill ratings:', skillError);
  }

  // Create skill ratings map
  const skillRatingsMap: Record<number, any> = {};
  (skillRatings || []).forEach(rating => {
    skillRatingsMap[rating.dg_id] = {
      seasonSgTotal: rating.sg_total,
      seasonSgPutt: rating.sg_putt,
      seasonSgArg: rating.sg_arg,
      seasonSgApp: rating.sg_app,
      seasonSgOtt: rating.sg_ott,
      seasonDrivingAcc: rating.driving_acc,
      seasonDrivingDist: rating.driving_dist
    };
  });

  console.log(`📊 Found skill ratings for ${Object.keys(skillRatingsMap).length} players`);

  // Enhance each matchup with SG data
  return matchups.map(matchup => {
    const enhanced = { ...matchup };

    // Add SG data for each player
    if (matchup.player1_dg_id && skillRatingsMap[matchup.player1_dg_id]) {
      enhanced.player1_sg_data = skillRatingsMap[matchup.player1_dg_id];
    }
    
    if (matchup.player2_dg_id && skillRatingsMap[matchup.player2_dg_id]) {
      enhanced.player2_sg_data = skillRatingsMap[matchup.player2_dg_id];
    }
    
    if (matchup.player3_dg_id && skillRatingsMap[matchup.player3_dg_id]) {
      enhanced.player3_sg_data = skillRatingsMap[matchup.player3_dg_id];
    }

    // Mark as enhanced
    enhanced.sg_data_enhanced = true;
    enhanced.season_sg_players = Object.keys(skillRatingsMap).length;

    return enhanced;
  });
}

// POST: Currently disabled - use the ingest endpoint instead
export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    error: 'Matchup creation should use the /api/matchups/ingest endpoint instead.' 
  }, { status: 503 })
}
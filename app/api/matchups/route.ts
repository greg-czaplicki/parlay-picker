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

// GET: Fetch matchups with enhanced SG data
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('matchupType') || searchParams.get('type')
  const event_id = searchParams.get('eventId') || searchParams.get('event_id')
  const round_num = searchParams.get('roundNum') || searchParams.get('round_num')
  const checkOnly = searchParams.get('checkOnly') === 'true'
  const fanDuelOnly = searchParams.get('fanDuelOnly') === 'true'
  const bustCache = searchParams.get('_t') // Cache-busting timestamp

  // For now, return empty matchups until we implement the new structure
  // TODO: Implement proper betting markets query
  if (checkOnly) {
    const response = NextResponse.json({ 
      matchups: [], 
      count: 0
    })

    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return response
  }

  try {
    // Use the new betting markets API functionality
    console.log('🔄 Matchups API: Using betting markets data')
    
    // Build query for betting markets
    let query = supabase
      .from('betting_markets')
      .select(`
        id,
        market_name,
        market_subtype,
        group_specific,
        sportsbook_id,
        tournament_id,
        round_specific,
        status,
        sportsbooks(name, display_name),
        tournaments(dg_id, name)
      `)
      .eq('status', 'active')
      .eq('market_type', 'matchup');

    // If filtering by event_id, first get the tournament UUID
    let tournamentUuid = null;
    if (event_id) {
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id')
        .eq('dg_id', parseInt(event_id))
        .single();
        
      if (tournamentError || !tournament) {
        console.log(`Tournament not found for dg_id ${event_id}`);
        return NextResponse.json({ matchups: [], count: 0 });
      }
      
      tournamentUuid = tournament.id;
      query = query.eq('tournament_id', tournamentUuid);
    }

    // Filter by round
    if (round_num) {
      query = query.eq('round_specific', parseInt(round_num));
    }

    // Filter by matchup type (2ball or 3ball)
    if (type && (type === '2ball' || type === '3ball')) {
      query = query.eq('market_subtype', type);
    }

    // Filter by sportsbook - need to get sportsbook UUID first
    if (fanDuelOnly || searchParams.get('sportsbook') === 'fanduel') {
      const { data: sportsbook } = await supabase
        .from('sportsbooks')
        .select('id')
        .eq('name', 'fanduel')
        .single();
        
      if (sportsbook) {
        query = query.eq('sportsbook_id', sportsbook.id);
      }
    }

    const { data: markets, error } = await query;

    if (error) {
      console.error('Error fetching betting markets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`📊 Found ${markets?.length || 0} betting markets`);

    // If checkOnly, just return count
    if (checkOnly) {
      const response = NextResponse.json({ 
        matchups: [], 
        count: markets?.length || 0
      });

      if (bustCache) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }

      return response;
    }

    // Transform markets to the format expected by the frontend
    const transformedMatchups = await transformMarketsToMatchups(markets || [], supabase);

    const response = NextResponse.json({ 
      matchups: transformedMatchups,
      count: transformedMatchups.length,
      source: 'betting_markets'
    });
    
    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
    }
    
    return response

  } catch (error: any) {
    console.error('Error fetching enhanced matchup data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Transform betting markets into the exact format expected by the frontend
async function transformMarketsToMatchups(markets: any[], supabase: any) {
  if (!markets || markets.length === 0) return [];

  // Group markets by matchup_id (same players/matchup, different sportsbooks)
  const groupedMarkets: Record<string, any[]> = {};
  
  markets.forEach(market => {
    const matchupId = market.group_specific?.matchup_id;
    if (matchupId) {
      if (!groupedMarkets[matchupId]) {
        groupedMarkets[matchupId] = [];
      }
      groupedMarkets[matchupId].push(market);
    }
  });

  console.log(`📋 Grouped ${markets.length} markets into ${Object.keys(groupedMarkets).length} unique matchups`);

  // Get all unique player IDs to fetch names
  const allPlayerIds = new Set<number>();
  Object.values(groupedMarkets).forEach(marketGroup => {
    const players = marketGroup[0]?.group_specific?.players || [];
    players.forEach((id: number) => allPlayerIds.add(id));
  });

  // Fetch player information
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('dg_id, name')
    .in('dg_id', Array.from(allPlayerIds));
    
  if (playersError) {
    console.error('Error fetching player names:', playersError);
  }
  
  const playerMap: Record<number, string> = {};
  (players || []).forEach((player: any) => {
    playerMap[player.dg_id] = player.name || `Player ${player.dg_id}`;
  });

  // Transform each unique matchup group into the expected format
  const matchups = Object.entries(groupedMarkets).map(([matchupId, marketGroup]) => {
    const firstMarket = marketGroup[0];
    const players = firstMarket.group_specific?.players || [];
    const isThreeBall = firstMarket.market_subtype === '3ball';

    // Find FanDuel market for odds (preferred sportsbook)
    const fanDuelMarket = marketGroup.find(m => m.sportsbooks?.name === 'fanduel');
    const oddsMarket = fanDuelMarket || marketGroup[0]; // Fallback to first market

    // Create the matchup object in the exact format expected by frontend
    const matchup: any = {
      id: matchupId,
      event_id: firstMarket.tournaments?.dg_id || null,
      event_name: firstMarket.tournaments?.name || null,
      round_num: firstMarket.round_specific || 1,
      type: firstMarket.market_subtype,
      player1_dg_id: players[0] || null,
      player1_name: playerMap[players[0]] || `Player ${players[0]}`,
      player2_dg_id: players[1] || null,
      player2_name: playerMap[players[1]] || `Player ${players[1]}`,
      // Extract FanDuel odds from betting markets (preferred sportsbook)
      odds1: fanDuelMarket?.group_specific?.player_odds?.p1 || null,
      odds2: fanDuelMarket?.group_specific?.player_odds?.p2 || null,
      // Extract DataGolf odds
      dg_odds1: fanDuelMarket?.group_specific?.dg_odds?.p1 || null,
      dg_odds2: fanDuelMarket?.group_specific?.dg_odds?.p2 || null,
      // Extract tee time data
      tee_time: fanDuelMarket?.group_specific?.tee_time || null,
      start_hole: fanDuelMarket?.group_specific?.start_hole || 1,
    };

    // Add third player for 3-ball matchups
    if (isThreeBall && players[2]) {
      matchup.player3_dg_id = players[2];
      matchup.player3_name = playerMap[players[2]] || `Player ${players[2]}`;
      matchup.odds3 = fanDuelMarket?.group_specific?.player_odds?.p3 || null;
      matchup.dg_odds3 = fanDuelMarket?.group_specific?.dg_odds?.p3 || null;
    } else {
      matchup.player3_dg_id = null;
      matchup.player3_name = null;
      matchup.odds3 = null;
      matchup.dg_odds3 = null;
    }

    return matchup;
  });

  console.log(`✅ Transformed ${matchups.length} matchups for frontend compatibility`);
  return matchups;
}

// POST: Currently disabled - needs to be reimplemented for betting_markets table
export async function POST(req: NextRequest) {
  return NextResponse.json({ 
    error: 'Matchup creation is temporarily disabled during database migration. Betting markets need to be populated through a different process.' 
  }, { status: 503 })
} 
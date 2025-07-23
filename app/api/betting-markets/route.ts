import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// GET: Fetch betting markets (replaces matchups endpoint)
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const type = searchParams.get('matchupType') || searchParams.get('type') // 2ball or 3ball
  const event_id = searchParams.get('eventId') || searchParams.get('event_id')
  const round_num = searchParams.get('roundNum') || searchParams.get('round_num') || '1'
  const checkOnly = searchParams.get('checkOnly') === 'true'
  const fanDuelOnly = searchParams.get('fanDuelOnly') === 'true'
  const sportsbook = searchParams.get('sportsbook') || 'fanduel'
  const bustCache = searchParams.get('_t') // Cache-busting timestamp

  console.log(`🎯 Betting markets API called: type=${type}, event_id=${event_id}, round=${round_num}, sportsbook=${sportsbook}`);

  try {
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
        sportsbooks!inner(name, display_name),
        tournaments!inner(dg_id, name)
      `)
      .eq('status', 'active')
      .eq('market_type', 'matchup');

    // Filter by tournament if specified
    if (event_id) {
      // Need to join with tournaments table to match by dg_id
      query = query.eq('tournaments.dg_id', parseInt(event_id));
    }

    // Filter by round
    if (round_num) {
      query = query.eq('round_specific', parseInt(round_num));
    }

    // Filter by matchup type (2ball or 3ball)
    if (type && (type === '2ball' || type === '3ball')) {
      query = query.eq('market_subtype', type);
    }

    // Filter by sportsbook
    if (fanDuelOnly || sportsbook === 'fanduel') {
      query = query.eq('sportsbooks.name', 'fanduel');
    } else if (sportsbook && sportsbook !== 'fanduel') {
      query = query.eq('sportsbooks.name', sportsbook);
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
        matchups: markets || [], 
        count: markets?.length || 0
      });

      if (bustCache) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
      }

      return response;
    }

    // Transform betting markets into the format expected by the frontend
    const transformedMatchups = await transformBettingMarketsToMatchups(markets || [], supabase);

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
    
    return response;

  } catch (error: any) {
    console.error('Error in betting markets endpoint:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Transform betting markets data into the format expected by the frontend
async function transformBettingMarketsToMatchups(markets: any[], supabase: any) {
  if (!markets || markets.length === 0) return [];

  // Group markets by matchup_id to combine different sportsbooks
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

  console.log(`📋 Grouped ${markets.length} markets into ${Object.keys(groupedMarkets).length} matchups`);

  // Get player information for all unique player IDs
  const allPlayerIds = new Set<number>();
  Object.values(groupedMarkets).forEach(marketGroup => {
    const players = marketGroup[0]?.group_specific?.players || [];
    players.forEach((id: number) => allPlayerIds.add(id));
  });

  const playerMap = await getPlayerMap(supabase, Array.from(allPlayerIds));

  // Transform each matchup group
  const matchups = Object.entries(groupedMarkets).map(([matchupId, marketGroup], index) => {
    const firstMarket = marketGroup[0];
    const players = firstMarket.group_specific?.players || [];
    const isThreeBall = firstMarket.market_subtype === '3ball';

    // Create player objects
    const matchupPlayers = players.map((playerId: number, playerIndex: number) => {
      const player = playerMap[playerId];
      return {
        id: playerId,
        name: player?.name || `Player ${playerId}`,
        odds: 0, // Will be populated with actual odds
        sgTotal: 0, // Placeholder - could be populated from stats
        valueRating: 0,
        confidenceScore: 0,
        isRecommended: playerIndex === 0 // Placeholder logic
      };
    });

    // Create the matchup object in the expected format
    return {
      id: matchupId,
      group: `Group ${index + 1}`,
      bookmaker: firstMarket.sportsbooks?.name || 'unknown',
      type: isThreeBall ? '3ball' : '2ball',
      event_id: firstMarket.tournaments?.dg_id,
      event_name: firstMarket.tournaments?.name,
      round_num: firstMarket.round_specific,
      players: matchupPlayers,
      recommended: matchupPlayers[0]?.name || '',
      // Additional fields for compatibility
      player1_dg_id: players[0] || null,
      player1_name: matchupPlayers[0]?.name || null,
      player2_dg_id: players[1] || null,
      player2_name: matchupPlayers[1]?.name || null,
      player3_dg_id: isThreeBall ? (players[2] || null) : null,
      player3_name: isThreeBall ? (matchupPlayers[2]?.name || null) : null,
      // Market information
      markets: marketGroup.map(market => ({
        sportsbook: market.sportsbooks?.name,
        sportsbook_display: market.sportsbooks?.display_name,
        market_id: market.id
      }))
    };
  });

  console.log(`✅ Transformed ${matchups.length} matchups for frontend`);
  return matchups;
}

// Helper function to get player information
async function getPlayerMap(supabase: any, playerIds: number[]): Promise<Record<number, any>> {
  if (playerIds.length === 0) return {};
  
  const { data: players, error } = await supabase
    .from('players')
    .select('dg_id, first_name, last_name')
    .in('dg_id', playerIds);
    
  if (error) {
    console.error('Error fetching players:', error);
    return {};
  }
  
  const map: Record<number, any> = {};
  (players || []).forEach((player: any) => {
    map[player.dg_id] = {
      name: `${player.last_name}, ${player.first_name}`.trim(),
      first_name: player.first_name,
      last_name: player.last_name
    };
  });
  
  return map;
}
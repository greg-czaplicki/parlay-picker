import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { TournamentNameResolver } from '@/lib/services/tournament-name-resolver'
import { convertTournamentTimeToUTC } from '@/lib/timezone-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY
const INGEST_SECRET = process.env.INGEST_SECRET

// DataGolf API URLs
function getDG3BallURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
}

function getDG2BallURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=round_matchups&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
}

function getDGFieldUpdatesURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/field-updates?tour=${tour}&file_format=json&key=${DATA_GOLF_API_KEY}`
}

async function fetchDG(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch DataGolf: ${url}`)
  return res.json()
}

// Helper function to validate and normalize match_list
function validateMatchList(matchData: any, marketType: string): any[] {
  if (!matchData.match_list) {
    console.log(`No match_list found for ${marketType}`);
    return [];
  }
  
  if (typeof matchData.match_list === 'string') {
    console.log(`${marketType} match_list is a string: ${matchData.match_list}`);
    return [];
  }
  
  if (!Array.isArray(matchData.match_list)) {
    console.log(`${marketType} match_list is not an array:`, typeof matchData.match_list);
    return [];
  }
  
  return matchData.match_list;
}

// Create tee time mapping from field updates
function createTeeTimeMap(fieldData: any, roundNum: number): Record<number, { teetime: string | null, start_hole: number }> {
  const teeTimeMap: Record<number, { teetime: string | null, start_hole: number }> = {};
  
  if (!fieldData.field || !Array.isArray(fieldData.field)) {
    console.log('⚠️ No field data available for tee times');
    return teeTimeMap;
  }
  
  const roundKey = `r${roundNum}_teetime`;
  console.log(`📅 Creating tee time map for round ${roundNum} using field key: ${roundKey}`);
  
  // Debug: Log first few players to see the tee time format
  if (fieldData.field && fieldData.field.length > 0) {
    console.log('🔍 Sample tee time data:', {
      player: fieldData.field[0].player_name,
      dg_id: fieldData.field[0].dg_id,
      teetime: fieldData.field[0][roundKey],
      all_fields: Object.keys(fieldData.field[0]).filter(k => k.includes('teetime'))
    });
  }
  
  fieldData.field.forEach((player: any) => {
    if (player.dg_id && typeof player.dg_id === 'number') {
      const teetime = player[roundKey];
      const start_hole = player.start_hole || 1;
      
      // For R3+, null teetime means didn't make the cut
      if (roundNum >= 3 && teetime === null) {
        console.log(`❌ Player ${player.player_name} (${player.dg_id}) didn't make the cut (no R${roundNum} tee time)`);
      }
      
      teeTimeMap[player.dg_id] = {
        teetime: teetime,
        start_hole: start_hole
      };
    }
  });
  
  console.log(`✅ Created tee time map for ${Object.keys(teeTimeMap).length} players`);
  return teeTimeMap;
}

// Helper function to get sportsbook UUID by name
async function getSportsbookMap(supabase: any): Promise<Record<string, string>> {
  const { data: sportsbooks, error } = await supabase
    .from('sportsbooks')
    .select('id, name');
    
  if (error || !sportsbooks) {
    throw new Error(`Failed to fetch sportsbooks: ${error?.message}`);
  }
  
  const map: Record<string, string> = {};
  sportsbooks.forEach((book: any) => {
    map[book.name] = book.id;
  });
  
  return map;
}

// Helper function to get player UUID by dg_id
async function getPlayerMap(supabase: any, playerIds: number[]): Promise<Record<number, string>> {
  if (playerIds.length === 0) return {};
  
  const { data: players, error } = await supabase
    .from('players')
    .select('id, dg_id')
    .in('dg_id', playerIds);
    
  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }
  
  const map: Record<number, string> = {};
  (players || []).forEach((player: any) => {
    map[player.dg_id] = player.id;
  });
  
  return map;
}

// Helper function to get tournament UUID by dg_id
async function getTournamentUuid(supabase: any, dgId: number): Promise<string | null> {
  const { data: tournaments, error } = await supabase
    .from('tournaments')
    .select('id')
    .eq('dg_id', dgId)
    .single();
    
  if (error || !tournaments) {
    console.log(`Tournament not found for dg_id ${dgId}`);
    return null;
  }
  
  return tournaments.id;
}

// Transform matchups into betting markets
async function transformToBettingMarkets(
  matchups: any[], 
  type: '2ball' | '3ball', 
  tournamentId: string,
  sportsbookMap: Record<string, string>,
  playerMap: Record<number, string>,
  roundNum: number,
  teeTimeMap: Record<number, { teetime: string | null, start_hole: number }>,
  eventName: string
): Promise<any[]> {
  const markets: any[] = [];
  const supportedSportsbooks = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'pointsbet'];
  
  for (const matchup of matchups) {
    // Create markets for each sportsbook that has odds
    for (const bookName of supportedSportsbooks) {
      const sportsbookId = sportsbookMap[bookName];
      if (!sportsbookId) continue;
      
      const odds = matchup.odds?.[bookName];
      if (!odds) continue;
      
      // Check if this sportsbook has odds for all players in the matchup
      const hasP1 = odds.p1 !== null && odds.p1 !== undefined;
      const hasP2 = odds.p2 !== null && odds.p2 !== undefined;
      const hasP3 = type === '3ball' ? (odds.p3 !== null && odds.p3 !== undefined) : true;
      
      if (!hasP1 || !hasP2 || !hasP3) continue;
      
      // Log odds structure for debugging
      if (markets.length === 0) {
        console.log('📊 Sample odds structure:', {
          sportsbook: bookName,
          p1: odds.p1,
          p2: odds.p2,
          p3: odds.p3,
          matchup: `${matchup.p1_player_name} vs ${matchup.p2_player_name}${type === '3ball' ? ` vs ${matchup.p3_player_name}` : ''}`
        });
      }
      
      // Get tee time from the first player (they should all have the same tee time in a group)
      const player1TeeTime = teeTimeMap[matchup.p1_dg_id];
      const player2TeeTime = teeTimeMap[matchup.p2_dg_id];
      const player3TeeTime = type === '3ball' && matchup.p3_dg_id ? teeTimeMap[matchup.p3_dg_id] : null;
      
      // Use the earliest tee time if they differ, or fallback to any available
      let teetime = player1TeeTime?.teetime || player2TeeTime?.teetime || player3TeeTime?.teetime;
      let start_hole = player1TeeTime?.start_hole || player2TeeTime?.start_hole || player3TeeTime?.start_hole || 1;
      
      // Convert to UTC if teetime exists
      const teeTimeUTC = teetime ? convertTournamentTimeToUTC(teetime, eventName) : null;
      
      // Create a market for this matchup/sportsbook combination
      const marketId = crypto.randomUUID();
      const marketName = type === '3ball' 
        ? `3-Ball Matchup: ${matchup.p1_player_name} vs ${matchup.p2_player_name} vs ${matchup.p3_player_name}`
        : `Head-to-Head: ${matchup.p1_player_name} vs ${matchup.p2_player_name}`;
      
      const baseMarket = {
        id: marketId,
        sportsbook_id: sportsbookId,
        tournament_id: tournamentId,
        market_type: 'matchup',
        market_subtype: type,
        market_name: marketName,
        market_description: `Round ${roundNum} ${type} matchup`,
        bet_type: 'moneyline',
        market_category: 'golf',
        parlay_eligible: true,
        same_game_parlay_eligible: true,
        status: 'active',
        round_specific: roundNum,
        group_specific: {
          players: type === '3ball' 
            ? [matchup.p1_dg_id, matchup.p2_dg_id, matchup.p3_dg_id]
            : [matchup.p1_dg_id, matchup.p2_dg_id],
          matchup_id: `${matchup.p1_dg_id}_${matchup.p2_dg_id}${type === '3ball' ? `_${matchup.p3_dg_id}` : ''}`,
          round: roundNum,
          player_odds: {
            p1: odds.p1,
            p2: odds.p2,
            p3: type === '3ball' ? odds.p3 : null
          },
          dg_odds: {
            p1: matchup.odds?.datagolf?.p1 || null,
            p2: matchup.odds?.datagolf?.p2 || null,
            p3: type === '3ball' ? (matchup.odds?.datagolf?.p3 || null) : null
          },
          player_names: {
            p1: matchup.p1_player_name,
            p2: matchup.p2_player_name,
            p3: type === '3ball' ? matchup.p3_player_name : null
          },
          tee_time: teeTimeUTC,
          start_hole: start_hole
        },
        settlement_criteria: {
          type: 'lowest_score',
          round: roundNum,
          ties: 'push'
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      markets.push(baseMarket);
    }
  }
  
  console.log(`Created ${markets.length} betting markets for ${type} matchups`);
  return markets;
}

export async function POST(req: NextRequest) {
  // Security: require secret
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${INGEST_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get tour parameter from query string (default to 'pga')
  const { searchParams } = new URL(req.url)
  const tour = searchParams.get('tour') || 'pga'

  // Validate tour parameter
  if (!['pga', 'opp', 'euro', 'alt'].includes(tour)) {
    return NextResponse.json({ error: 'Invalid tour parameter. Must be one of: pga, opp, euro, alt' }, { status: 400 })
  }

  const supabase = createSupabaseClient()
  
  try {
    console.log(`🏌️ Starting betting markets ingestion for ${tour.toUpperCase()} tour`);
    
    // Fetch from DataGolf
    const [dg3, dg2, dgField] = await Promise.all([
      fetchDG(getDG3BallURL(tour)),
      fetchDG(getDG2BallURL(tour)),
      fetchDG(getDGFieldUpdatesURL(tour)),
    ])

    // Validate and normalize match lists
    const matchList3 = validateMatchList(dg3, '3-ball');
    const matchList2 = validateMatchList(dg2, '2-ball');

    if (matchList3.length === 0 && matchList2.length === 0) {
      return NextResponse.json({ 
        inserted: 0,
        three_ball: 0,
        two_ball: 0,
        message: `No matchups available for ${tour.toUpperCase()} tour`,
        tour: tour
      })
    }

    // Resolve tournament name
    const eventName = dg3.event_name || dg2.event_name;
    const resolver = new TournamentNameResolver();
    const tournamentMatch = await resolver.resolveTournamentName(eventName, tour);
    
    if (!tournamentMatch) {
      return NextResponse.json({ 
        inserted: 0,
        three_ball: 0,
        two_ball: 0,
        message: `Could not find tournament for event_name: ${eventName}`,
        debug: { eventName, tour }
      }, { status: 404 })
    }
    
    // Get tournament UUID from the new tournaments table
    const tournamentUuid = await getTournamentUuid(supabase, tournamentMatch.event_id);
    if (!tournamentUuid) {
      return NextResponse.json({ 
        inserted: 0,
        message: `Tournament UUID not found for event_id: ${tournamentMatch.event_id}`,
        debug: { eventName, eventId: tournamentMatch.event_id }
      }, { status: 404 })
    }

    // Get sportsbook mapping
    const sportsbookMap = await getSportsbookMap(supabase);
    
    // Extract all unique player IDs and ensure they exist in players table
    const allPlayerIds: number[] = [];
    const addPlayerId = (id: number) => {
      if (id && !allPlayerIds.includes(id)) {
        allPlayerIds.push(id);
      }
    };
    
    [...matchList3, ...matchList2].forEach((m: any) => {
      addPlayerId(m.p1_dg_id);
      addPlayerId(m.p2_dg_id);
      if (m.p3_dg_id) addPlayerId(m.p3_dg_id);
    });
    
    console.log(`👥 Found ${allPlayerIds.length} unique players in matchups`);
    
    // Extract player data from matchups for upserting
    const allPlayers: { dg_id: number, name: string }[] = [];
    const addPlayer = (dg_id: number, name: string) => {
      if (dg_id && name && !allPlayers.some(p => p.dg_id === dg_id)) {
        allPlayers.push({ dg_id, name });
      }
    };
    
    [...matchList3, ...matchList2].forEach((m: any) => {
      addPlayer(m.p1_dg_id, m.p1_player_name);
      addPlayer(m.p2_dg_id, m.p2_player_name);
      if (m.p3_dg_id) addPlayer(m.p3_dg_id, m.p3_player_name);
    });

    // Upsert all unique players into the players table
    if (allPlayers.length > 0) {
      console.log(`👥 Upserting ${allPlayers.length} players...`);
      const { error: upsertError } = await supabase
        .from('players')
        .upsert(allPlayers, { onConflict: 'dg_id' });
      if (upsertError) {
        console.error('Player upsert error:', upsertError);
        throw new Error(`Could not upsert players: ${upsertError.message}`);
      }
      console.log(`✅ Successfully upserted ${allPlayers.length} players`);
    }

    // Get player UUID mapping (after upserting)
    const playerMap = await getPlayerMap(supabase, allPlayerIds);
    
    // Check for any remaining missing players
    const missingPlayers = allPlayerIds.filter(id => !playerMap[id]);
    if (missingPlayers.length > 0) {
      console.log(`⚠️ Still missing ${missingPlayers.length} players after upsert:`, missingPlayers);
    }

    // Create tee time maps for each round
    const teeTimeMap3 = createTeeTimeMap(dgField, dg3.round_num);
    const teeTimeMap2 = createTeeTimeMap(dgField, dg2.round_num);
    
    // Transform matchups to betting markets
    const markets3 = await transformToBettingMarkets(
      matchList3, '3ball', tournamentUuid, sportsbookMap, playerMap, dg3.round_num, teeTimeMap3, eventName
    );
    const markets2 = await transformToBettingMarkets(
      matchList2, '2ball', tournamentUuid, sportsbookMap, playerMap, dg2.round_num, teeTimeMap2, eventName
    );
    
    const allMarkets = [...markets3, ...markets2];
    
    if (allMarkets.length === 0) {
      return NextResponse.json({ 
        inserted: 0, 
        three_ball: 0, 
        two_ball: 0, 
        message: 'No betting markets created - no odds available' 
      })
    }

    // Clear existing markets for this tournament/round to avoid duplicates
    const roundsToDelete = [...new Set([dg3.round_num, dg2.round_num].filter(Boolean))];
    for (const round of roundsToDelete) {
      const { error: deleteError } = await supabase
        .from('betting_markets')
        .delete()
        .eq('tournament_id', tournamentUuid)
        .eq('round_specific', round);
        
      if (deleteError) {
        console.log(`⚠️ Error clearing existing markets for round ${round}:`, deleteError);
      } else {
        console.log(`🧹 Cleared existing markets for tournament ${tournamentUuid}, round ${round}`);
      }
    }

    // Insert new betting markets
    console.log(`💾 Inserting ${allMarkets.length} betting markets...`);
    
    const { error: insertError } = await supabase
      .from('betting_markets')
      .insert(allMarkets);
    
    if (insertError) {
      console.error('❌ Failed to insert betting markets:', insertError);
      throw new Error(`Failed to insert betting markets: ${insertError.message}`);
    }
    
    console.log(`✅ Successfully inserted ${allMarkets.length} betting markets`);
    
    return NextResponse.json({
      inserted: allMarkets.length,
      three_ball: markets3.length,
      two_ball: markets2.length,
      tour: tour,
      tournament: eventName,
      tournament_id: tournamentUuid,
      rounds: roundsToDelete,
      debug: {
        eventName,
        tournamentMatch: tournamentMatch.event_id,
        sportsbooksAvailable: Object.keys(sportsbookMap).length,
        playersFound: Object.keys(playerMap).length,
        playersMissing: missingPlayers.length
      }
    })
    
  } catch (err: any) {
    console.error('❌ Betting markets ingestion error:', err);
    return NextResponse.json({ 
      error: err.message || 'Unknown error',
      tour: tour
    }, { status: 500 })
  }
}
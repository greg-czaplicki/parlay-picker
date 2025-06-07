import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY
const INGEST_SECRET = process.env.INGEST_SECRET // Set this in your env for security

// Updated to support tour parameter
function getDG3BallURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
}

function getDG2BallURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=round_matchups&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
}

function getDGModelURL(tour: string = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups-all-pairings?tour=${tour}&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
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
  
  // Check if match_list is a string (error message from DataGolf)
  if (typeof matchData.match_list === 'string') {
    console.log(`${marketType} match_list is a string: ${matchData.match_list}`);
    return [];
  }
  
  // Check if it's an array
  if (!Array.isArray(matchData.match_list)) {
    console.log(`${marketType} match_list is not an array:`, typeof matchData.match_list);
    return [];
  }
  
  return matchData.match_list;
}

function findPairing(pairings: any[], playerIds: number[]) {
  const inputIds = playerIds.filter(Boolean).map(Number).sort((a, b) => a - b);
  for (const pairing of pairings) {
    const ids = [pairing.p1?.dg_id, pairing.p2?.dg_id, pairing.p3?.dg_id].filter(Boolean).map(Number).sort((a, b) => a - b);
    if (ids.length === inputIds.length && ids.every((id, i) => id === inputIds[i])) {
      return pairing;
    }
  }
  return null;
}

function transformMatchups(matchups: any[], pairings: any[], type: '2ball' | '3ball', event_id: number, round_num: number, created_at: string, dgIdToUuid: Record<number, string>) {
  // Debug: Log the first few 2-ball matchups' odds structure
  if (type === '2ball' && matchups.length > 0) {
    console.log(`\n=== 2-BALL ODDS DEBUG (${type}) ===`);
    matchups.slice(0, 3).forEach((m, i) => {
      console.log(`\nMatchup ${i + 1}: ${m.p1_player_name} vs ${m.p2_player_name}`);
      console.log('Raw odds object:', JSON.stringify(m.odds, null, 2));
      console.log('FanDuel p1:', m.odds?.fanduel?.p1);
      console.log('FanDuel p2:', m.odds?.fanduel?.p2);
      console.log('DraftKings p1:', m.odds?.draftkings?.p1);
      console.log('DraftKings p2:', m.odds?.draftkings?.p2);
    });
    console.log('=== END 2-BALL ODDS DEBUG ===\n');
  }

  return matchups.map(m => {
    const playerIds = type === '3ball'
      ? [m.p1_dg_id, m.p2_dg_id, m.p3_dg_id]
      : [m.p1_dg_id, m.p2_dg_id];
    const pairing = findPairing(pairings, playerIds);
    return {
      event_id,
      round_num,
      type,
      player1_id: dgIdToUuid[m.p1_dg_id] ?? null,
      player1_dg_id: m.p1_dg_id,
      player1_name: m.p1_player_name,
      player2_id: dgIdToUuid[m.p2_dg_id] ?? null,
      player2_dg_id: m.p2_dg_id,
      player2_name: m.p2_player_name,
      player3_id: type === '3ball' ? (dgIdToUuid[m.p3_dg_id] ?? null) : null,
      player3_dg_id: type === '3ball' ? m.p3_dg_id : null,
      player3_name: type === '3ball' ? m.p3_player_name : null,
      odds1: m.odds?.fanduel?.p1 ?? m.odds?.draftkings?.p1 ?? null,
      odds2: m.odds?.fanduel?.p2 ?? m.odds?.draftkings?.p2 ?? null,
      odds3: type === '3ball' ? (m.odds?.fanduel?.p3 ?? m.odds?.draftkings?.p3 ?? null) : null,
      dg_odds1: m.odds?.datagolf?.p1 ?? null,
      dg_odds2: m.odds?.datagolf?.p2 ?? null,
      dg_odds3: type === '3ball' ? (m.odds?.datagolf?.p3 ?? null) : null,
      start_hole: pairing?.start_hole ?? null,
      teetime: pairing?.teetime ?? null,
      tee_time: pairing?.teetime ? new Date(pairing.teetime).toISOString() : null,
      created_at,
    }
  });
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
    // Fetch from DataGolf (main + model odds) for the specified tour
    const [dg3, dg2, dgModel] = await Promise.all([
      fetchDG(getDG3BallURL(tour)),
      fetchDG(getDG2BallURL(tour)),
      fetchDG(getDGModelURL(tour)),
    ])

    // Validate and normalize match lists
    const matchList3 = validateMatchList(dg3, '3-ball');
    const matchList2 = validateMatchList(dg2, '2-ball');

    // If no matchups are available at all, return early
    if (matchList3.length === 0 && matchList2.length === 0) {
      return NextResponse.json({ 
        inserted: 0, 
        three_ball: 0,
        two_ball: 0,
        message: `No matchups available for ${tour.toUpperCase()} tour`,
        debug: {
          eventName: dg3.event_name,
          match_list_3_type: typeof dg3.match_list,
          match_list_2_type: typeof dg2.match_list,
          match_list_3_value: dg3.match_list,
          match_list_2_value: dg2.match_list,
        }
      })
    }

    // Dynamically map event_name to event_id
    const eventName = dg3.event_name;
    const { data: eventRows, error: eventError } = await supabase
      .from('tournaments')
      .select('event_id')
      .eq('event_name', eventName)
      .limit(1);
    
    if (eventError || !eventRows || eventRows.length === 0) {
      // Check if this is a known issue (like LIV events not in database)
      if (eventName && eventName.toLowerCase().includes('liv')) {
        return NextResponse.json({ 
          inserted: 0,
          three_ball: 0,
          two_ball: 0,
          message: `LIV events are not currently supported. Event: ${eventName}`,
          debug: { eventName, tour }
        })
      }
      
      throw new Error(`Could not find event_id for event_name: ${eventName}`);
    }
    const event_id = eventRows[0].event_id;
    const round_num_3 = dg3.round_num;
    const round_num_2 = dg2.round_num;
    const created_at_3 = new Date(dg3.last_updated.replace(' UTC', 'Z')).toISOString();
    const created_at_2 = new Date(dg2.last_updated.replace(' UTC', 'Z')).toISOString();

    // --- NEW: Extract all unique players from both 2ball and 3ball matchups ---
    const allPlayers: { dg_id: number, name: string }[] = [];
    const addPlayer = (dg_id: number, name: string) => {
      if (dg_id && name && !allPlayers.some(p => p.dg_id === dg_id)) {
        allPlayers.push({ dg_id, name });
      }
    };
    
    // Use validated match lists
    matchList3.forEach((m: any) => {
      addPlayer(m.p1_dg_id, m.p1_player_name);
      addPlayer(m.p2_dg_id, m.p2_player_name);
      if (m.p3_dg_id) addPlayer(m.p3_dg_id, m.p3_player_name);
    });
    matchList2.forEach((m: any) => {
      addPlayer(m.p1_dg_id, m.p1_player_name);
      addPlayer(m.p2_dg_id, m.p2_player_name);
    });
    // Upsert all unique players into the players table
    if (allPlayers.length > 0) {
      const { error: upsertError } = await supabase
        .from('players')
        .upsert(allPlayers, { onConflict: 'dg_id' });
      if (upsertError) {
        throw new Error(`Could not upsert players: ${upsertError.message}`);
      }
    }
    // --- END NEW ---

    // Gather all unique DG_IDs from both 2ball and 3ball matchups
    const allDgIds = [
      ...new Set([
        ...matchList3.flatMap((m: any) => [m.p1_dg_id, m.p2_dg_id, m.p3_dg_id]),
        ...matchList2.flatMap((m: any) => [m.p1_dg_id, m.p2_dg_id]),
      ].filter(Boolean))
    ];
    // Fetch UUIDs for all DG_IDs
    const { data: playerRows, error: playerError } = await supabase
      .from('players')
      .select('uuid, dg_id')
      .in('dg_id', allDgIds);
    if (playerError) {
      throw new Error(`Could not fetch player UUIDs: ${playerError.message}`);
    }
    const dgIdToUuid: Record<number, string> = {};
    (playerRows ?? []).forEach((row: any) => {
      if (row.dg_id && row.uuid) dgIdToUuid[Number(row.dg_id)] = row.uuid;
    });

    const matchups3 = transformMatchups(matchList3, dgModel.pairings, '3ball', event_id, round_num_3, created_at_3, dgIdToUuid);
    const matchups2 = transformMatchups(matchList2, dgModel.pairings, '2ball', event_id, round_num_2, created_at_2, dgIdToUuid);
    
    // Insert into matchups table
    const allMatchups = [...matchups3, ...matchups2]
    if (allMatchups.length === 0) {
      return NextResponse.json({ inserted: 0, three_ball: 0, two_ball: 0, message: 'No matchups to insert' })
    }
    // Debug log: show first object to be inserted
    console.log('Sample matchup to insert:', JSON.stringify(allMatchups[0], null, 2))
    const { error } = await supabase.from('matchups').insert(allMatchups)
    if (error) {
      console.error('Supabase insert error:', error)
    }
    // Debug info
    const sampleMain = matchups3[0]
    // Collect a sample of odds for inspection - INCLUDE BOTH 3-BALL AND 2-BALL
    const oddsSamples = allMatchups.slice(0, 15).map(m => ({
      type: m.type, // Add type to see which are 2-ball vs 3-ball
      player1: m.player1_name,
      fanduel1: m.odds1,
      dg1: m.dg_odds1,
      player2: m.player2_name,
      fanduel2: m.odds2,
      dg2: m.dg_odds2,
      player3: m.player3_name,
      fanduel3: m.odds3,
      dg3: m.dg_odds3,
    }));
    
    // Also add some raw 2-ball data for debugging
    const raw2BallSample = matchList2[0];
    
    return NextResponse.json({
      inserted: allMatchups.length,
      three_ball: matchups3.length,
      two_ball: matchups2.length,
      tour: tour,
      debug: {
        sampleMain,
        oddsSamples,
        raw2BallSample, // Add raw 2-ball structure
        tour: tour,
        eventName: dg3.event_name,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
} 
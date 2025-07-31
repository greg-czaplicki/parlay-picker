import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { TournamentNameResolver } from '@/lib/services/tournament-name-resolver'
import { convertTournamentTimeToUTC } from '@/lib/timezone-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

// Create tee time mapping from field updates
function createTeeTimeMap(fieldData: any, roundNum: number): Record<number, { teetime: string | null, start_hole: number }> {
  const teeTimeMap: Record<number, { teetime: string | null, start_hole: number }> = {};
  
  if (!fieldData.field || !Array.isArray(fieldData.field)) {
    console.log('⚠️ No field data available for tee times');
    return teeTimeMap;
  }
  
  const roundKey = `r${roundNum}_teetime`;
  console.log(`📅 Creating tee time map for round ${roundNum} using field key: ${roundKey}`);
  
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

// Generate stable matchup key that matches the database function
function generateMatchupKey(
  eventId: number,
  roundNum: number,
  type: string,
  player1DgId: number,
  player2DgId: number,
  player3DgId: number | null
): string {
  // Sort player IDs to ensure consistent keys
  const playerIds = type === '3ball' && player3DgId 
    ? [player1DgId, player2DgId, player3DgId].sort((a, b) => a - b)
    : [player1DgId, player2DgId].sort((a, b) => a - b);
  
  return `${eventId}_R${roundNum}_${type}_${playerIds.join('_')}`;
}

function findPairing(pairings: any[], playerIds: number[]) {
  const inputIds = playerIds.filter(Boolean).map(Number).sort((a, b) => a - b);
  
  for (const pairing of pairings) {
    const ids = [pairing.p1?.dg_id, pairing.p2?.dg_id, pairing.p3?.dg_id].filter(Boolean).map(Number).sort((a, b) => a - b);
    
    // For 2-ball matchups, we need to check if the 2 input players are part of any 3-player pairing
    // OR if there's an exact 2-player match
    if (inputIds.length === 2) {
      // Check if both players are in this pairing (regardless of whether it's 2 or 3 players)
      if (inputIds.every(id => ids.includes(id))) {
        return pairing;
      }
    } else {
      // For 3-ball matchups, require exact match
      if (ids.length === inputIds.length && ids.every((id, i) => id === inputIds[i])) {
        return pairing;
      }
    }
  }
  
  return null;
}

// Helper function to get odds from available sportsbooks with priority order
function getOddsWithFallback(oddsObj: any, player: 'p1' | 'p2' | 'p3'): { odds: number | null, sportsbook: string | null } {
  if (!oddsObj) return { odds: null, sportsbook: null };
  
  // Priority order for sportsbooks
  const priorityBooks = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'bet365', 'pointsbet', 'unibet', 'betcris', 'betonline', 'bovada'];
  
  for (const book of priorityBooks) {
    if (oddsObj[book]?.[player]) {
      return { odds: oddsObj[book][player], sportsbook: book };
    }
  }
  
  return { odds: null, sportsbook: null };
}

// Helper function to check if matchup has FanDuel odds
function hasFanDuelOdds(oddsObj: any, type: '2ball' | '3ball'): boolean {
  if (!oddsObj?.fanduel) return false;
  
  const hasP1 = oddsObj.fanduel.p1 !== null && oddsObj.fanduel.p1 !== undefined;
  const hasP2 = oddsObj.fanduel.p2 !== null && oddsObj.fanduel.p2 !== undefined;
  const hasP3 = type === '3ball' ? (oddsObj.fanduel.p3 !== null && oddsObj.fanduel.p3 !== undefined) : true;
  
  return hasP1 && hasP2 && hasP3;
}

function transformMatchups(matchups: any[], pairings: any[], type: '2ball' | '3ball', event_id: number, round_num: number, created_at: string, teeTimeMap: Record<number, { teetime: string | null, start_hole: number }>, tournamentName: string, courseName?: string) {
  // Track odds availability stats
  let matchupsWithOdds = 0;
  let matchupsWithoutOdds = 0;
  let matchupsWithFanDuel = 0;
  let matchupsWithoutFanDuel = 0;

  const transformed = matchups.map(m => {
    const playerIds = type === '3ball'
      ? [m.p1_dg_id, m.p2_dg_id, m.p3_dg_id]
      : [m.p1_dg_id, m.p2_dg_id];
    
    // Get tee time from the first player (they should all have the same tee time in a group)
    const player1TeeTime = teeTimeMap[m.p1_dg_id];
    const player2TeeTime = teeTimeMap[m.p2_dg_id];
    
    // Use the earliest tee time if they differ, or fallback to pairing logic
    let teetime = player1TeeTime?.teetime || player2TeeTime?.teetime;
    let start_hole = player1TeeTime?.start_hole || player2TeeTime?.start_hole || 1;
    
    // For 3-ball, check the third player too
    if (type === '3ball' && m.p3_dg_id) {
      const player3TeeTime = teeTimeMap[m.p3_dg_id];
      if (!teetime && player3TeeTime?.teetime) {
        teetime = player3TeeTime.teetime;
        start_hole = player3TeeTime.start_hole || 1;
      }
    }
    
    // Fallback to pairing logic if no tee time found
    if (!teetime) {
      const pairing = findPairing(pairings, playerIds);
      teetime = pairing?.teetime ?? null;
      start_hole = pairing?.start_hole ?? start_hole;
    }
    
    // Check if this matchup has FanDuel odds
    const hasFanDuel = hasFanDuelOdds(m.odds, type);
    if (hasFanDuel) {
      matchupsWithFanDuel++;
    } else {
      matchupsWithoutFanDuel++;
    }
    
    // Prioritize FanDuel odds first
    const fanDuelOdds1 = m.odds?.fanduel?.p1 ?? null;
    const fanDuelOdds2 = m.odds?.fanduel?.p2 ?? null;
    const fanDuelOdds3 = type === '3ball' ? (m.odds?.fanduel?.p3 ?? null) : null;
    
    // Get fallback odds for backup
    const fallbackOdds1Result = getOddsWithFallback(m.odds, 'p1');
    const fallbackOdds2Result = getOddsWithFallback(m.odds, 'p2');
    const fallbackOdds3Result = type === '3ball' ? getOddsWithFallback(m.odds, 'p3') : { odds: null, sportsbook: null };
    
    // Track if this matchup has FanDuel odds vs any odds
    if (fanDuelOdds1 || fanDuelOdds2 || fanDuelOdds3) {
      matchupsWithOdds++;
    } else {
      matchupsWithoutOdds++;
    }
    
    // For v2 schema, we only need dg_ids, not UUIDs
    // Generate stable matchup key
    const matchupKey = generateMatchupKey(
      event_id,
      round_num,
      type,
      m.p1_dg_id,
      m.p2_dg_id,
      type === '3ball' ? m.p3_dg_id : null
    );

    const record: any = {
      // Required legacy fields
      market_type: 'matchup',
      market_name: `${m.p1_player_name} vs ${m.p2_player_name}${type === '3ball' ? ` vs ${m.p3_player_name}` : ''}`,
      
      // New schema columns
      matchup_key: matchupKey,
      event_id,
      round_num,
      type,
      player1_dg_id: m.p1_dg_id,
      player1_name: m.p1_player_name,
      player2_dg_id: m.p2_dg_id,
      player2_name: m.p2_player_name,
      player3_dg_id: type === '3ball' ? m.p3_dg_id : null,
      player3_name: type === '3ball' ? m.p3_player_name : null,
      odds1: fanDuelOdds1,
      odds2: fanDuelOdds2,
      odds3: fanDuelOdds3,
      dg_odds1: m.odds?.datagolf?.p1 ?? null,
      dg_odds2: m.odds?.datagolf?.p2 ?? null,
      dg_odds3: type === '3ball' ? (m.odds?.datagolf?.p3 ?? null) : null,
      start_hole: start_hole,
      tee_time: teetime ? convertTournamentTimeToUTC(teetime, tournamentName, courseName) : null,
      created_at,
    };

    // For 2-ball matchups, store individual player tee times
    if (type === '2ball') {
      record.player1_tee_time = player1TeeTime?.teetime ? convertTournamentTimeToUTC(player1TeeTime.teetime, tournamentName, courseName) : null;
      record.player2_tee_time = player2TeeTime?.teetime ? convertTournamentTimeToUTC(player2TeeTime.teetime, tournamentName, courseName) : null;
    }

    return record;
  });
  
  // Log odds availability statistics
  console.log(`📊 ${type} matchups: ${matchupsWithFanDuel}/${transformed.length} have FanDuel odds, ${matchupsWithOdds}/${transformed.length} have any odds`);
  
  return transformed;
}

// New function to update tee times for existing matchups
async function updateExistingTeetimes(supabase: any, event_id: number, round_num: number, teeTimeMap: Record<number, { teetime: string | null, start_hole: number }>, tournamentName: string, courseName?: string) {
  console.log(`🔄 Updating tee times for existing matchups - Event ${event_id}, Round ${round_num}`);
  
  // Get all existing matchups for this event/round
  const { data: existingMatchups, error: fetchError } = await supabase
    .from('betting_markets')
    .select('id, player1_dg_id, player2_dg_id, player3_dg_id, tee_time, type')
    .eq('event_id', event_id)
    .eq('round_num', round_num);
    
  if (fetchError) {
    throw new Error(`Could not fetch existing matchups: ${fetchError.message}`);
  }
  
  if (!existingMatchups || existingMatchups.length === 0) {
    console.log('⚠️ No existing matchups found to update');
    return { updated: 0 };
  }
  
  console.log(`📊 Found ${existingMatchups.length} existing matchups to check for tee time updates`);
  
  const updates = [];
  
  for (const matchup of existingMatchups) {
    // Get tee time from any of the players in the matchup
    const player1TeeTime = teeTimeMap[matchup.player1_dg_id];
    const player2TeeTime = teeTimeMap[matchup.player2_dg_id];
    const player3TeeTime = matchup.player3_dg_id ? teeTimeMap[matchup.player3_dg_id] : null;
    
    // Use the first available tee time
    let newTeetime = player1TeeTime?.teetime || player2TeeTime?.teetime || player3TeeTime?.teetime;
    let start_hole = player1TeeTime?.start_hole || player2TeeTime?.start_hole || player3TeeTime?.start_hole || 1;
    
    // Convert existing tee_time back to string for comparison
    const existingTeetime = matchup.tee_time ? new Date(matchup.tee_time).toISOString() : null;
    const newTeetimeISO = newTeetime ? convertTournamentTimeToUTC(newTeetime, tournamentName, courseName) : null;
    
    // Only update if the tee time has changed
    if (newTeetimeISO !== existingTeetime) {
      const updateRecord: any = {
        id: matchup.id,
        tee_time: newTeetimeISO,
        start_hole: start_hole
      };

      // For 2-ball matchups, also update individual player tee times
      if (matchup.type === '2ball') {
        updateRecord.player1_tee_time = player1TeeTime?.teetime ? convertTournamentTimeToUTC(player1TeeTime.teetime, tournamentName, courseName) : null;
        updateRecord.player2_tee_time = player2TeeTime?.teetime ? convertTournamentTimeToUTC(player2TeeTime.teetime, tournamentName, courseName) : null;
      }

      updates.push(updateRecord);
      
      if (newTeetime) {
        console.log(`✅ Will update matchup ${matchup.id} (${matchup.type}) with tee time: ${newTeetime}`);
      } else {
        console.log(`❌ Will clear tee time for matchup ${matchup.id} (${matchup.type}) - player(s) didn't make cut`);
      }
    }
  }
  
  // Batch update all matchups that need tee time changes
  if (updates.length > 0) {
    console.log(`🔄 Updating ${updates.length} matchups with new tee times...`);
    
    for (const update of updates) {
      const updateFields: any = {
        tee_time: update.tee_time,
        start_hole: update.start_hole
      };

      // Include individual player tee times if they exist in the update record
      if (update.player1_tee_time !== undefined) {
        updateFields.player1_tee_time = update.player1_tee_time;
        updateFields.player2_tee_time = update.player2_tee_time;
      }

      const { error: updateError } = await supabase
        .from('betting_markets')
        .update(updateFields)
        .eq('id', update.id);
        
      if (updateError) {
        console.error(`❌ Failed to update matchup ${update.id}:`, updateError);
      }
    }
    
    console.log(`✅ Successfully updated tee times for ${updates.length} matchups`);
  } else {
    console.log('ℹ️ No tee time updates needed - all matchups already have current tee times');
  }
  
  return { updated: updates.length };
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
    // Fetch from DataGolf (main + model odds + field updates) for the specified tour
    const [dg3, dg2, dgModel, dgField] = await Promise.all([
      fetchDG(getDG3BallURL(tour)),
      fetchDG(getDG2BallURL(tour)),
      fetchDG(getDGModelURL(tour)),
      fetchDG(getDGFieldUpdatesURL(tour)),
    ])

    // Validate and normalize match lists
    const matchList3 = validateMatchList(dg3, '3-ball');
    const matchList2 = validateMatchList(dg2, '2-ball');

    // If no matchups are available, try to update tee times for existing matchups
    if (matchList3.length === 0 && matchList2.length === 0) {
      console.log('⚠️ No new matchups available - attempting to update existing tee times');
      
      const eventName = dg3.event_name || dg2.event_name || dgField.event_name;
      const currentRound = dgField.current_round;
      
      if (eventName) {
        // Find the event_id
        const { data: eventRows, error: eventError } = await supabase
          .from('tournaments')
          .select('event_id')
          .eq('event_name', eventName)
          .limit(1);
        
        if (!eventError && eventRows && eventRows.length > 0) {
          const event_id = eventRows[0].event_id;
          
          // Create tee time map for current round
          const teeTimeMap = createTeeTimeMap(dgField, currentRound);
          
          // Update existing matchups
          const updateResult = await updateExistingTeetimes(supabase, event_id, currentRound, teeTimeMap, eventName);
          
          return NextResponse.json({
            inserted: 0,
            updated: updateResult.updated,
            three_ball: 0,
            two_ball: 0,
            message: `No new matchups available. Updated tee times for ${updateResult.updated} existing matchups.`,
            tour: tour,
            event_name: eventName,
            round: currentRound,
            debug: {
              eventName: eventName,
              match_list_3_type: typeof dg3.match_list,
              match_list_2_type: typeof dg2.match_list,
              match_list_3_value: dg3.match_list,
              match_list_2_value: dg2.match_list,
            }
          });
        }
      }
      
      return NextResponse.json({ 
        inserted: 0,
        updated: 0,
        three_ball: 0,
        two_ball: 0,
        message: `No matchups available for ${tour.toUpperCase()} tour and could not update existing tee times`,
        debug: {
          eventName: eventName,
          match_list_3_type: typeof dg3.match_list,
          match_list_2_type: typeof dg2.match_list,
          match_list_3_value: dg3.match_list,
          match_list_2_value: dg2.match_list,
        }
      })
    }

    // Simplified tournament matching - direct database lookup
    const eventName = dg3.event_name;
    console.log(`🔍 Looking for tournament: "${eventName}" on tour: ${tour}`);
    
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('dg_id, name, tour, start_date, end_date')
      .eq('name', eventName)
      .eq('tour', tour)
      .limit(1)
      .single();
      
    if (tournamentError || !tournamentData) {
      console.error('Tournament lookup error:', tournamentError);
      console.log('Available tournaments sample:');
      
      // Get some recent tournaments for debugging
      const { data: sampleTournaments } = await supabase
        .from('tournaments')
        .select('name, tour')
        .eq('tour', tour)
        .order('start_date', { ascending: false })
        .limit(5);
        
      return NextResponse.json({ 
        inserted: 0,
        three_ball: 0,
        two_ball: 0,
        message: `Could not find tournament for event_name: ${eventName}`,
        debug: { 
          eventName, 
          tour,
          error: tournamentError?.message,
          sampleTournaments: sampleTournaments || []
        }
      }, { status: 404 })
    }
    
    const event_id = tournamentData.dg_id;
    console.log(`✅ Found tournament: ${tournamentData.name} (ID: ${event_id})`);
    
    // Store tournament info for later use
    const courseName = undefined; // No course_name in tournaments table
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

    // No need to fetch UUIDs anymore - v2 schema uses dg_id as primary identifier

    // Create tee time maps for each round
    const teeTimeMap3 = createTeeTimeMap(dgField, round_num_3);
    const teeTimeMap2 = createTeeTimeMap(dgField, round_num_2);

    const matchups3 = transformMatchups(matchList3, dgModel.pairings, '3ball', event_id, round_num_3, created_at_3, teeTimeMap3, eventName, courseName);
    const matchups2 = transformMatchups(matchList2, dgModel.pairings, '2ball', event_id, round_num_2, created_at_2, teeTimeMap2, eventName, courseName);
    
    // Insert into matchups table
    const allMatchups = [...matchups3, ...matchups2]
    if (allMatchups.length === 0) {
      return NextResponse.json({ inserted: 0, three_ball: 0, two_ball: 0, message: 'No matchups to insert' })
    }
    // Debug log: show first object to be inserted
    console.log('Sample matchup to upsert:', JSON.stringify(allMatchups[0], null, 2))
    
    // First, capture current odds as snapshots before updating
    console.log(`📸 Capturing odds snapshots for event ${event_id}, rounds ${round_num_3}/${round_num_2}`);
    
    // Get existing matchups to create snapshots
    const { data: existingMatchups } = await supabase
      .from('betting_markets')
      .select('*')
      .eq('event_id', event_id)
      .in('round_num', [round_num_3, round_num_2]);
    
    if (existingMatchups && existingMatchups.length > 0) {
      // Create snapshots of current odds before updating
      const snapshots = existingMatchups.map(m => ({
        matchup_key: m.matchup_key,
        event_id: m.event_id,
        round_num: m.round_num,
        type: m.type,
        player1_dg_id: m.player1_dg_id,
        player1_name: m.player1_name,
        player2_dg_id: m.player2_dg_id,
        player2_name: m.player2_name,
        player3_dg_id: m.player3_dg_id,
        player3_name: m.player3_name,
        odds1: m.odds1,
        odds2: m.odds2,
        odds3: m.odds3,
        dg_odds1: m.dg_odds1,
        dg_odds2: m.dg_odds2,
        dg_odds3: m.dg_odds3,
        source: 'datagolf',
        last_updated: m.updated_at || m.created_at
      }));
      
      const { error: snapshotError } = await supabase
        .from('betting_markets_snapshots')
        .insert(snapshots);
        
      if (snapshotError) {
        console.error('Failed to create odds snapshots:', snapshotError);
      } else {
        console.log(`✅ Created ${snapshots.length} odds snapshots`);
      }
    }
    
    // Use UPSERT with matchup_key to update existing or insert new
    console.log(`🔄 Upserting ${allMatchups.length} matchups for event ${event_id}`);
    
    const { error } = await supabase
      .from('betting_markets')
      .upsert(allMatchups, { 
        onConflict: 'matchup_key',
        ignoreDuplicates: false 
      })
    
    if (error) {
      console.error('Supabase upsert error:', error)
      throw new Error(`Failed to upsert matchups: ${error.message}`)
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
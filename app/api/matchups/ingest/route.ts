import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY
const INGEST_SECRET = process.env.INGEST_SECRET // Set this in your env for security

// Add explicit type for TOUR_CODES with index signature
const TOUR_CODES: Record<string, string> = {
  pga: 'pga',
  euro: 'euro',
  opp: 'opp',
  alt: 'alt',
};

function getTourCode(tour: string) {
  return TOUR_CODES[tour?.toLowerCase()] || 'pga';
}

function dg3BallUrl(tour: string) {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`;
}
function dg2BallUrl(tour: string) {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=round_matchups&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`;
}
function dgModelUrl(tour: string) {
  return `https://feeds.datagolf.com/betting-tools/matchups-all-pairings?tour=${tour}&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`;
}

async function fetchDG(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Failed to fetch DataGolf: ${url}`)
  return res.json()
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
  const supabase = createSupabaseClient()
  try {
    // Fetch all active tournaments (status = 'active' or similar)
    const { data: tournaments, error: tErr } = await supabase
      .from('tournaments')
      .select('event_id, event_name, tour');
    if (tErr) throw new Error(`Could not fetch tournaments: ${tErr.message}`);
    if (!tournaments || tournaments.length === 0) {
      throw new Error('No tournaments found');
    }
    let totalInserted = 0;
    let debugEvents: any[] = [];
    for (const event of tournaments) {
      const tourCode = getTourCode(event.tour);
      const eventName = event.event_name;
      const eventId = event.event_id;
      try {
        // Fetch DataGolf data for this tour/event
        const [dg3, dg2, dgModel] = await Promise.all([
          fetchDG(dg3BallUrl(tourCode)),
          fetchDG(dg2BallUrl(tourCode)),
          fetchDG(dgModelUrl(tourCode)),
        ]);
        // Defensive: check event name matches
        if (dg3.event_name !== eventName && dg2.event_name !== eventName) {
          debugEvents.push({ eventId, eventName, tour: event.tour, error: 'Event name mismatch', dg3Event: dg3.event_name, dg2Event: dg2.event_name });
          continue;
        }
        const round_num_3 = dg3.round_num;
        const round_num_2 = dg2.round_num;
        const created_at_3 = new Date(dg3.last_updated.replace(' UTC', 'Z')).toISOString();
        const created_at_2 = new Date(dg2.last_updated.replace(' UTC', 'Z')).toISOString();
        // --- Extract all unique players from both 2ball and 3ball matchups ---
        const allPlayers: { dg_id: number, name: string }[] = [];
        const addPlayer = (dg_id: number, name: string) => {
          if (dg_id && name && !allPlayers.some(p => p.dg_id === dg_id)) {
            allPlayers.push({ dg_id, name });
          }
        };
        dg3.match_list.forEach((m: any) => {
          addPlayer(m.p1_dg_id, m.p1_player_name);
          addPlayer(m.p2_dg_id, m.p2_player_name);
          if (m.p3_dg_id) addPlayer(m.p3_dg_id, m.p3_player_name);
        });
        dg2.match_list.forEach((m: any) => {
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
        // Gather all unique DG_IDs from both 2ball and 3ball matchups
        const allDgIds = [
          ...new Set([
            ...dg3.match_list.flatMap((m: any) => [m.p1_dg_id, m.p2_dg_id, m.p3_dg_id]),
            ...dg2.match_list.flatMap((m: any) => [m.p1_dg_id, m.p2_dg_id]),
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
        const matchups3 = transformMatchups(dg3.match_list, dgModel.pairings, '3ball', eventId, round_num_3, created_at_3, dgIdToUuid);
        const matchups2 = transformMatchups(dg2.match_list, dgModel.pairings, '2ball', eventId, round_num_2, created_at_2, dgIdToUuid);
        const allMatchups = [...matchups3, ...matchups2];
        if (allMatchups.length > 0) {
          const { error } = await supabase.from('matchups').insert(allMatchups);
          if (error) {
            debugEvents.push({ eventId, eventName, tour: event.tour, error: error.message });
          } else {
            totalInserted += allMatchups.length;
            debugEvents.push({ eventId, eventName, tour: event.tour, inserted: allMatchups.length });
          }
        } else {
          debugEvents.push({ eventId, eventName, tour: event.tour, inserted: 0, message: 'No matchups to insert' });
        }
      } catch (err: any) {
        debugEvents.push({ eventId, eventName, tour: event.tour, error: err.message });
      }
    }
    return NextResponse.json({ totalInserted, events: debugEvents });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
} 
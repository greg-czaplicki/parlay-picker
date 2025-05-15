import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY
const INGEST_SECRET = process.env.INGEST_SECRET // Set this in your env for security

const DG_3BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
const DG_2BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?market=round_matchups&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`
const DG_MODEL_URL = `https://feeds.datagolf.com/betting-tools/matchups-all-pairings?tour=pga&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`

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

function transformMatchups(matchups: any[], pairings: any[], type: '2ball' | '3ball', event_id: number, round_num: number, created_at: string) {
  return matchups.map(m => {
    const playerIds = type === '3ball'
      ? [m.p1_dg_id, m.p2_dg_id, m.p3_dg_id]
      : [m.p1_dg_id, m.p2_dg_id];
    const pairing = findPairing(pairings, playerIds);
    return {
      event_id,
      round_num,
      type,
      player1_id: m.p1_dg_id,
      player1_name: m.p1_player_name,
      player2_id: m.p2_dg_id,
      player2_name: m.p2_player_name,
      player3_id: type === '3ball' ? m.p3_dg_id : null,
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
    // Fetch from DataGolf (main + model odds)
    const [dg3, dg2, dgModel] = await Promise.all([
      fetchDG(DG_3BALL_URL),
      fetchDG(DG_2BALL_URL),
      fetchDG(DG_MODEL_URL),
    ])
    // You may want to map event_name to event_id from your tournaments table
    // For now, use a fallback event_id (e.g., 1) and round_num from DG
    const event_id = 1 // TODO: Map this properly
    const round_num_3 = dg3.round_num
    const round_num_2 = dg2.round_num
    const created_at_3 = new Date(dg3.last_updated.replace(' UTC', 'Z')).toISOString()
    const created_at_2 = new Date(dg2.last_updated.replace(' UTC', 'Z')).toISOString()
    const matchups3 = transformMatchups(dg3.match_list, dgModel.pairings, '3ball', event_id, round_num_3, created_at_3)
    const matchups2 = transformMatchups(dg2.match_list, dgModel.pairings, '2ball', event_id, round_num_2, created_at_2)
    // Insert into matchups table
    const allMatchups = [...matchups3, ...matchups2]
    if (allMatchups.length === 0) {
      return NextResponse.json({ inserted: 0, message: 'No matchups to insert' })
    }
    // Debug log: show first object to be inserted
    console.log('Sample matchup to insert:', JSON.stringify(allMatchups[0], null, 2))
    const { error } = await supabase.from('matchups').insert(allMatchups)
    if (error) {
      console.error('Supabase insert error:', error)
    }
    // Debug info
    const sampleMain = matchups3[0]
    // Collect a sample of odds for inspection
    const oddsSamples = allMatchups.slice(0, 10).map(m => ({
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
    return NextResponse.json({
      inserted: allMatchups.length,
      three_ball: matchups3.length,
      two_ball: matchups2.length,
      debug: {
        sampleMain,
        oddsSamples,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
} 
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TODO: Replace with env vars or shared util
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// POST: Create a new parlay and its picks
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, user_id, amount, odds, payout, round_num, picks } = body
  // picks: [{ matchup_id, picked_player_id, picked_player_name }]
  if (!user_id || !Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Missing user_id or picks' }, { status: 400 })
  }
  // Insert parlay
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .insert([
      {
        name,
        user_id,
        amount,
        odds,
        payout,
        round_num,
        status: 'pending',
        is_settled: false,
      },
    ])
    .select()
    .single()
  if (parlayError) return NextResponse.json({ error: parlayError.message }, { status: 400 })
  // Insert picks
  const picksToInsert = picks.map((pick: any) => ({
    parlay_id: parlay.id,
    matchup_id: pick.matchup_id,
    picked_player_id: pick.picked_player_id,
    picked_player_name: pick.picked_player_name,
  }))
  const { error: picksError } = await supabase.from('parlay_picks').insert(picksToInsert)
  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 400 })
  return NextResponse.json({ parlay })
}

// GET: Fetch all parlays for a user, with picks, matchups, and players
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ parlays: [] })
  // Fetch parlays
  const { data: parlays, error: parlaysError } = await supabase
    .from('parlays')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (parlaysError) return NextResponse.json({ error: parlaysError.message }, { status: 400 })
  // Fetch picks for all parlays
  const parlayIds = parlays.map((p: any) => p.id)
  let picks = []
  if (parlayIds.length > 0) {
    const { data: picksData, error: picksError } = await supabase
      .from('parlay_picks')
      .select('*')
      .in('parlay_id', parlayIds)
    if (picksError) return NextResponse.json({ error: picksError.message }, { status: 400 })
    picks = picksData
  }
  // Fetch matchups and players for all picks
  const matchupIds = picks.map((pick: any) => pick.matchup_id).filter(Boolean)
  const playerIds = picks.map((pick: any) => pick.picked_player_id).filter(Boolean)
  let matchups = []
  let players = []
  if (matchupIds.length > 0) {
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .in('id', matchupIds)
    if (matchupsError) return NextResponse.json({ error: matchupsError.message }, { status: 400 })
    matchups = matchupsData
  }
  if (playerIds.length > 0) {
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds)
    if (playersError) return NextResponse.json({ error: playersError.message }, { status: 400 })
    players = playersData
  }

  // --- NEW: Fetch live stats for all players in all matchups for the correct round(s) ---
  // Collect all player names and round numbers from matchups
  const allPlayerNames = new Set<string>();
  const allRoundNums = new Set<number>();
  matchups.forEach((m: any) => {
    if (m.player1_name) allPlayerNames.add(m.player1_name);
    if (m.player2_name) allPlayerNames.add(m.player2_name);
    if (m.player3_name) allPlayerNames.add(m.player3_name);
    if (m.round_num) allRoundNums.add(m.round_num);
  });
  let liveStats: any[] = [];
  if (allPlayerNames.size > 0 && allRoundNums.size > 0) {
    const { data: statsData, error: statsError } = await supabase
      .from('live_tournament_stats')
      .select('player_name,round_num,total,thru')
      .in('player_name', Array.from(allPlayerNames))
      .in('round_num', Array.from(allRoundNums).map(String));
    if (!statsError && statsData) liveStats = statsData;
  }
  // Helper to get stats for a player/round
  function getStats(playerName: string, roundNum: number) {
    return liveStats.find(
      (s) => s.player_name === playerName && String(s.round_num) === String(roundNum)
    );
  }
  // --- END NEW ---

  // Assemble UI-ready parlays
  console.log('DEBUG: picks', JSON.stringify(picks, null, 2));
  console.log('DEBUG: matchups', JSON.stringify(matchups, null, 2));
  const parlaysWithDetails = parlays.map((parlay: any) => {
    const parlayPicks = picks.filter((pick: any) => pick.parlay_id === parlay.id)
    const picksWithDetails = parlayPicks.map((pick: any) => {
      const matchup = matchups.find((m: any) => String(m.id) === String(pick.matchup_id))
      console.log('DEBUG: pick.matchup_id', pick.matchup_id, 'matched matchup:', matchup)
      // Build full player array for the matchup, merging stats
      let playersInMatchup: any[] = [];
      if (matchup) {
        if (matchup.player1_id && matchup.player1_name) {
          const stats = getStats(matchup.player1_name, matchup.round_num) || {};
          playersInMatchup.push({
            id: matchup.player1_id,
            name: matchup.player1_name,
            isUserPick: pick.picked_player_id === matchup.player1_id,
            currentPosition: '-',
            totalScore: typeof stats.total === 'number' ? stats.total : 0,
            roundScore: 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : 0,
            totalHoles: 18,
          });
        }
        if (matchup.player2_id && matchup.player2_name) {
          const stats = getStats(matchup.player2_name, matchup.round_num) || {};
          playersInMatchup.push({
            id: matchup.player2_id,
            name: matchup.player2_name,
            isUserPick: pick.picked_player_id === matchup.player2_id,
            currentPosition: '-',
            totalScore: typeof stats.total === 'number' ? stats.total : 0,
            roundScore: 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : 0,
            totalHoles: 18,
          });
        }
        if (matchup.type === '3ball' && matchup.player3_id && matchup.player3_name) {
          const stats = getStats(matchup.player3_name, matchup.round_num) || {};
          playersInMatchup.push({
            id: matchup.player3_id,
            name: matchup.player3_name,
            isUserPick: pick.picked_player_id === matchup.player3_id,
            currentPosition: '-',
            totalScore: typeof stats.total === 'number' ? stats.total : 0,
            roundScore: 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : 0,
            totalHoles: 18,
          });
        }
      }
      console.log('DEBUG: playersInMatchup for pick', pick.id, playersInMatchup)
      // Always return a players array (never undefined)
      if (!Array.isArray(playersInMatchup)) playersInMatchup = [];
      return {
        ...pick,
        players: playersInMatchup,
      }
    })
    return {
      ...parlay,
      picks: Array.isArray(picksWithDetails) ? picksWithDetails : [],
    }
  })
  return NextResponse.json({ parlays: parlaysWithDetails })
} 
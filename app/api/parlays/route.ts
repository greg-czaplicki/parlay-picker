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
  // picks: [{ matchup_id, picked_player_dg_id, picked_player_name }]
  if (!user_id || !Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'Missing user_id or picks' }, { status: 400 })
  }
  
  // Get matchup data for all picks to calculate odds and store snapshot data
  const pickMatchupIds = picks.map((pick: any) => pick.matchup_id).filter(Boolean)
  let matchupData = []
  if (pickMatchupIds.length > 0) {
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('betting_markets')
      .select('*')
      .in('id', pickMatchupIds)
    if (matchupsError) return NextResponse.json({ error: matchupsError.message }, { status: 400 })
    matchupData = matchupsData || []
  }
  
  // Calculate total parlay odds and validate picks
  let totalDecimalOdds = 1.0
  const defaultStake = amount || 10
  const picksToInsert = []
  
  for (const pick of picks) {
    const matchup = matchupData.find((m: any) => m.id === pick.matchup_id)
    if (!matchup) {
      return NextResponse.json({ error: `Matchup not found: ${pick.matchup_id}` }, { status: 400 })
    }
    
    // Determine player position and get snapshot data
    let playerPosition = 0
    let playerName = ''
    let playerOdds = 0
    
    if (matchup.player1_dg_id === pick.picked_player_dg_id) {
      playerPosition = 1
      playerName = matchup.player1_name || ''
      const decimalOdds = Number(matchup.odds1) || 1.01 // Default to minimum valid odds
      // Store decimal odds directly (database expects decimal odds >= 1.01)
      playerOdds = decimalOdds
    } else if (matchup.player2_dg_id === pick.picked_player_dg_id) {
      playerPosition = 2
      playerName = matchup.player2_name || ''
      const decimalOdds = Number(matchup.odds2) || 1.01 // Default to minimum valid odds
      // Store decimal odds directly (database expects decimal odds >= 1.01)
      playerOdds = decimalOdds
    } else if (matchup.player3_dg_id === pick.picked_player_dg_id) {
      playerPosition = 3
      playerName = matchup.player3_name || ''
      const decimalOdds = Number(matchup.odds3) || 1.01 // Default to minimum valid odds
      // Store decimal odds directly (database expects decimal odds >= 1.01)
      playerOdds = decimalOdds
    } else {
      return NextResponse.json({ error: `Player DG ID ${pick.picked_player_dg_id} not found in matchup ${pick.matchup_id}` }, { status: 400 })
    }
    
    // Use decimal odds directly for calculation
    if (playerOdds > 1) {
      totalDecimalOdds *= playerOdds
    }
    
    picksToInsert.push({
      matchup_id: pick.matchup_id, // UUID from betting_markets table
      selection_name: playerName,
      odds_at_bet: Number(playerOdds),
      outcome: 'pending',
      selection_criteria: {
        picked_player_dg_id: Number(pick.picked_player_dg_id),
        player_position: playerPosition,
        event_id: matchup.event_id ? Number(matchup.event_id) : null
      }
    })
  }
  
  // Calculate final parlay odds and payout
  const americanOdds = totalDecimalOdds >= 2.0 
    ? Math.round((totalDecimalOdds - 1) * 100)
    : Math.round(-100 / (totalDecimalOdds - 1))
  const calculatedPayout = Math.round(defaultStake * totalDecimalOdds)
  const firstRound = matchupData[0]?.round_num || round_num || 1
  
  // Insert parlay with calculated values into parlays table
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .insert([
      {
        user_id,
        name: name || `Parlay - $${defaultStake}`,
        amount: defaultStake,
        payout: calculatedPayout,
        odds: americanOdds,
        actual_payout: 0.00,
        outcome: null, // Parlay outcome is null until all picks are settled
        status: 'active'
      },
    ])
    .select()
    .single()
  if (parlayError) return NextResponse.json({ error: parlayError.message }, { status: 400 })
  
  // Insert picks into parlay_picks table
  const picksWithParlayId = picksToInsert.map(pick => ({
    ...pick,
    parlay_id: parlay.id,
  }))
  const { error: picksError } = await supabase.from('parlay_picks').insert(picksWithParlayId)
  if (picksError) return NextResponse.json({ error: picksError.message }, { status: 400 })
  
  return NextResponse.json({ parlay })
}

// GET: Fetch all parlays for a user, with picks and live stats overlay
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  const bustCache = searchParams.get('_t') // Cache-busting timestamp
  
  if (!user_id) {
    const response = NextResponse.json({ parlays: [] })
    
    // If cache busting is requested, set no-cache headers
    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }
    
    return response
  }
  
  // Fetch parlays from database
  const { data: parlays, error: parlaysError } = await supabase
    .from('parlays')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (parlaysError) return NextResponse.json({ error: parlaysError.message }, { status: 400 })
  
  // Fetch picks from database
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
  
  // Fetch matchups only for live stats lookup (we already have player info stored)
  const matchupIds = picks.map((pick: any) => pick.matchup_id).filter(Boolean)
  let matchups: any[] = []
  if (matchupIds.length > 0) {
    const { data: matchupsData, error: matchupsError } = await supabase
      .from('betting_markets')
      .select('id, type, round_num, event_id, player1_name, player2_name, player3_name, player1_dg_id, player2_dg_id, player3_dg_id, odds1, odds2, odds3, tee_time')
      .in('id', matchupIds)
    if (matchupsError) return NextResponse.json({ error: matchupsError.message }, { status: 400 })
    matchups = matchupsData || []
  }

  // Get tournament names for the events in our matchups using exact same lookup as sync
  const eventIds = [...new Set(matchups.map((m: any) => m.event_id).filter(Boolean))]
  let tournamentsByEventId: { [key: number]: string } = {}
  let activeTournamentNames: string[] = []
  
  if (eventIds.length > 0) {
    const { data: tournamentsData, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('dg_id, name, start_date, end_date')
      .in('dg_id', eventIds)
    if (!tournamentsError && tournamentsData) {
      // Check which tournaments are currently active
      const today = new Date().toISOString().split('T')[0];
      
      // Create a mapping of event_id to tournament name and track tournaments with parlays
      tournamentsData.forEach((t: any) => {
        if (t.dg_id && t.name) {
          tournamentsByEventId[t.dg_id] = t.name
          
          // For parlay display, we want stats for tournaments that either:
          // 1. Are currently active (for live parlays), OR
          // 2. Have parlays in our system (for settled parlays)
          // This ensures settled parlays show final scores instead of resetting
          const isActive = t.start_date && t.end_date && 
                          today >= t.start_date && today <= t.end_date;
          
          const hasParlay = eventIds.includes(t.dg_id);
          
          if (isActive || hasParlay) {
            activeTournamentNames.push(t.name);
          }
        }
      })
    }
  }
  
  // Fetch live stats for all players in all matchups (for both active and settled parlays)
  const allPlayerNames = new Set<string>()
  const allRoundNums = new Set<number>()
  matchups.forEach((m: any) => {
    if (m.player1_name) allPlayerNames.add(m.player1_name)
    if (m.player2_name) allPlayerNames.add(m.player2_name)
    if (m.player3_name) allPlayerNames.add(m.player3_name)
    if (m.round_num) allRoundNums.add(m.round_num)
  })
  
  let liveStats: any[] = []
  if (activeTournamentNames.length > 0 && allPlayerNames.size > 0 && allRoundNums.size > 0) {
    const { data: statsData, error: statsError } = await supabase
      .from('live_tournament_stats')
      .select('player_name,round_num,position,total,thru,today,event_name')
      .in('player_name', Array.from(allPlayerNames))
      .in('round_num', Array.from(allRoundNums).map(String))
      .in('event_name', activeTournamentNames)  // Fetch stats for tournaments with parlays
    if (!statsError && statsData) liveStats = statsData
  }
  
  // Helper to get stats for a player/round/tournament
  function getStats(playerName: string, roundNum: number, eventId?: number) {
    if (activeTournamentNames.length === 0) return null; // No tournaments with parlays
    
    // If we have an eventId, get the specific tournament name for this matchup
    const targetTournamentName = eventId ? tournamentsByEventId[eventId] : null;
    
    return liveStats.find(
      (s) => s.player_name === playerName && 
             String(s.round_num) === String(roundNum) &&
             (targetTournamentName ? s.event_name === targetTournamentName : activeTournamentNames.includes(s.event_name))
    )
  }

  // Helper to get historical stats from tournament_round_snapshots for settled parlays
  async function getHistoricalStats(playerName: string, roundNum: number, eventName: string) {
    try {
      const { data: snapshot } = await supabase
        .from('tournament_round_snapshots')
        .select('*')
        .eq('player_name', playerName)
        .eq('event_name', eventName)
        .eq('round_num', String(roundNum))
        .order('snapshot_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (snapshot) {
        return {
          player_name: snapshot.player_name,
          round_num: String(roundNum),
          position: snapshot.position,
          thru: snapshot.thru || 18,
          today: snapshot.round_score,
          total: snapshot.total_score,
          event_name: snapshot.event_name
        }
      }
      return null
    } catch (error) {
      return null
    }
  }

  // Build parlays with picks using stored data + live stats overlay
  const parlaysWithDetails = await Promise.all(parlays.map(async (parlay: any) => {
    const parlayPicks = picks.filter((pick: any) => pick.parlay_id === parlay.id)
    
    // Get tournament name from the first matchup's event_id
    let tournamentName = 'Unknown Tournament'
    if (parlayPicks.length > 0) {
      const firstPick = parlayPicks[0]
      const firstMatchup = matchups.find((m: any) => String(m.id) === String(firstPick.matchup_id))
      if (firstMatchup?.event_id && tournamentsByEventId[firstMatchup.event_id]) {
        tournamentName = tournamentsByEventId[firstMatchup.event_id]
      }
    }
    
    const picksWithDetails = await Promise.all(parlayPicks.map(async (pick: any) => {
      const matchup = matchups.find((m: any) => String(m.id) === String(pick.matchup_id))
      
      // Use the parlay's round number for historical data, not the matchup's current round
      const displayRound = parlay.round_num || matchup?.round_num || 1
      
      // Check if this pick is settled to determine data source
      const isPickSettled = pick.settled_at !== null || 
                           (pick.outcome && ['win', 'loss', 'push', 'void'].includes(pick.outcome))
      
      // Build player array for the matchup
      let playersInMatchup: any[] = []
      if (matchup) {
        const eventName = tournamentsByEventId[matchup.event_id]
        
        // Extract pick information from selection_criteria
        const pickedPlayerDgId = pick.selection_criteria?.picked_player_dg_id
        const playerPosition = pick.selection_criteria?.player_position
        
        // Helper to get player stats with fallback logic
        const getPlayerStats = async (playerName: string) => {
          // For settled picks, prefer historical data from snapshots
          if (isPickSettled && eventName) {
            const historicalStats = await getHistoricalStats(playerName, displayRound, eventName)
            if (historicalStats) return historicalStats
          }
          
          // Fallback to live stats (for active parlays or when historical data unavailable)
          return getStats(playerName, displayRound, matchup.event_id) || {}
        }
        
        if (matchup.player1_dg_id && matchup.player1_name) {
          const stats = await getPlayerStats(matchup.player1_name)
          playersInMatchup.push({
            id: matchup.player1_dg_id,
            name: matchup.player1_name,
            isUserPick: Number(matchup.player1_dg_id) === Number(pickedPlayerDgId),
            currentPosition: typeof stats.position === 'string' ? stats.position : '-',
            totalScore: typeof stats.total === 'number' ? stats.total : Number(stats.total) || 0,
            roundScore: typeof stats.today === 'number' ? stats.today : Number(stats.today) || 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : (isPickSettled ? 18 : 0),
            totalHoles: 18,
          })
        }
        if (matchup.player2_dg_id && matchup.player2_name) {
          const stats = await getPlayerStats(matchup.player2_name)
          playersInMatchup.push({
            id: matchup.player2_dg_id,
            name: matchup.player2_name,
            isUserPick: Number(matchup.player2_dg_id) === Number(pickedPlayerDgId),
            currentPosition: typeof stats.position === 'string' ? stats.position : '-',
            totalScore: typeof stats.total === 'number' ? stats.total : Number(stats.total) || 0,
            roundScore: typeof stats.today === 'number' ? stats.today : Number(stats.today) || 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : (isPickSettled ? 18 : 0),
            totalHoles: 18,
          })
        }
        if (matchup.type === '3ball' && matchup.player3_dg_id && matchup.player3_name) {
          const stats = await getPlayerStats(matchup.player3_name)
          playersInMatchup.push({
            id: matchup.player3_dg_id,
            name: matchup.player3_name,
            isUserPick: Number(matchup.player3_dg_id) === Number(pickedPlayerDgId),
            currentPosition: typeof stats.position === 'string' ? stats.position : '-',
            totalScore: typeof stats.total === 'number' ? stats.total : Number(stats.total) || 0,
            roundScore: typeof stats.today === 'number' ? stats.today : Number(stats.today) || 0,
            holesPlayed: typeof stats.thru === 'number' ? stats.thru : (isPickSettled ? 18 : 0),
            totalHoles: 18,
          })
        }
      }
      
      // Always return a players array (never undefined)
      if (!Array.isArray(playersInMatchup)) playersInMatchup = []
      return {
        ...pick,
        players: playersInMatchup,
        tee_time: matchup?.tee_time || null, // Include tee time for sorting
      }
    }))
    
    // Return parlay data (no mapping needed - fields match frontend expectations)
    return {
      ...parlay,
      tournament_name: tournamentName,
      picks: Array.isArray(picksWithDetails) ? picksWithDetails : [],
    }
  }))
  
  const response = NextResponse.json({ parlays: parlaysWithDetails })

  // If cache busting is requested, set no-cache headers
  if (bustCache) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return response
} 
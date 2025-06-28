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
      .from('matchups')
      .select('*')
      .in('uuid', pickMatchupIds)
    if (matchupsError) return NextResponse.json({ error: matchupsError.message }, { status: 400 })
    matchupData = matchupsData || []
  }
  
  // Calculate total parlay odds and validate picks
  let totalDecimalOdds = 1.0
  const defaultStake = amount || 10
  const picksToInsert = []
  
  for (const pick of picks) {
    const matchup = matchupData.find((m: any) => m.uuid === pick.matchup_id)
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
      const decimalOdds = Number(matchup.odds1) || 0
      // Convert decimal odds to American odds for storage (with safety checks)
      if (decimalOdds <= 1) {
        playerOdds = 100 // Default for invalid odds
      } else if (decimalOdds >= 2.0) {
        playerOdds = Math.round((decimalOdds - 1) * 100)  // Positive American odds
      } else {
        playerOdds = Math.round(-100 / (decimalOdds - 1)) // Negative American odds
      }
    } else if (matchup.player2_dg_id === pick.picked_player_dg_id) {
      playerPosition = 2
      playerName = matchup.player2_name || ''
      const decimalOdds = Number(matchup.odds2) || 0
      if (decimalOdds <= 1) {
        playerOdds = 100
      } else if (decimalOdds >= 2.0) {
        playerOdds = Math.round((decimalOdds - 1) * 100)
      } else {
        playerOdds = Math.round(-100 / (decimalOdds - 1))
      }
    } else if (matchup.player3_dg_id === pick.picked_player_dg_id) {
      playerPosition = 3
      playerName = matchup.player3_name || ''
      const decimalOdds = Number(matchup.odds3) || 0
      if (decimalOdds <= 1) {
        playerOdds = 100
      } else if (decimalOdds >= 2.0) {
        playerOdds = Math.round((decimalOdds - 1) * 100)
      } else {
        playerOdds = Math.round(-100 / (decimalOdds - 1))
      }
    } else {
      return NextResponse.json({ error: `Player DG ID ${pick.picked_player_dg_id} not found in matchup ${pick.matchup_id}` }, { status: 400 })
    }
    
    // Calculate decimal odds for this pick (using the original decimal odds)
    const decimalOddsForCalculation = playerOdds > 0 
      ? (playerOdds / 100) + 1
      : (100 / Math.abs(playerOdds)) + 1
    
    // Only multiply if we have valid odds
    if (decimalOddsForCalculation > 1) {
      totalDecimalOdds *= decimalOddsForCalculation
    }
    
    picksToInsert.push({
      matchup_id: pick.matchup_id,
      pick: playerPosition,
      picked_player_name: playerName,
      picked_player_dg_id: pick.picked_player_dg_id,
      picked_player_odds: playerOdds,
      pick_outcome: 'pending',
      outcome: 'void', // Legacy field
      event_id: matchup.event_id, // Populate event_id for settlement detection
    })
  }
  
  // Calculate final parlay odds and payout
  const americanOdds = totalDecimalOdds >= 2.0 
    ? Math.round((totalDecimalOdds - 1) * 100)
    : Math.round(-100 / (totalDecimalOdds - 1))
  const calculatedPayout = Math.round(defaultStake * totalDecimalOdds)
  const firstRound = matchupData[0]?.round_num || round_num || 1
  
  // Insert parlay with calculated values
  const { data: parlay, error: parlayError } = await supabase
    .from('parlays')
    .insert([
      {
        user_id,
        amount: defaultStake,
        total_odds: americanOdds,
        potential_payout: calculatedPayout,
        actual_payout: 0.00,
        round_num: firstRound,
        outcome: null, // Parlay outcome is null until all picks are settled
        payout_amount: '0.00',
      },
    ])
    .select()
    .single()
  if (parlayError) return NextResponse.json({ error: parlayError.message }, { status: 400 })
  
  // Insert picks with snapshot data
  const picksWithParlayId = picksToInsert.map(pick => ({
    ...pick,
    parlay_id: parlay.uuid,
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
  
  // Fetch parlays with stored calculated values
  const { data: parlays, error: parlaysError } = await supabase
    .from('parlays')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
  if (parlaysError) return NextResponse.json({ error: parlaysError.message }, { status: 400 })
  
  // Fetch picks with stored snapshot data
  const parlayIds = parlays.map((p: any) => p.uuid)
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
      .from('matchups')
      .select('uuid, type, round_num, event_id, player1_name, player2_name, player3_name, player1_dg_id, player2_dg_id, player3_dg_id, odds1, odds2, odds3, tee_time')
      .in('uuid', matchupIds)
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
      .select('event_id, event_name, start_date, end_date')
      .in('event_id', eventIds)
    if (!tournamentsError && tournamentsData) {
      // Check which tournaments are currently active
      const today = new Date().toISOString().split('T')[0];
      
      // Create a mapping of event_id to tournament name and track tournaments with parlays
      tournamentsData.forEach((t: any) => {
        if (t.event_id && t.event_name) {
          tournamentsByEventId[t.event_id] = t.event_name
          
          // For parlay display, we want stats for tournaments that either:
          // 1. Are currently active (for live parlays), OR
          // 2. Have parlays in our system (for settled parlays)
          // This ensures settled parlays show final scores instead of resetting
          const isActive = t.start_date && t.end_date && 
                          today >= t.start_date && today <= t.end_date;
          
          const hasParlay = eventIds.includes(t.event_id);
          
          if (isActive || hasParlay) {
            activeTournamentNames.push(t.event_name);
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
    const parlayPicks = picks.filter((pick: any) => pick.parlay_id === parlay.uuid)
    
    // Get tournament name from the first matchup's event_id
    let tournamentName = 'Unknown Tournament'
    if (parlayPicks.length > 0) {
      const firstPick = parlayPicks[0]
      const firstMatchup = matchups.find((m: any) => String(m.uuid) === String(firstPick.matchup_id))
      if (firstMatchup?.event_id && tournamentsByEventId[firstMatchup.event_id]) {
        tournamentName = tournamentsByEventId[firstMatchup.event_id]
      }
    }
    
    const picksWithDetails = await Promise.all(parlayPicks.map(async (pick: any) => {
      const matchup = matchups.find((m: any) => String(m.uuid) === String(pick.matchup_id))
      
      // Use the parlay's round number for historical data, not the matchup's current round
      const displayRound = parlay.round_num || matchup?.round_num || 1
      
      // Check if this pick is settled to determine data source
      const isPickSettled = pick.settlement_status === 'settled' || 
                           (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome))
      
      // Build player array for the matchup
      let playersInMatchup: any[] = []
      if (matchup) {
        const eventName = tournamentsByEventId[matchup.event_id]
        
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
            isUserPick: pick.pick === 1,
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
            isUserPick: pick.pick === 2,
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
            isUserPick: pick.pick === 3,
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
    
    // Return parlay with stored calculated values (no more calculations needed!)
    return {
      ...parlay,
      odds: parlay.total_odds,        // Map total_odds to odds for frontend
      payout: parlay.potential_payout, // Map potential_payout to payout for frontend
      tournament_name: tournamentName, // Add tournament name for display
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
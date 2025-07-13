import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// Force this route to be dynamic and bypass edge caching
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// GET: Fetch matchups with enhanced SG data
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('matchupType') || searchParams.get('type')
  const event_id = searchParams.get('eventId') || searchParams.get('event_id')
  const round_num = searchParams.get('roundNum') || searchParams.get('round_num')
  const checkOnly = searchParams.get('checkOnly') === 'true'
  const bustCache = searchParams.get('_t') // Cache-busting timestamp

  // Handle checkOnly requests separately (no need for SG data)
  if (checkOnly) {
    const baseCountQuery = supabase
      .from('matchups_v2')
      .select('*', { count: 'exact', head: true })

    const countQuery = type ? baseCountQuery.eq('type', type) : baseCountQuery
    const finalCountQuery = event_id ? countQuery.eq('event_id', event_id) : countQuery
    const completeCountQuery = round_num ? finalCountQuery.eq('round_num', round_num) : finalCountQuery

    const { error, count } = await completeCountQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const response = NextResponse.json({ 
      matchups: (count ?? 0) > 0 ? [{ available: true }] : [], 
      count: count ?? 0
    })

    // If cache busting is requested, set no-cache headers
    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return response
  }

  try {
    // 1. Fetch base matchup data
    const baseQuery = supabase
      .from('matchups_v2')
      .select(`
        id,
        event_id,
        round_num,
        type,
        player1_dg_id,
        player1_name,
        player2_dg_id,
        player2_name,
        player3_dg_id,
        player3_name,
        odds1,
        odds2,
        odds3,
        dg_odds1,
        dg_odds2,
        dg_odds3,
        start_hole,
        tee_time,
        player1_tee_time,
        player2_tee_time,
        created_at
      `)

    const query = type ? baseQuery.eq('type', type) : baseQuery
    const finalQuery = event_id ? query.eq('event_id', event_id) : query
    const completeQuery = round_num ? finalQuery.eq('round_num', round_num) : finalQuery

    const { data: matchupsData, error: matchupsError } = await completeQuery
    if (matchupsError) return NextResponse.json({ error: matchupsError.message }, { status: 400 })
    if (!matchupsData || matchupsData.length === 0) {
      const response = NextResponse.json({ matchups: [] })
      
      // If cache busting is requested, set no-cache headers
      if (bustCache) {
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
      }
      
      return response
    }

    // 2. Add event names to matchups
    const eventIds = [...new Set(matchupsData.map(m => m.event_id))]
    let tournamentNames: { [key: number]: string } = {}
    
    if (eventIds.length > 0) {
      const { data: tournamentsData } = await supabase
        .from('tournaments_v2')
        .select('event_id, event_name')
        .in('event_id', eventIds)
      
      if (tournamentsData) {
        tournamentsData.forEach(t => {
          if (t.event_id && t.event_name) {
            tournamentNames[t.event_id] = t.event_name
          }
        })
      }
    }

    // Add event_name to matchups
    const matchupsWithEvents = matchupsData.map(matchup => ({
      ...matchup,
      event_name: tournamentNames[matchup.event_id] || `Event ${matchup.event_id}`
    }))

    // 3. Extract unique player IDs from matchups
    const playerIds = Array.from(new Set(
      matchupsWithEvents.flatMap(matchup => [
        matchup.player1_dg_id,
        matchup.player2_dg_id,
        matchup.player3_dg_id
      ].filter(id => id !== null && id !== undefined))
    ))

    if (playerIds.length === 0) {
      return NextResponse.json({ matchups: matchupsWithEvents })
    }

    // 3a. Fetch DataGolf season-long SG data from player_skill_ratings
    const { data: dgSeasonSgData, error: dgSeasonSgError } = await supabase
      .from('player_skill_ratings')
      .select(`
        dg_id,
        player_name,
        sg_total,
        sg_putt,
        sg_arg,
        sg_app,
        sg_ott,
        driving_acc,
        driving_dist
      `)
      .in('dg_id', playerIds)

    // 3b. Fetch PGA Tour season-long SG data from player_season_stats
    const { data: pgaSeasonSgData, error: pgaSeasonSgError } = await supabase
      .from('player_season_stats')
      .select(`
        dg_id,
        player_name,
        sg_total,
        sg_putt,
        sg_arg,
        sg_app,
        sg_ott
      `)
      .in('dg_id', playerIds)

    // Create DataGolf season SG lookup map
    const dgSeasonSgMap = new Map()
    if (!dgSeasonSgError && dgSeasonSgData) {
      dgSeasonSgData.forEach(player => {
        if (player.dg_id) {
          dgSeasonSgMap.set(player.dg_id, {
            seasonSgTotal: player.sg_total,
            seasonSgPutt: player.sg_putt,
            seasonSgArg: player.sg_arg,
            seasonSgApp: player.sg_app,
            seasonSgOtt: player.sg_ott,
            seasonDrivingAcc: player.driving_acc,
            seasonDrivingDist: player.driving_dist
          })
        }
      })
    }

    // Create PGA Tour season SG lookup map
    const pgaSeasonSgMap = new Map()
    if (!pgaSeasonSgError && pgaSeasonSgData) {
      pgaSeasonSgData.forEach(player => {
        if (player.dg_id) {
          pgaSeasonSgMap.set(player.dg_id, {
            pgaSeasonSgTotal: player.sg_total,
            pgaSeasonSgPutt: player.sg_putt,
            pgaSeasonSgArg: player.sg_arg,
            pgaSeasonSgApp: player.sg_app,
            pgaSeasonSgOtt: player.sg_ott
          })
        }
      })
    }

    // 4. Fetch tournament SG data from latest_live_tournament_stats_view (if in tournament)
    let tournamentSgMap = new Map()
    
    // Try to get current tournament data
    const { data: tournamentSgData, error: tournamentSgError } = await supabase
      .from('latest_live_tournament_stats_view')
      .select(`
        dg_id,
        player_name,
        event_name,
        round_num,
        sg_total,
        sg_putt,
        sg_arg,
        sg_app,
        sg_ott,
        sg_t2g,
        position,
        total,
        today,
        thru
      `)
      .in('dg_id', playerIds)
      .order('data_golf_updated_at', { ascending: false })

    if (!tournamentSgError && tournamentSgData) {
      // Group by dg_id and take the most recent record for each player
      const playerTournamentData = new Map()
      tournamentSgData.forEach(player => {
        if (player.dg_id) {
          if (!playerTournamentData.has(player.dg_id) || 
              (playerTournamentData.get(player.dg_id).round_num < player.round_num)) {
            playerTournamentData.set(player.dg_id, player)
          }
        }
      })
      
      playerTournamentData.forEach((player, dgId) => {
        tournamentSgMap.set(dgId, {
          sgTotal: player.sg_total,
          sgPutt: player.sg_putt,
          sgArg: player.sg_arg,
          sgApp: player.sg_app,
          sgOtt: player.sg_ott,
          sgT2g: player.sg_t2g,
          position: player.position,
          total: player.total,
          today: player.today,
          thru: player.thru,
          eventName: player.event_name,
          roundNum: player.round_num
        })
      })
    }

    // 5. Enhance matchup data with SG stats
    const enhancedMatchups = matchupsWithEvents.map(matchup => {
      // Helper function to get player SG data
      const getPlayerSGData = (dgId: number) => {
        const dgSeasonData = dgSeasonSgMap.get(dgId) || {}
        const pgaSeasonData = pgaSeasonSgMap.get(dgId) || {}
        const tournamentData = tournamentSgMap.get(dgId) || {}
        return {
          ...dgSeasonData,
          ...pgaSeasonData,
          ...tournamentData
        }
      }

      return {
        ...matchup,
        // Add SG data for player 1
        ...(matchup.player1_dg_id && {
          player1_sg_data: getPlayerSGData(matchup.player1_dg_id)
        }),
        // Add SG data for player 2  
        ...(matchup.player2_dg_id && {
          player2_sg_data: getPlayerSGData(matchup.player2_dg_id)
        }),
        // Add SG data for player 3 (if exists)
        ...(matchup.player3_dg_id && {
          player3_sg_data: getPlayerSGData(matchup.player3_dg_id)
        }),
        // Add metadata
        sg_data_enhanced: true,
        dg_season_sg_players: dgSeasonSgMap.size,
        pga_season_sg_players: pgaSeasonSgMap.size,
        tournament_sg_players: tournamentSgMap.size
      }
    })

    console.log(`✅ Enhanced ${enhancedMatchups.length} matchups with SG data (DG Season: ${dgSeasonSgMap.size}, PGA Season: ${pgaSeasonSgMap.size}, Tournament: ${tournamentSgMap.size} players)`)

    const response = NextResponse.json({ matchups: enhancedMatchups })

    // If cache busting is requested, set no-cache headers
    if (bustCache) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
    }

    return response

  } catch (error: any) {
    console.error('Error fetching enhanced matchup data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Bulk insert matchups
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  const body = await req.json()
  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Request body must be a non-empty array of matchups' }, { status: 400 })
  }
  // Validate required fields for each matchup
  for (const m of body) {
    if (!m.event_id || !m.round_num || !m.type || !m.player1_dg_id || !m.player2_dg_id) {
      return NextResponse.json({ error: 'Missing required matchup fields' }, { status: 400 })
    }
  }
  const { error } = await supabase.from('matchups_v2').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
} 
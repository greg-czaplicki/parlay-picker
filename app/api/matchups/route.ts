import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// GET: Fetch only the latest odds for each unique matchup
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('matchupType') || searchParams.get('type')
  const event_id = searchParams.get('eventId') || searchParams.get('event_id')
  const round_num = searchParams.get('roundNum') || searchParams.get('round_num')
  const checkOnly = searchParams.get('checkOnly') === 'true'

  // Handle checkOnly requests separately
  if (checkOnly) {
    const baseCountQuery = supabase
      .from('latest_matchups')
      .select('*', { count: 'exact', head: true })

    const countQuery = type ? baseCountQuery.eq('type', type) : baseCountQuery
    const finalCountQuery = event_id ? countQuery.eq('event_id', event_id) : countQuery
    const completeCountQuery = round_num ? finalCountQuery.eq('round_num', round_num) : finalCountQuery

    const { error, count } = await completeCountQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ 
      matchups: (count ?? 0) > 0 ? [{ available: true }] : [], 
      count: count ?? 0
    })
  }

  // Handle regular data requests
  const baseQuery = supabase
    .from('latest_matchups')
    .select(`
      uuid,
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
      teetime,
      tee_time,
      created_at
    `)

  const query = type ? baseQuery.eq('type', type) : baseQuery
  const finalQuery = event_id ? query.eq('event_id', event_id) : query
  const completeQuery = round_num ? finalQuery.eq('round_num', round_num) : finalQuery

  const { data, error } = await completeQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ matchups: data })
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
  const { error } = await supabase.from('matchups').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
} 
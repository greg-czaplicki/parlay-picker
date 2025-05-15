import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

// GET: Fetch only the latest odds for each unique matchup
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const event_id = searchParams.get('event_id')
  const round_num = searchParams.get('round_num')

  let query = supabase.from('latest_matchups').select('*')
  if (type) query = query.eq('type', type)
  if (event_id) query = query.eq('event_id', event_id)
  if (round_num) query = query.eq('round_num', round_num)
  const { data, error } = await query
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
    if (!m.event_id || !m.round_num || !m.type || !m.player1_id || !m.player2_id) {
      return NextResponse.json({ error: 'Missing required matchup fields' }, { status: 400 })
    }
  }
  const { error } = await supabase.from('matchups').insert(body)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
} 
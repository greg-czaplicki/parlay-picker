import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const DATAGOLF_URL = 'https://feeds.datagolf.com/get-player-list?file_format=json&key=fb03cadc312c2f0015bc8c5354ea'

export async function POST(req: NextRequest) {
  const supabase = createServerClient()
  try {
    const res = await fetch(DATAGOLF_URL)
    if (!res.ok) return NextResponse.json({ error: 'Failed to fetch DataGolf player list' }, { status: 500 })
    const players = await res.json()
    if (!Array.isArray(players)) return NextResponse.json({ error: 'Invalid DataGolf response' }, { status: 500 })

    // Prepare upsert array
    const upserts = players.map((p: any) => ({
      dg_id: p.dg_id,
      name: p.player_name,
      country: p.country,
      country_code: p.country_code,
    }))
    const { error, count } = await supabase.from('players').upsert(upserts, { onConflict: 'dg_id', count: 'exact' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, upserted: upserts.length, count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}

export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
} 
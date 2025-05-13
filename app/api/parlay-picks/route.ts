import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TODO: Replace with env vars or shared util
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: NextRequest) {
  // TODO: Add authentication and input validation
  const pick = await req.json()
  const { data, error } = await supabase
    .from('parlay_picks')
    .insert([pick])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ pick: data })
}

export async function PATCH(req: NextRequest) {
  // TODO: Add authentication and input validation
  const { id, ...fields } = await req.json()
  const { data, error } = await supabase
    .from('parlay_picks')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ pick: data })
}

export async function GET(req: NextRequest) {
  // TODO: Add authentication, filter by parlay_id
  const { searchParams } = new URL(req.url)
  const parlay_id = searchParams.get('parlay_id')
  let query = supabase.from('parlay_picks').select('*')
  if (parlay_id) query = query.eq('parlay_id', parlay_id)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ picks: data })
} 
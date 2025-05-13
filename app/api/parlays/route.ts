import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// TODO: Replace with env vars or shared util
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(req: NextRequest) {
  // TODO: Add authentication and input validation
  const { name, user_id } = await req.json()
  const { data, error } = await supabase
    .from('parlays')
    .insert([{ name, user_id }])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ parlay: data })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ parlays: [] })

  const { data, error } = await supabase
    .from('parlays')
    .select('*, parlay_picks(*)')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ parlays: data })
} 
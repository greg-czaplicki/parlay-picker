import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotService } from '@/lib/snapshot-service'
import { logger } from '@/lib/logger'

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
  
  // FEATURE SNAPSHOTTING: Capture comprehensive snapshot at bet time
  if (data && pick.matchup_id && pick.pick) {
    try {
      const snapshotResult = await snapshotService.captureSnapshot(
        data.id,        // parlay_pick_id
        pick.matchup_id,  // matchup_id
        pick.pick         // picked_player_position (1, 2, or 3)
      );
      
      if (!snapshotResult.success) {
        logger.warn("[POST /api/parlay-picks] Failed to capture snapshot:", snapshotResult.error);
        // Don't fail the response, just log the warning
      } else {
        logger.info("[POST /api/parlay-picks] Successfully captured feature snapshot for pick:", data.id);
      }
    } catch (snapshotError) {
      logger.error("[POST /api/parlay-picks] Unexpected error during snapshot capture:", snapshotError);
      // Don't fail the response for snapshot errors
    }
  }
  
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
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { parlayId, reason } = await request.json()
    
    if (!parlayId) {
      return NextResponse.json({ error: 'Parlay ID is required' }, { status: 400 })
    }

    // Use service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // First, get the parlay details to verify it exists
    const { data: parlay, error: parlayError } = await supabase
      .from('parlays_v2')
      .select('uuid, status, event_id, round_num')
      .eq('uuid', parlayId)
      .single()
    
    if (parlayError || !parlay) {
      return NextResponse.json({ error: 'Parlay not found' }, { status: 404 })
    }

    // Reset the parlay status to pending
    const { error: parlayUpdateError } = await supabase
      .from('parlays_v2')
      .update({
        status: 'pending',
        outcome: null,
        settled_at: null,
        actual_payout: 0
      })
      .eq('uuid', parlayId)

    if (parlayUpdateError) {
      logger.error('Failed to update parlay:', parlayUpdateError)
      return NextResponse.json({ error: 'Failed to update parlay' }, { status: 500 })
    }

    // Reset all picks to unsettled
    const { error: picksUpdateError } = await supabase
      .from('parlay_picks_v2')
      .update({
        settlement_status: 'unsettled',
        pick_outcome: null,
        settled_at: null,
        settlement_notes: null
      })
      .eq('parlay_id', parlayId)

    if (picksUpdateError) {
      logger.error('Failed to update picks:', picksUpdateError)
      return NextResponse.json({ error: 'Failed to update picks' }, { status: 500 })
    }

    // Get the count of updated picks
    const { data: picks, error: countError } = await supabase
      .from('parlay_picks_v2')
      .select('uuid')
      .eq('parlay_id', parlayId)

    const pickCount = picks?.length || 0

    logger.info(`Reversed settlement for parlay ${parlayId}: ${pickCount} picks reset. Reason: ${reason}`)

    return NextResponse.json({
      success: true,
      message: `Successfully reversed settlement for parlay ${parlayId}`,
      parlay: {
        id: parlayId,
        event_id: parlay.event_id,
        round_num: parlay.round_num,
        picks_reset: pickCount
      },
      reason
    })

  } catch (error) {
    logger.error('Error reversing settlement:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 
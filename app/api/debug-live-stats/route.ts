import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECKING LIVE TOURNAMENT STATS DATA ===')
    
    // Check specifically for The Open Championship
    const { data: openStats, error: openError } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .eq('event_name', 'The Open Championship')
      .limit(200)
    
    console.log('The Open live stats found:', openStats?.length || 0)
    if (openError) console.error('The Open stats error:', openError)
    
    // Check what Round 1 data we have for The Open
    const { data: openR1Stats, error: openR1Error } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .eq('event_name', 'The Open Championship')
      .eq('round_num', '1')
      .limit(200)
    
    console.log('The Open Round 1 stats found:', openR1Stats?.length || 0)
    
    return NextResponse.json({
      openStats: {
        count: openStats?.length || 0,
        sample: openStats?.slice(0, 5) || [],
        error: openError
      },
      openR1Stats: {
        count: openR1Stats?.length || 0,
        sample: openR1Stats?.slice(0, 10) || [],
        error: openR1Error
      }
    })
    
  } catch (error) {
    console.error('Debug live stats error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
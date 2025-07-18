import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    // Check for Round 2 matchups with scores
    const { data: round2Matchups, error } = await supabase
      .from('matchups_v2')
      .select('*')
      .eq('event_id', 100) // The Open
      .eq('round_num', 2)
      .limit(10)

    console.log('Found Round 2 matchups:', round2Matchups?.length || 0)
    
    // Count how many have scores vs null
    const withScores = round2Matchups?.filter(m => 
      m.player1_score !== null || m.player2_score !== null || m.player3_score !== null
    ) || []
    
    const withoutScores = round2Matchups?.filter(m => 
      m.player1_score === null && m.player2_score === null && m.player3_score === null
    ) || []

    console.log('With scores:', withScores.length)
    console.log('Without scores:', withoutScores.length)

    // Also check if there are Round 1 matchups with scores
    const { data: round1Matchups, error: round1Error } = await supabase
      .from('matchups_v2')
      .select('*')
      .eq('event_id', 100) // The Open
      .eq('round_num', 1)
      .limit(5)

    const round1WithScores = round1Matchups?.filter(m => 
      m.player1_score !== null || m.player2_score !== null || m.player3_score !== null
    ) || []

    return NextResponse.json({
      round2: {
        total: round2Matchups?.length || 0,
        withScores: withScores.length,
        withoutScores: withoutScores.length,
        samples: round2Matchups?.slice(0, 3) || []
      },
      round1: {
        total: round1Matchups?.length || 0,
        withScores: round1WithScores.length,
        samples: round1Matchups?.slice(0, 2) || []
      }
    })
    
  } catch (error) {
    console.error('Check matchup scores error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
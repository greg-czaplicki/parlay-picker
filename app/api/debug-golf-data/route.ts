import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUGGING GOLF DATA ===')
    
    // Test direct database queries
    console.log('1. Testing direct tournament query...')
    const { data: tournaments, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .in('event_id', [100, 26, 10022])
      .limit(3)
    
    console.log('Tournament query result:', tournaments?.length || 0, 'tournaments')
    if (tournamentError) console.error('Tournament error:', tournamentError)
    
    console.log('2. Testing direct matchup query...')
    const { data: matchups, error: matchupError } = await supabase
      .from('betting_markets')
      .select('*')
      .in('event_id', [100, 26, 10022])
      .limit(10)
    
    console.log('Matchup query result:', matchups?.length || 0, 'matchups')
    if (matchupError) console.error('Matchup error:', matchupError)
    
    console.log('3. Testing player trends...')
    const { data: trends, error: trendsError } = await supabase
      .from('player_trends')
      .select('*')
      .limit(5)
    
    console.log('Trends query result:', trends?.length || 0, 'trends')
    if (trendsError) console.error('Trends error:', trendsError)
    
    return NextResponse.json({
      success: true,
      data: {
        tournaments: {
          count: tournaments?.length || 0,
          sample: tournaments?.[0] || null,
          error: tournamentError
        },
        matchups: {
          count: matchups?.length || 0,
          sample: matchups?.[0] || null,
          error: matchupError
        },
        trends: {
          count: trends?.length || 0,
          sample: trends?.[0] || null,
          error: trendsError
        }
      }
    })
    
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
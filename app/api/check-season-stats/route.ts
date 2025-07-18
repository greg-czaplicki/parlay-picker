import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== CHECKING SEASON STATS DATA ===')
    
    // Check player_season_stats table
    const { data: seasonStats, error: seasonError } = await supabase
      .from('player_season_stats')
      .select('*')
      .not('sg_total', 'is', null)
      .order('sg_total', { ascending: false })
      .limit(10)
    
    console.log('Season stats found:', seasonStats?.length || 0)
    if (seasonError) console.error('Season stats error:', seasonError)
    
    // Check for specific high-profile players
    const { data: specificPlayers, error: specificError } = await supabase
      .from('player_season_stats')
      .select('*')
      .in('player_name', ['Scheffler, Scottie', 'McIlroy, Rory', 'Rahm, Jon', 'Thomas, Justin'])
      .not('sg_total', 'is', null)
    
    console.log('Specific players season stats:', specificPlayers?.length || 0)
    if (specificError) console.error('Specific players error:', specificError)
    
    // Check the current data aggregation logic
    const { data: currentAggregation, error: aggError } = await supabase
      .from('player_season_stats')
      .select('*')
      .not('sg_total', 'is', null)
      .order('sg_total', { ascending: false })
      .limit(50)
    
    console.log('Current aggregation would get:', currentAggregation?.length || 0)
    
    return NextResponse.json({
      seasonStats: {
        count: seasonStats?.length || 0,
        data: seasonStats || [],
        error: seasonError
      },
      specificPlayers: {
        count: specificPlayers?.length || 0,
        data: specificPlayers || [],
        error: specificError
      },
      currentAggregation: {
        count: currentAggregation?.length || 0,
        sample: currentAggregation?.slice(0, 5) || [],
        error: aggError
      }
    })
    
  } catch (error) {
    console.error('Check season stats error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
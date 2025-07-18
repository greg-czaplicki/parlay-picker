import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUGGING SPAUN ROUND 1 DATA ===')
    
    // Check Spaun in live_tournament_stats
    const { data: spaunLive, error: spaunLiveError } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .eq('event_name', 'The Open Championship')
      .ilike('player_name', '%spaun%')
    
    console.log('Spaun in live stats:', spaunLive?.length || 0)
    
    // Check Spaun in matchups
    const { data: spaunMatchups, error: spaunMatchupError } = await supabase
      .from('matchups_v2')
      .select('*')
      .or('player1_name.ilike.%spaun%,player2_name.ilike.%spaun%,player3_name.ilike.%spaun%')
    
    console.log('Spaun in matchups:', spaunMatchups?.length || 0)
    
    // Check if dg_id matches between tables
    if (spaunLive && spaunLive.length > 0 && spaunMatchups && spaunMatchups.length > 0) {
      const liveDgId = spaunLive[0].dg_id
      const matchupDgIds = []
      
      spaunMatchups.forEach(matchup => {
        if (matchup.player1_name && matchup.player1_name.toLowerCase().includes('spaun')) {
          matchupDgIds.push(matchup.player1_dg_id)
        }
        if (matchup.player2_name && matchup.player2_name.toLowerCase().includes('spaun')) {
          matchupDgIds.push(matchup.player2_dg_id)
        }
        if (matchup.player3_name && matchup.player3_name.toLowerCase().includes('spaun')) {
          matchupDgIds.push(matchup.player3_dg_id)
        }
      })
      
      console.log('Live stats dg_id:', liveDgId)
      console.log('Matchup dg_ids:', matchupDgIds)
    }
    
    return NextResponse.json({
      spaunLive: {
        count: spaunLive?.length || 0,
        data: spaunLive || [],
        error: spaunLiveError
      },
      spaunMatchups: {
        count: spaunMatchups?.length || 0,
        data: spaunMatchups || [],
        error: spaunMatchupError
      }
    })
    
  } catch (error) {
    console.error('Debug Spaun error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
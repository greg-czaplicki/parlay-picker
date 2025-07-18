import { NextRequest, NextResponse } from 'next/server'
import { GolfDataAggregator } from '@/lib/services/data-aggregator'
import { formatMatchupData } from '@/lib/services/llm-client'

const dataAggregator = new GolfDataAggregator()

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUGGING FORMAT MATCHUP DATA ===')
    
    // Get current tournaments
    const tournaments = await dataAggregator.getActiveTournaments()
    const eventIds = tournaments.map(t => t.event_id)
    
    // Get player stats and matchups
    const [playerStats, matchups] = await Promise.all([
      dataAggregator.getPlayerAdvancedStats(eventIds, 200),
      dataAggregator.getCurrentMatchups(50)
    ])
    
    // Find the Spaun/Rahm/Schauffele matchup
    const spaunMatchup = matchups.find(m => 
      (m.player1_name && m.player1_name.toLowerCase().includes('spaun')) ||
      (m.player2_name && m.player2_name.toLowerCase().includes('spaun')) ||
      (m.player3_name && m.player3_name.toLowerCase().includes('spaun'))
    )
    
    // Format the matchups with debug info
    const formattedMatchups = formatMatchupData([spaunMatchup].filter(Boolean), playerStats)
    
    // Check Spaun specifically in playerStats
    const spaunStats = playerStats.filter(stat => stat.dg_id === 17536)
    
    return NextResponse.json({
      tournaments: tournaments.length,
      playerStats: playerStats.length,
      matchups: matchups.length,
      spaunStats: {
        count: spaunStats.length,
        data: spaunStats
      },
      spaunMatchup,
      formattedMatchups,
      samplePlayerStats: playerStats.slice(0, 3)
    })
    
  } catch (error) {
    console.error('Debug format matchup error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
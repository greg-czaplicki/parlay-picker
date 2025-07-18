import { NextRequest, NextResponse } from 'next/server'
import { GolfDataAggregator } from '@/lib/services/data-aggregator'

const dataAggregator = new GolfDataAggregator()

export async function GET(request: NextRequest) {
  try {
    console.log('=== DEBUGGING AI DATA AGGREGATION ===')
    
    // Get the same data that would be passed to AI
    const tournaments = await dataAggregator.getActiveTournaments()
    const eventIds = tournaments.map(t => t.event_id)
    
    console.log('Found tournaments:', tournaments.length, 'with event IDs:', eventIds)
    
    // Get all the data types that AI should receive
    const [
      matchups,
      playerStats,
      trends,
      recentResults,
      historicalResults
    ] = await Promise.all([
      dataAggregator.getCurrentMatchups(30),
      dataAggregator.getPlayerAdvancedStats(eventIds, 50),
      dataAggregator.getPlayerTrends(undefined, 100),
      dataAggregator.getRecentTournamentResults(eventIds, 100),
      dataAggregator.getHistoricalTournamentResults(50)
    ])

    console.log('Data summary:')
    console.log('- Tournaments:', tournaments.length)
    console.log('- Matchups:', matchups.length)
    console.log('- Player stats:', playerStats.length)
    console.log('- Trends:', trends.length)
    console.log('- Recent results:', recentResults.length)
    console.log('- Historical results:', historicalResults.length)

    // Check specific data that AI mentions as missing
    console.log('\n=== CHECKING SPECIFIC DATA ===')
    
    // Check for Round 1 scores (live_tournament_stats)
    const liveStatsWithScores = playerStats.filter(stat => 
      stat.round_1_score || stat.total_score || stat.current_position
    )
    console.log('Live stats with scores/positions:', liveStatsWithScores.length)
    
    // Check for historical results
    const historicalWithPositions = historicalResults.filter(result => 
      result.final_position && result.final_position > 0
    )
    console.log('Historical results with positions:', historicalWithPositions.length)
    
    // Check for current tournament scores
    const currentWithScores = recentResults.filter(result => 
      result.total_score || result.round_1_score
    )
    console.log('Current results with scores:', currentWithScores.length)

    return NextResponse.json({
      summary: {
        tournaments: tournaments.length,
        matchups: matchups.length,
        playerStats: playerStats.length,
        trends: trends.length,
        recentResults: recentResults.length,
        historicalResults: historicalResults.length,
        liveStatsWithScores: liveStatsWithScores.length,
        historicalWithPositions: historicalWithPositions.length,
        currentWithScores: currentWithScores.length
      },
      sampleData: {
        tournament: tournaments[0] || null,
        matchup: matchups[0] || null,
        playerStat: playerStats[0] || null,
        trend: trends[0] || null,
        recentResult: recentResults[0] || null,
        historicalResult: historicalResults[0] || null,
        liveStatWithScore: liveStatsWithScores[0] || null,
        historicalWithPosition: historicalWithPositions[0] || null,
        currentWithScore: currentWithScores[0] || null
      },
      fullData: {
        tournaments,
        eventIds,
        playerStats: playerStats.slice(0, 5), // First 5 for inspection
        recentResults: recentResults.slice(0, 5), // First 5 for inspection
        historicalResults: historicalResults.slice(0, 5), // First 5 for inspection
        liveStatsWithScores: liveStatsWithScores.slice(0, 3),
        currentWithScores: currentWithScores.slice(0, 3)
      }
    })
    
  } catch (error) {
    console.error('Debug data aggregation error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
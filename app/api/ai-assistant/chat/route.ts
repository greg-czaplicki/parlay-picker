import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithAI } from '@/lib/services/llm-client'
import { GolfDataAggregator } from '@/lib/services/data-aggregator'

const dataAggregator = new GolfDataAggregator()

export async function POST(request: NextRequest) {
  try {
    const { message, messages = [] } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      )
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured. Please add ANTHROPIC_API_KEY to environment variables.' },
        { status: 500 }
      )
    }

    // Aggregate relevant golf data based on the user's message
    let golfContext: any = {}

    try {
      console.log('=== STARTING AI CHAT DATA FETCH ===')
      
      // Get current tournaments and matchups using improved date-based detection
      console.log('1. Calling dataAggregator.getActiveTournaments()...')
      let tournaments = await dataAggregator.getActiveTournaments()
      console.log('2. getActiveTournaments result:', tournaments?.length || 0)
      
      console.log('3. Calling dataAggregator.getCurrentMatchups(50)...')
      let matchups = await dataAggregator.getCurrentMatchups(50)
      console.log('4. getCurrentMatchups result:', matchups?.length || 0)

      golfContext.currentTournaments = tournaments
      golfContext.matchups = matchups

      // Get event IDs from current tournaments
      const eventIds = tournaments.map(t => t.event_id)

      console.log(`AI Chat: Found ${tournaments.length} tournaments, ${matchups.length} matchups for events: ${eventIds.join(', ')}`)
      console.log('Sample tournament:', tournaments[0])
      console.log('Sample matchup:', matchups[0])

      // Always fetch comprehensive data for better analysis
      const [playerStats, seasonStats, dataGolfSkillRatings, trends, recentResults, historicalResults] = await Promise.all([
        dataAggregator.getPlayerAdvancedStats(eventIds, 100),
        dataAggregator.getSeasonStats(), // Remove limit to get all players
        dataAggregator.getDataGolfSkillRatings(), // Add DataGolf skill ratings
        dataAggregator.getPlayerTrends(undefined, 200),
        dataAggregator.getRecentTournamentResults(eventIds, 200),
        dataAggregator.getHistoricalTournamentResults(100)
      ])
      
      golfContext.playerStats = playerStats
      golfContext.seasonStats = seasonStats
      golfContext.dataGolfSkillRatings = dataGolfSkillRatings
      golfContext.trends = trends
      golfContext.recentResults = recentResults
      golfContext.historicalResults = historicalResults

      console.log(`AI Chat: Loaded ${playerStats.length} player stats, ${seasonStats.length} season stats, ${dataGolfSkillRatings.length} DataGolf skill ratings, ${trends.length} trends, ${recentResults.length} current results, ${historicalResults.length} historical results`)

      // Determine what additional data to fetch based on message content
      const messageLower = message.toLowerCase()

      if (messageLower.includes('parlay') || messageLower.includes('bet') || messageLower.includes('strategy')) {
        const [historicalParlays, successRates] = await Promise.all([
          dataAggregator.getHistoricalParlayData(50),
          dataAggregator.getParlaySuccessRates()
        ])
        golfContext.historicalParlays = historicalParlays
        golfContext.successRates = successRates
      }

      // Check for specific player analysis
      const playerMatch = messageLower.match(/(?:about|analyze|tell me about|how is|what about)\s+([a-zA-Z\s]+?)(?:\?|$|for|in|at)/i)
      if (playerMatch) {
        const playerName = playerMatch[1].trim()
        if (playerName.length > 2) {
          const playerData = await dataAggregator.getPlayerSpecificData(playerName)
          if (!playerData.error) {
            golfContext.specificPlayer = playerData
          }
        }
      }

    } catch (dataError) {
      console.error('Error fetching golf data:', dataError)
      // Continue with empty context if data fetch fails
    }

    // Log what we're sending to AI
    console.log('Sending to AI:', {
      tournaments: golfContext.currentTournaments?.length || 0,
      matchups: golfContext.matchups?.length || 0,
      playerStats: golfContext.playerStats?.length || 0,
      seasonStats: golfContext.seasonStats?.length || 0,
      dataGolfSkillRatings: golfContext.dataGolfSkillRatings?.length || 0,
      trends: golfContext.trends?.length || 0,
      recentResults: golfContext.recentResults?.length || 0,
      historicalResults: golfContext.historicalResults?.length || 0
    })

    // Generate AI response
    const aiResponse = await analyzeWithAI(message, golfContext, messages)

    return NextResponse.json({
      response: aiResponse.response,
      analysisData: aiResponse.analysisData,
      dataContext: {
        tournamentsCount: golfContext.currentTournaments?.length || 0,
        matchupsCount: golfContext.matchups?.length || 0,
        playersAnalyzed: golfContext.playerStats?.length || 0,
        seasonStatsCount: golfContext.seasonStats?.length || 0,
        dataGolfSkillRatingsCount: golfContext.dataGolfSkillRatings?.length || 0,
        trendsAvailable: golfContext.trends?.length || 0,
        currentResultsCount: golfContext.recentResults?.length || 0,
        historicalResultsCount: golfContext.historicalResults?.length || 0
      },
      debug: {
        tournamentsFound: golfContext.currentTournaments?.length || 0,
        matchupsFound: golfContext.matchups?.length || 0,
        sampleTournament: golfContext.currentTournaments?.[0]?.event_name || 'None',
        sampleMatchup: golfContext.matchups?.[0] ? `${golfContext.matchups[0].player1_name} vs ${golfContext.matchups[0].player2_name}` : 'None'
      }
    })

  } catch (error) {
    console.error('AI Chat API Error:', error)
    
    let errorMessage = 'An unexpected error occurred'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        errorMessage = 'AI service authentication failed'
        statusCode = 401
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'Too many requests. Please try again later.'
        statusCode = 429
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        response: `I apologize, but I'm experiencing technical difficulties. Please try again in a moment. If the problem persists, the AI service may need to be configured with an API key.`
      },
      { status: statusCode }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'AI Assistant API is running',
    endpoints: {
      chat: 'POST /api/ai-assistant/chat',
      analyze: 'POST /api/ai-assistant/analyze'
    },
    configured: !!process.env.ANTHROPIC_API_KEY
  })
}
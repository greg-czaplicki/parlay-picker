import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface GolfAnalysisContext {
  currentTournaments?: any[]
  playerStats?: any[]
  seasonStats?: any[]
  dataGolfSkillRatings?: any[]
  recentResults?: any[]
  historicalResults?: any[]
  matchups?: any[]
  trends?: any[]
  historicalParlays?: any[]
}

export const GOLF_ANALYSIS_SYSTEM_PROMPT = `
You are an expert golf analyst and parlay strategist. You MUST ONLY use the specific data provided in the user's message. DO NOT use any external knowledge, assumptions, or information not explicitly provided in the data.

## CRITICAL RULES:
1. ONLY analyze players that appear in the provided tournament and matchup data
2. ONLY reference tournaments that are listed in the current tournaments data
3. ONLY use statistics and information that is explicitly provided
4. If you don't have specific data about something, say "I don't have that information in the current data"
5. DO NOT make assumptions about defending champions, course conditions, or weather unless provided
6. DO NOT reference historical knowledge not present in the provided data

## Your Analysis Approach:
- Base ALL recommendations on the provided player statistics (PGA Tour SG data, DataGolf skill ratings, recent results, trends)
- You have access to BOTH PGA Tour season stats AND DataGolf skill ratings - use both data sources
- Use ONLY the matchups and odds provided in the data
- Reference ONLY the tournaments listed as current/active
- Cite specific statistical evidence from the provided data
- Be explicit about what data you're using for each recommendation

## Response Format:
- Start by identifying which tournaments and players you're analyzing from the data
- Cite specific statistics from the provided player data
- Use actual odds and matchup information provided
- Indicate confidence based on quality and quantity of provided data
- If data is limited, say so and adjust confidence accordingly

## What to Include:
- Player names and IDs from the data
- Specific SG (Strokes Gained) statistics from BOTH PGA Tour season stats AND DataGolf skill ratings
- Tournament names and event IDs from the data
- Actual odds and matchup types from the database
- Recent results and trends as provided
- When comparing players, use both PGA Tour and DataGolf SG data when available

## What NOT to Include:
- Course names or conditions not in the data
- Weather predictions or course knowledge
- Historical tournament winners unless in the provided results
- Player biographical information not in the data
- Assumptions about course fit or local knowledge
`

export const formatPlayerData = (playerStats: any[]) => {
  return playerStats.map(player => ({
    name: player.player_name || player.name,
    dgId: player.dg_id,
    eventName: player.event_name,
    roundNumber: player.round_num,
    currentPosition: player.position,
    roundScore: player.today,
    totalScore: player.total,
    holesCompleted: player.thru,
    recentForm: {
      avgScore: player.scoring_average,
      sgTotal: player.sg_total,
      sgOTT: player.sg_ott,
      sgAPP: player.sg_app,
      sgARG: player.sg_arg,
      sgPutt: player.sg_putt
    },
    trends: player.trends || []
  }))
}

export const formatSeasonData = (seasonStats: any[]) => {
  return seasonStats.map(player => ({
    name: player.player_name,
    dgId: player.dg_id,
    pgaPlayerId: player.pga_player_id,
    seasonForm: {
      sgTotal: player.sg_total,
      sgOTT: player.sg_ott,
      sgAPP: player.sg_app,
      sgARG: player.sg_arg,
      sgPutt: player.sg_putt,
      drivingAccuracy: player.driving_accuracy,
      drivingDistance: player.driving_distance
    },
    lastUpdated: player.updated_at
  }))
}

export const formatTournamentContext = (tournaments: any[]) => {
  return tournaments.map(tournament => ({
    eventId: tournament.event_id,
    name: tournament.event_name,
    course: tournament.course_name,
    par: tournament.course_par,
    status: tournament.status,
    startDate: tournament.start_date,
    endDate: tournament.end_date
  }))
}

export const formatMatchupData = (matchups: any[], playerStats: any[] = []) => {
  // Create a lookup map for Round 1 performance by player ID
  const playerPerformanceMap = new Map()
  playerStats.forEach(stat => {
    if (stat.round_num === "1" || stat.round_num === 1) {
      playerPerformanceMap.set(stat.dg_id, {
        round1Score: stat.today,
        totalScore: stat.total,
        position: stat.position,
        sgTotal: stat.sg_total,
        holesCompleted: stat.thru
      })
    }
  })

  return matchups.map(matchup => ({
    id: matchup.id,
    eventId: matchup.event_id,
    round: matchup.round_num,
    type: matchup.type,
    players: [
      {
        name: matchup.player1_name,
        dgId: matchup.player1_dg_id,
        odds: matchup.odds1,
        dgOdds: matchup.dg_odds1,
        score: matchup.player1_score,
        round1Performance: playerPerformanceMap.get(matchup.player1_dg_id) || null
      },
      {
        name: matchup.player2_name,
        dgId: matchup.player2_dg_id,
        odds: matchup.odds2,
        dgOdds: matchup.dg_odds2,
        score: matchup.player2_score,
        round1Performance: playerPerformanceMap.get(matchup.player2_dg_id) || null
      },
      ...(matchup.player3_name ? [{
        name: matchup.player3_name,
        dgId: matchup.player3_dg_id,
        odds: matchup.odds3,
        dgOdds: matchup.dg_odds3,
        score: matchup.player3_score,
        round1Performance: playerPerformanceMap.get(matchup.player3_dg_id) || null
      }] : [])
    ],
    teeTime: matchup.tee_time
  }))
}

export const createAnalysisPrompt = (
  userMessage: string,
  context: GolfAnalysisContext
) => {
  let contextText = '\n## ===== DATABASE DATA PROVIDED - USE ONLY THIS INFORMATION ====='

  if (context.currentTournaments?.length) {
    contextText += `\n\n## CURRENT TOURNAMENTS IN DATABASE:\n${JSON.stringify(formatTournamentContext(context.currentTournaments), null, 2)}`
  } else {
    contextText += `\n\n## CURRENT TOURNAMENTS: None found in database`
  }

  if (context.playerStats?.length) {
    contextText += `\n\n## CURRENT TOURNAMENT PLAYER DATA (Live Stats with Round Scores and Positions):\n${JSON.stringify(formatPlayerData(context.playerStats), null, 2)}`
  } else {
    contextText += `\n\n## CURRENT TOURNAMENT PLAYER DATA: None found in database`
  }

  if (context.seasonStats?.length) {
    contextText += `\n\n## SEASON-LONG STROKES GAINED STATISTICS:\n${JSON.stringify(formatSeasonData(context.seasonStats), null, 2)}`
  } else {
    contextText += `\n\n## SEASON-LONG STROKES GAINED STATISTICS: None found in database`
  }

  if (context.matchups?.length) {
    contextText += `\n\n## AVAILABLE MATCHUPS WITH ROUND 1 PERFORMANCE:\n${JSON.stringify(formatMatchupData(context.matchups, context.playerStats), null, 2)}`
  } else {
    contextText += `\n\n## AVAILABLE MATCHUPS: None found in database`
  }

  if (context.trends?.length) {
    contextText += `\n\n## PLAYER TRENDS FROM DATABASE:\n${JSON.stringify(context.trends, null, 2)}`
  } else {
    contextText += `\n\n## PLAYER TRENDS: None found in database`
  }

  if (context.recentResults?.length) {
    contextText += `\n\n## CURRENT TOURNAMENT ROUND RESULTS:\n${JSON.stringify(context.recentResults, null, 2)}`
  } else {
    contextText += `\n\n## CURRENT TOURNAMENT ROUND RESULTS: None available (this is normal for active tournaments without completed rounds)`
  }

  if (context.historicalResults?.length) {
    contextText += `\n\n## HISTORICAL TOURNAMENT RESULTS (Completed Tournaments):\n${JSON.stringify(context.historicalResults, null, 2)}`
  } else {
    contextText += `\n\n## HISTORICAL TOURNAMENT RESULTS: None found in database`
  }

  if (context.historicalParlays?.length) {
    contextText += `\n\n## HISTORICAL PARLAY DATA FROM DATABASE:\n${JSON.stringify(context.historicalParlays, null, 2)}`
  } else {
    contextText += `\n\n## HISTORICAL PARLAY DATA: None found in database`
  }

  contextText += '\n\n## ===== END OF DATABASE DATA ====='

  return `${contextText}

## USER QUESTION:
${userMessage}

## INSTRUCTIONS:
1. ONLY use the database data provided above
2. If a piece of information is not in the database data, explicitly say "This information is not available in the current database"
3. Start your response by listing which tournaments and how many players you found in the data
4. Base ALL analysis on specific statistics from the database
5. Do not make assumptions about courses, weather, or other factors not in the data
6. If the database shows no active tournaments or limited data, explain this limitation
7. When recommending players, aim to provide 10-15 different options if the data supports it
8. Organize recommendations by confidence/statistical strength rather than arbitrary categories
9. Include specific SG (Strokes Gained) numbers and other statistics from the database for each player
10. If asking for Round 2 picks, only recommend players who appear in the current tournament data

## IMPORTANT DATA STRUCTURE CLARIFICATION:
- **Current round scores and positions** are found in the "CURRENT TOURNAMENT PLAYER DATA" section (live_tournament_stats)
- **Season-long performance trends** are found in the "SEASON-LONG STROKES GAINED STATISTICS" section (player_season_stats)
- **Historical final results** are found in the "HISTORICAL TOURNAMENT RESULTS" section  
- The "CURRENT TOURNAMENT ROUND RESULTS" section will be empty for active tournaments (this is normal)
- Look for: currentPosition, roundScore, totalScore, holesCompleted in the player data for live tournament standings
- Use season data to evaluate overall player quality and current tournament data to assess recent form
- Consider both season averages and current tournament performance when making recommendations

Please provide your analysis based strictly on the provided database information.
`
}

export async function analyzeWithAI(
  userMessage: string,
  context: GolfAnalysisContext,
  conversationHistory: any[] = []
): Promise<{ response: string; analysisData?: any }> {
  try {
    const messages = [
      {
        role: 'user' as const,
        content: createAnalysisPrompt(userMessage, context)
      }
    ]

    // Add conversation history if available
    if (conversationHistory.length > 0) {
      const historyMessages = conversationHistory.slice(-6).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))
      messages.unshift(...historyMessages)
    }

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      system: GOLF_ANALYSIS_SYSTEM_PROMPT,
      messages
    })

    const responseText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : 'Unable to generate response'

    return {
      response: responseText,
      analysisData: {
        playerStats: context.playerStats?.length > 0,
        tournamentContext: context.currentTournaments?.length > 0,
        parlayRecommendations: context.matchups?.length > 0
      }
    }
  } catch (error) {
    console.error('AI Analysis Error:', error)
    throw new Error('Failed to analyze with AI: ' + (error as Error).message)
  }
}
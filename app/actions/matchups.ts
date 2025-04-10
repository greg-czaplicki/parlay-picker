"use server"

import { createServerClient } from "@/lib/supabase"

export interface Player {
  id: number
  name: string
  odds: number
  sgTeeToGreen: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
  valueRating: number
  confidenceScore: number
  isRecommended: boolean
}

export interface Matchup {
  id: string
  group: string
  bookmaker: string
  players: Player[]
  recommended: string
}

export async function getMatchups(matchupType: string, bookmaker?: string) {
  const supabase = createServerClient()

  try {
    // Build the query
    let query = supabase
      .from("matchups")
      .select(`
        id,
        group_name,
        bookmaker,
        matchup_players (
          id,
          player_id,
          odds,
          value_rating,
          confidence_score,
          is_recommended,
          players (
            id,
            name
          )
        )
      `)
      .eq("matchup_type", matchupType)

    // Add bookmaker filter if provided
    if (bookmaker) {
      query = query.eq("bookmaker", bookmaker)
    }

    // Execute the query
    const { data: matchupsData, error: matchupsError } = await query

    if (matchupsError) {
      throw new Error(`Error fetching matchups: ${matchupsError.message}`)
    }

    // Get player stats
    const playerIds = matchupsData?.flatMap((matchup) => matchup.matchup_players.map((mp) => mp.player_id)) || []

    const { data: playerStatsData, error: statsError } = await supabase
      .from("player_stats")
      .select("*")
      .in("player_id", playerIds)

    if (statsError) {
      throw new Error(`Error fetching player stats: ${statsError.message}`)
    }

    // Map the data to our frontend format
    const matchups: Matchup[] =
      matchupsData?.map((matchup) => {
        const players: Player[] = matchup.matchup_players.map((mp) => {
          const stats = playerStatsData?.find((ps) => ps.player_id === mp.player_id) || {
            sg_tee_to_green: 0,
            sg_approach: 0,
            sg_around_green: 0,
            sg_putting: 0,
          }

          return {
            id: mp.player_id,
            name: mp.players.name,
            odds: mp.odds,
            sgTeeToGreen: Number.parseFloat(stats.sg_tee_to_green) || 0,
            sgApproach: Number.parseFloat(stats.sg_approach) || 0,
            sgAroundGreen: Number.parseFloat(stats.sg_around_green) || 0,
            sgPutting: Number.parseFloat(stats.sg_putting) || 0,
            valueRating: Number.parseFloat(mp.value_rating) || 0,
            confidenceScore: mp.confidence_score || 0,
            isRecommended: mp.is_recommended || false,
          }
        })

        const recommendedPlayer = players.find((p) => p.isRecommended)

        return {
          id: matchup.id,
          group: matchup.group_name,
          bookmaker: matchup.bookmaker,
          players,
          recommended: recommendedPlayer?.name || "",
        }
      }) || []

    return { matchups }
  } catch (error) {
    console.error("Error in getMatchups:", error)
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

export async function getTopGolfers(matchupType: string, activeFilter: string, limit = 10) {
  const supabase = createServerClient()

  try {
    // Get the latest tournament
    const { data: tournaments, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .order("start_date", { ascending: false })
      .limit(1)

    if (tournamentError) {
      throw new Error(`Error fetching tournament: ${tournamentError.message}`)
    }

    if (!tournaments || tournaments.length === 0) {
      throw new Error("No tournaments found in the database")
    }

    const tournamentId = tournaments[0].id

    // Get players with their stats
    const { data: playersWithStats, error: playersError } = await supabase
      .from("players")
      .select(`
        id,
        name,
        player_stats!inner(
          sg_total,
          sg_tee_to_green,
          sg_approach,
          sg_around_green,
          sg_putting
        )
      `)
      .eq("player_stats.tournament_id", tournamentId)

    if (playersError) {
      throw new Error(`Error fetching players: ${playersError.message}`)
    }

    // Sort players by sg_total in JavaScript
    const sortedPlayers = playersWithStats
      .map((player) => ({
        id: player.id,
        name: player.name,
        sgTotal: Number(player.player_stats[0]?.sg_total || 0),
      }))
      .sort((a, b) => b.sgTotal - a.sgTotal)
      .slice(0, limit)

    // Get some matchup data to associate with these players
    const playerIds = sortedPlayers.map((p) => p.id)

    const { data: matchupPlayersData, error: matchupPlayersError } = await supabase
      .from("matchup_players")
      .select(`
        id,
        odds,
        value_rating,
        confidence_score,
        player_id,
        matchups (
          id,
          group_name,
          bookmaker,
          matchup_type
        )
      `)
      .in("player_id", playerIds)
      .eq("matchups.matchup_type", matchupType)

    if (matchupPlayersError) {
      throw new Error(`Error fetching matchup data: ${matchupPlayersError.message}`)
    }

    // Map the data to our frontend format
    const topGolfers = sortedPlayers.map((player) => {
      // Find a matchup for this player if available
      const matchupPlayer = matchupPlayersData.find((mp) => mp.player_id === player.id)

      return {
        name: player.name,
        matchup: matchupPlayer?.matchups?.group_name || "No matchup",
        odds: matchupPlayer?.odds || 0,
        valueRating: Number.parseFloat(matchupPlayer?.value_rating) || 8.5, // Default value
        confidenceScore: matchupPlayer?.confidence_score || 85, // Default value
        bookmaker: matchupPlayer?.matchups?.bookmaker || "draftkings",
        sgTotal: player.sgTotal,
      }
    })

    return { topGolfers }
  } catch (error) {
    console.error("Error in getTopGolfers:", error)
    return { error: error instanceof Error ? error.message : "Unknown error" }
  }
}

// Helper function to determine order by field based on filter
function getOrderByField(activeFilter: string) {
  switch (activeFilter) {
    case "SG Heavy":
      return "value_rating" // We'll use value_rating as a proxy for SG
    case "Heavy Favorites":
      return "odds"
    case "Value Rating":
      return "value_rating"
    case "Confidence":
      return "confidence_score"
    default:
      return "value_rating"
  }
}

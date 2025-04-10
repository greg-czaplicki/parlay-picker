"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, AlertCircle } from "lucide-react"
import { getMatchups, Matchup, Player } from "@/app/actions/matchups"

interface RecommendedPicksProps {
  matchupType: string
  bookmaker?: string
  limit?: number // Optional limit for how many recommendations to show
}

// Helper to format odds
const formatOdds = (odds: number) => {
  if (odds > 0) return `+${odds}`
  return odds.toString()
}

export default function RecommendedPicks({
  matchupType,
  bookmaker,
  limit = 10, // Default limit
}: RecommendedPicksProps) {
  const [recommendations, setRecommendations] = useState<Player[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true)
      setError(null)
      try {
        const { matchups, error: fetchError } = await getMatchups(matchupType, bookmaker)

        if (fetchError) {
          throw new Error(fetchError)
        }

        // Extract the single recommended player from each matchup
        const recommendedPlayers = matchups
          .map(matchup => {
             const recommendedPlayer = matchup.players.find(p => p.isRecommended);
             // Include group info with the player
             return recommendedPlayer ? { ...recommendedPlayer, group: matchup.group } : null;
          })
          .filter((p): p is Player & { group: string } => p !== null); // Filter out nulls and type guard

        // Sort by confidence score (descending) and take the top 'limit'
        const sortedRecommendations = recommendedPlayers
          .sort((a, b) => b.confidenceScore - a.confidenceScore)
          .slice(0, limit);

        setRecommendations(sortedRecommendations.map(({ group, ...player }) => player)); // Store only player data in state
        setGroups(sortedRecommendations.map(p => p.group)); // Store group names separately

      } catch (err) {
        console.error("Failed to fetch recommendations:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        setRecommendations([])
        setGroups([])
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [matchupType, bookmaker, limit]) // Re-fetch if props change

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">Top {limit} Recommended Picks</h2>

        {loading && (
          <div className="space-y-4">
            {[...Array(limit)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg bg-[#1e1e23]" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && recommendations.length === 0 && (
          <p className="text-gray-400 text-center py-4">No recommendations available based on current data and filters.</p>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-3">
            {recommendations.map((player, index) => (
              <div key={player.id} className="p-4 bg-[#1e1e23] rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-lg">{player.name}</div>
                    <div className="text-sm text-gray-400">{groups[index]}</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                     <span
                       className={`text-lg font-semibold px-2 py-1 rounded mb-1 ${ // Use valueRating for the prominent score
                         player.valueRating >= 8
                           ? "bg-green-900/30 text-green-400"
                           : player.valueRating >= 7
                             ? "bg-yellow-900/30 text-yellow-400"
                             : "bg-red-900/30 text-red-400"
                       }`}
                     >
                       {player.valueRating.toFixed(1)}
                     </span>
                    <span className="text-base font-medium text-green-400">{formatOdds(player.odds)}</span>
                  </div>
                </div>
                {/* Optional: Display Confidence Score */}
                {/* <div className="text-xs text-gray-500">Confidence: {player.confidenceScore}</div> */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 bg-[#2a2a35] border-none hover:bg-[#34343f] text-white"
                  // onClick={() => handleAddToParlay(player)} // TODO: Implement Add to Parlay logic
                >
                  <Plus size={16} className="mr-1" /> Add to Parlay
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
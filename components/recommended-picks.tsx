"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, AlertCircle, Info } from "lucide-react"
import { getMatchups, Matchup } from "@/app/actions/matchups"
import { toast } from "@/components/ui/use-toast"
import { useParlayContext, ParlaySelection } from "@/context/ParlayContext"
import { useRecommendedPicksQuery, Player } from "@/hooks/use-recommended-picks-query"
import { useParlaysQuery } from '@/hooks/use-parlays-query'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RecommendedPicksProps {
  eventId: number | null;
  matchupType: "2ball" | "3ball";
  limit?: number;
  oddsGapPercentage?: number;
  bookmaker?: string;
}

// Helper to format Decimal odds into American odds string
const formatOdds = (decimalOdds: number | null | undefined): string => {
  if (decimalOdds == null || decimalOdds <= 1.01) {
      // Handle null, undefined, or odds too low to be meaningful/convertible
      return "N/A"; 
  }
  
  if (decimalOdds >= 2.00) {
    // Positive American odds: (Decimal - 1) * 100
    const americanOdds = (decimalOdds - 1) * 100;
    return `+${Math.round(americanOdds)}`;
  } else {
    // Negative American odds: -100 / (Decimal - 1)
    const americanOdds = -100 / (decimalOdds - 1);
    // Negative sign is implicit in the calculation result
    return `${Math.round(americanOdds)}`; 
  }
};

// Helper to convert decimal odds to American odds as a number
const convertToAmericanOdds = (decimalOdds: number | null | undefined): number => {
  if (decimalOdds == null || decimalOdds <= 1.01) {
      // Handle null, undefined, or odds too low to be meaningful/convertible
      return 0; 
  }
  
  if (decimalOdds >= 2.00) {
    // Positive American odds: (Decimal - 1) * 100
    return Math.round((decimalOdds - 1) * 100);
  } else {
    // Negative American odds: -100 / (Decimal - 1)
    return Math.round(-100 / (decimalOdds - 1));
  }
};

export default function RecommendedPicks({
  eventId,
  matchupType,
  limit = 10,
  oddsGapPercentage = 40,
  bookmaker = "fanduel",
}: RecommendedPicksProps) {
  // Get the parlay context
  const { addSelection, removeSelection, selections } = useParlayContext()
  // Track which players have been added to the parlay
  const [addedPlayers, setAddedPlayers] = useState<Record<number, boolean>>({})

  // Use React Query for recommendations
  const { data: recommendations, isLoading, isError, error } = useRecommendedPicksQuery(eventId, matchupType as "2ball" | "3ball", bookmaker, oddsGapPercentage, limit)

  // All user parlays for indicator logic
  const userId = '00000000-0000-0000-0000-000000000001';
  const { data: allParlays = [] } = useParlaysQuery(userId);
  const allParlayPicks = (allParlays ?? []).flatMap((parlay: any) => parlay.picks || []);
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => (pick.picked_player_name || '').toLowerCase() === playerName.toLowerCase());

  // Function to add a player to the parlay
  const addToParlay = (selection: ParlaySelection, playerId: number) => {
    // Format player name to "First Last" format if it's in "Last, First" format
    let playerName = selection.player
    if (playerName.includes(",")) {
      const [lastName, firstName] = playerName.split(",").map(part => part.trim())
      playerName = `${firstName} ${lastName}`
      selection.player = playerName
    }
    
    addSelection(selection)
    
    // Track this player as added
    setAddedPlayers(prev => ({ ...prev, [playerId]: true }))
    
    toast({
      title: "Added to Parlay",
      description: `${playerName} has been added to your parlay.`,
      duration: 3000
    })
  }
  
  // Function to remove a player from the parlay
  const removeFromParlay = (selectionId: number, playerId: number, playerName: string) => {
    removeSelection(selectionId)
    
    // Mark player as removed in local state
    setAddedPlayers(prev => ({ ...prev, [playerId]: false }))
    
    // Format player name if needed for toast
    let displayName = playerName
    if (displayName.includes(",")) {
      const [lastName, firstName] = displayName.split(",").map(part => part.trim())
      displayName = `${firstName} ${lastName}`
    }
    
    toast({
      title: "Removed from Parlay",
      description: `${displayName} has been removed from your parlay.`,
      duration: 3000
    })
  }
  
  // Check if a player is already in the parlay
  const isPlayerInParlay = (playerId: number, playerName: string): { inParlay: boolean, selectionId?: number } => {
    // First check our local tracking state
    if (addedPlayers[playerId]) {
      // Find the selection ID
      const selection = selections.find(s => {
        // Try to match by player name, accounting for "Last, First" vs "First Last" format
        let nameToCheck = s.player
        let nameToMatch = playerName
        
        if (nameToCheck.includes(",")) {
          const [lastName, firstName] = nameToCheck.split(",").map(part => part.trim())
          nameToCheck = `${firstName} ${lastName}`
        }
        
        if (nameToMatch.includes(",")) {
          const [lastName, firstName] = nameToMatch.split(",").map(part => part.trim())
          nameToMatch = `${firstName} ${lastName}`
        }
        
        return nameToCheck.toLowerCase() === nameToMatch.toLowerCase()
      })
      
      return { inParlay: true, selectionId: selection?.id }
    }
    
    return { inParlay: false }
  }
  
  // Sync addedPlayers state with selections from context
  useEffect(() => {
    // Find players that are currently in recommendations and also in selections
    const newAddedPlayers: Record<number, boolean> = {...addedPlayers};
    (recommendations ?? []).forEach((player: Player) => {
      let formattedPlayerName = player.name
      if (formattedPlayerName.includes(",")) {
        const [lastName, firstName] = formattedPlayerName.split(",").map(part => part.trim())
        formattedPlayerName = `${firstName} ${lastName}`
      }
      const isInParlay = selections.some((selection: ParlaySelection) => {
        let selectionPlayerName = selection.player
        if (selectionPlayerName.includes(",")) {
          const [lastName, firstName] = selectionPlayerName.split(",").map(part => part.trim())
          selectionPlayerName = `${firstName} ${lastName}`
        }
        return selectionPlayerName.toLowerCase() === formattedPlayerName.toLowerCase()
      })
      newAddedPlayers[player.id] = isInParlay
    })
    setAddedPlayers(newAddedPlayers)
  }, [selections, recommendations]);

  return (
    <Card className="glass-card highlight-card">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold mb-4">
          Top {matchupType === "3ball" ? "3-Ball" : "2-Ball"} Picks
        </h2>

        {isLoading && (
          <div className="space-y-4">
            {[...Array(limit)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg bg-[#1e1e23]" />
            ))}
          </div>
        )}

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : error}</AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && (recommendations ?? []).length === 0 && (
          <p className="text-gray-400 text-center py-4">No recommendations available based on current data and filters.</p>
        )}

        {!isLoading && !isError && (recommendations ?? []).length > 0 && (
          <div className="space-y-3">
            {(recommendations ?? []).map((player: Player) => (
              <div key={`${player.id}-${player.matchupId || Math.random().toString(36).substring(7)}`} className="p-4 bg-[#1e1e23] rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-lg">{player.name}</div>
                    <div className="text-xs text-gray-400">SG Total: {player.sgTotal?.toFixed(2) || "N/A"}</div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                     <span
                       className={`text-lg font-semibold px-2 py-1 rounded mb-1 ${
                         player.confidenceScore >= 100
                           ? "bg-green-900/30 text-green-400"
                           : player.confidenceScore >= 70
                             ? "bg-yellow-900/30 text-yellow-400"
                             : player.confidenceScore >= 40
                               ? "bg-blue-900/30 text-blue-400"
                               : "bg-red-900/30 text-red-400"
                       }`}
                     >
                       +{player.confidenceScore}
                     </span>
                    <span className="text-base font-medium text-green-400">{formatOdds(player.odds)}</span>
                  </div>
                </div>
                {(() => {
                  const { inParlay, selectionId } = isPlayerInParlay(player.id, player.name);
                  return (
                    <div className="flex items-center gap-2 mt-2">
                      {inParlay ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full bg-primary border-none hover:bg-primary/90 text-white"
                          onClick={() => {
                            if (!player.id || !player.name || !selectionId) return;
                            removeFromParlay(selectionId, player.id, player.name);
                          }}
                        >
                          ✓ Added to Parlay
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full bg-[#2a2a35] border-none hover:bg-[#34343f] text-white"
                          onClick={() => {
                            if (!player.id || !player.name) return;
                            // Convert decimal odds to American odds if needed
                            const americanOdds = convertToAmericanOdds(player.odds);
                            // Add player to parlay context
                            addToParlay({
                              id: player.id,
                              matchupType: matchupType,
                              group: player.eventName || 'Unknown Event',
                              player: player.name,
                              odds: americanOdds,
                              valueRating: player.valueRating || 7.5,
                              confidenceScore: player.confidenceScore || 75,
                              matchupId: player.matchupId,
                              eventName: player.eventName,
                              roundNum: player.roundNum || 2
                            }, player.id);
                          }}
                        >
                          <Plus size={16} className="mr-1" /> Add to Parlay
                        </Button>
                      )}
                      {/* Indicator for player used in any other parlay */}
                      {!inParlay && isPlayerInAnyParlay(player.name) && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="text-blue-400 inline-block align-middle" size={16} />
                            </TooltipTrigger>
                            <TooltipContent>Already used in another parlay</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
} 
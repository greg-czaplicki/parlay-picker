"use client"

import { useState, useEffect, useMemo } from "react"
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
import { FilterService } from "@/filters/filter-service"
import { useMatchupsQuery } from "@/hooks/use-matchups-query"

interface RecommendedPicksProps {
  eventId: number | null;
  matchupType: "2ball" | "3ball";
  limit?: number;
  oddsGapPercentage?: number;
  bookmaker?: string;
  roundNum?: number | null;
  filterId?: string | null;
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

// Helper to color code SG values
function getSGColorClass(sg: number | null | undefined) {
  if (sg == null || isNaN(sg)) return "text-gray-400";
  if (sg >= 2) return "text-green-700 font-bold";
  if (sg >= 1) return "text-green-500 font-semibold";
  if (sg >= 0) return "text-green-300";
  if (sg >= -1) return "text-red-400";
  if (sg >= -2) return "text-red-600 font-semibold";
  return "text-red-800 font-bold";
}

export default function RecommendedPicks({
  eventId,
  matchupType,
  limit = 10,
  oddsGapPercentage = 40,
  bookmaker = "fanduel",
  roundNum,
  filterId,
}: RecommendedPicksProps) {
  // Get the parlay context
  const { addSelection, removeSelection, selections } = useParlayContext()
  // Track which players have been added to the parlay
  const [addedPlayers, setAddedPlayers] = useState<Record<string, boolean>>({})

  // Use React Query for recommendations
  const { data: recommendations, isLoading, isError, error } = useRecommendedPicksQuery(eventId, matchupType as "2ball" | "3ball", bookmaker, oddsGapPercentage, limit, roundNum)

  // Filter recommendations if filterId is provided
  const filteredRecommendations = useMemo(() => {
    if (filterId && recommendations) {
      return FilterService.getInstance().getFilterById(filterId)?.applyFilter(recommendations).filtered ?? recommendations;
    }
    return recommendations;
  }, [filterId, recommendations]);

  // All user parlays for indicator logic
  const userId = '00000000-0000-0000-0000-000000000001';
  const { data: allParlays = [] } = useParlaysQuery(userId);
  const allParlayPicks = (allParlays ?? []).flatMap((parlay: any) => parlay.picks || []);
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => (pick.picked_player_name || '').toLowerCase() === playerName.toLowerCase());

  // Fetch matchups to sync with matchups-table
  const { data: matchups } = useMatchupsQuery(eventId, matchupType, roundNum);

  // Use the same odds filtering as the table
  const filteredMatchups = useMemo(() => {
    return (matchups ?? []).filter(matchup => {
      if ('player3_dg_id' in matchup) {
        return (
          Number(matchup.odds1 ?? 0) > 1 &&
          Number(matchup.odds2 ?? 0) > 1 &&
          Number(matchup.odds3 ?? 0) > 1
        );
      } else {
        return (
          Number(matchup.odds1 ?? 0) > 1 &&
          Number(matchup.odds2 ?? 0) > 1
        );
      }
    });
  }, [matchups]);

  // Build sets of valid player IDs and matchup IDs from filteredMatchups
  const validPlayerIds = useMemo(() => {
    const set = new Set<string>();
    (filteredMatchups ?? []).forEach(m => {
      if (m.player1_dg_id) set.add(String(m.player1_dg_id));
      if (m.player2_dg_id) set.add(String(m.player2_dg_id));
      if ('player3_dg_id' in m && m.player3_dg_id) set.add(String(m.player3_dg_id));
    });
    return set;
  }, [filteredMatchups]);

  const validMatchupIds = useMemo(() => {
    const set = new Set<string>();
    (filteredMatchups ?? []).forEach(m => {
      if (m.uuid) set.add(String(m.uuid));
    });
    return set;
  }, [filteredMatchups]);

  // Filter recommendations to only those present in filteredMatchups
  const filteredAndMatchedRecommendations = useMemo(() => {
    return (filteredRecommendations ?? []).filter(
      player =>
        validPlayerIds.has(String(player.dg_id)) &&
        validMatchupIds.has(String(player.matchupId))
    );
  }, [filteredRecommendations, validPlayerIds, validMatchupIds]);

  // Function to add a player to the parlay
  const addToParlay = (selection: ParlaySelection, playerId: string) => {
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
  const removeFromParlay = (selectionId: string, playerId: string, playerName: string) => {
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
  const isPlayerInParlay = (playerId: string, playerName: string): { inParlay: boolean, selectionId?: string } => {
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
    const newAddedPlayers: Record<string, boolean> = {};
    (filteredRecommendations ?? []).forEach((player: Player) => {
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
      newAddedPlayers[String(player.dg_id)] = isInParlay
    })
    setAddedPlayers(newAddedPlayers)
  }, [filteredRecommendations, selections])
}
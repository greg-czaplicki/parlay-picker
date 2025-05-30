"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
<<<<<<< HEAD
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
=======
import { Plus, AlertCircle } from "lucide-react"
import { getMatchups, Matchup } from "@/app/actions/matchups"
import { toast } from "@/components/ui/use-toast"
import { useParlay, ParlaySelection } from "@/context/ParlayContext"

// Extend the Player interface to include matchup information needed for parlays
interface Player {
  id: number;
  name: string;
  odds: number;
  sgTotal: number;
  valueRating: number;
  confidenceScore: number;
  isRecommended: boolean;
  matchupId?: number;
  eventName?: string;
  roundNum?: number;
}

interface RecommendedPicksProps {
  matchupType: string
  bookmaker?: string
  limit?: number // Optional limit for how many recommendations to show
  oddsGapPercentage?: number // Minimum percentage gap between player's implied probability and average of others
  eventId?: number | null // Selected event ID to filter by
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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

<<<<<<< HEAD
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
=======
export default function RecommendedPicks({
  matchupType = "3ball",
  bookmaker,
  limit = 10, // Default limit
  oddsGapPercentage = 40, // Default minimum 40 point American odds gap
  eventId, // Selected event ID to filter by
}: RecommendedPicksProps) {
  const [recommendations, setRecommendations] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMatchupType, setActiveMatchupType] = useState<"2ball" | "3ball">(matchupType as "2ball" | "3ball")
  
  // Get the parlay context
  const { addSelection, removeSelection, selections } = useParlay()
  
  // Track which players have been added to the parlay
  const [addedPlayers, setAddedPlayers] = useState<Record<string, boolean>>({})
  
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
  const removeFromParlay = (selectionId: string, playerId: number, playerName: string) => {
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
  const isPlayerInParlay = (playerId: number, playerName: string): { inParlay: boolean, selectionId?: string } => {
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

  // Update local state when prop changes
  useEffect(() => {
    setActiveMatchupType(matchupType as "2ball" | "3ball");
  }, [matchupType]);
  
  // Sync addedPlayers state with selections from context
  useEffect(() => {
    // Find players that are currently in recommendations and also in selections
    const newAddedPlayers: Record<string, boolean> = {...addedPlayers}
    
    // Loop through recommendations to check if any are in the parlay
    recommendations.forEach(player => {
      // Format player name for comparison
      let formattedPlayerName = player.name
      if (formattedPlayerName.includes(",")) {
        const [lastName, firstName] = formattedPlayerName.split(",").map(part => part.trim())
        formattedPlayerName = `${firstName} ${lastName}`
      }
      
      // Check if this player is in the selections
      const isInParlay = selections.some(selection => {
        // Format selection player name for comparison
        let selectionPlayerName = selection.player
        if (selectionPlayerName.includes(",")) {
          const [lastName, firstName] = selectionPlayerName.split(",").map(part => part.trim())
          selectionPlayerName = `${firstName} ${lastName}`
        }
        
        return selectionPlayerName.toLowerCase() === formattedPlayerName.toLowerCase()
      })
      
      // Update tracking state
      newAddedPlayers[player.id] = isInParlay
    })
    
    // Update state if needed
    setAddedPlayers(newAddedPlayers)
  }, [selections, recommendations]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setLoading(true)
      setError(null)
      setRecommendations([]) // Clear previous results
      try {
        console.log(`[RecommendedPicks] Fetching ${activeMatchupType} matchups with bookmaker: ${bookmaker || 'default'} and oddsGap: ${oddsGapPercentage}`);
        
        // Use direct fetch to the API endpoint instead of the server action
        // This is similar to how the matchups-table.tsx component does it
        const endpoint = eventId 
          ? `/api/matchups/${activeMatchupType}?eventId=${eventId}` 
          : `/api/matchups/${activeMatchupType}`;
        console.log(`[RecommendedPicks] Fetching directly from API: ${endpoint}`);
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Failed to fetch matchups: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || "API returned success: false");
        }
        
        console.log(`[RecommendedPicks] Got API response with ${data.matchups?.length || 0} matchups`);
        
        // Process the data similarly to how matchups-table.tsx does
        const matchupsFromApi = data.matchups || [];
        
        // Add more debugging
        console.log("[RecommendedPicks] Sample API response matchup:", matchupsFromApi.length > 0 ? matchupsFromApi[0] : "No matchups");
        
        // Transform API response into the format expected by our component
        const processedMatchups = matchupsFromApi.map(apiMatchup => {
          // Skip invalid matchups
          if (!apiMatchup || typeof apiMatchup !== 'object') {
            console.log("[RecommendedPicks] Skipping invalid matchup:", apiMatchup);
            return null;
          }
          
          // Ensure ID exists and convert to string safely
          const matchupId = apiMatchup.id ? apiMatchup.id.toString() : `unknown-${Math.random().toString(36).substring(7)}`;
          
          // For 3-ball matchups, we need to create player objects from p1, p2, p3
          if (activeMatchupType === "3ball") {
            // Check if player properties exist
            if (!apiMatchup.p1_player_name || !apiMatchup.p2_player_name || !apiMatchup.p3_player_name) {
              console.log("[RecommendedPicks] Skipping matchup with missing player names:", matchupId);
              return null;
            }
            
            const players = [
              {
                id: apiMatchup.p1_dg_id || 0,
                name: apiMatchup.p1_player_name,
                odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p1_odds : apiMatchup.draftkings_p1_odds,
                sgTotal: 0, // We don't have SG data here
                valueRating: 0, // Will calculate later 
                confidenceScore: 0, // Will calculate later
                isRecommended: false, // Will set later
                matchupId: apiMatchup.id,
                eventName: apiMatchup.event_name,
                roundNum: apiMatchup.round_num
              },
              {
                id: apiMatchup.p2_dg_id || 0,
                name: apiMatchup.p2_player_name,
                odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p2_odds : apiMatchup.draftkings_p2_odds,
                sgTotal: 0,
                valueRating: 0,
                confidenceScore: 0,
                isRecommended: false,
                matchupId: apiMatchup.id,
                eventName: apiMatchup.event_name,
                roundNum: apiMatchup.round_num
              },
              {
                id: apiMatchup.p3_dg_id || 0,
                name: apiMatchup.p3_player_name,
                odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p3_odds : apiMatchup.draftkings_p3_odds,
                sgTotal: 0,
                valueRating: 0,
                confidenceScore: 0,
                isRecommended: false,
                matchupId: apiMatchup.id,
                eventName: apiMatchup.event_name,
                roundNum: apiMatchup.round_num
              }
            ].filter(p => p.odds && p.odds > 1); // Filter out invalid players
            
            return {
              id: matchupId,
              group: `Matchup ${matchupId}`,
              bookmaker: bookmaker || "fanduel",
              players,
              recommended: ""
            };
          } 
          // For 2-ball matchups
          else {
            // Check if player properties exist
            if (!apiMatchup.p1_player_name || !apiMatchup.p2_player_name) {
              console.log("[RecommendedPicks] Skipping 2-ball matchup with missing player names:", matchupId);
              return null;
            }
            
            const players = [
              {
                id: apiMatchup.p1_dg_id || 0,
                name: apiMatchup.p1_player_name,
                odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p1_odds : apiMatchup.draftkings_p1_odds,
                sgTotal: 0,
                valueRating: 0,
                confidenceScore: 0,
                isRecommended: false,
                matchupId: apiMatchup.id,
                eventName: apiMatchup.event_name,
                roundNum: apiMatchup.round_num
              },
              {
                id: apiMatchup.p2_dg_id || 0,
                name: apiMatchup.p2_player_name,
                odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p2_odds : apiMatchup.draftkings_p2_odds,
                sgTotal: 0,
                valueRating: 0,
                confidenceScore: 0,
                isRecommended: false,
                matchupId: apiMatchup.id,
                eventName: apiMatchup.event_name,
                roundNum: apiMatchup.round_num
              }
            ].filter(p => p.odds && p.odds > 1); // Filter out invalid players
            
            return {
              id: matchupId,
              group: `Matchup ${matchupId}`,
              bookmaker: bookmaker || "fanduel",
              players,
              recommended: ""
            };
          }
        }).filter(m => m && m.players && m.players.length >= (activeMatchupType === "3ball" ? 3 : 2));
        
        console.log(`[RecommendedPicks] Processed ${processedMatchups.length} valid matchups`);
        
        // Debug the first matchup
        if (processedMatchups.length > 0) {
          console.log("[RecommendedPicks] First processed matchup:", {
            id: processedMatchups[0].id,
            players: processedMatchups[0].players.map(p => ({
              name: p.name,
              odds: p.odds,
              americanOdds: p.odds ? (p.odds >= 2.0 ? 
                `+${Math.round((p.odds - 1) * 100)}` : 
                `${Math.round(-100 / (p.odds - 1))}`) : 'N/A'
            }))
          });
        }

        // Find all the players with a significant odds gap
        const playersWithGoodOdds: Player[] = [];
        
        // Process each matchup
        processedMatchups.forEach(matchup => {
          // We need at least 2 players for 2-ball or at least 3 for 3-ball
          const minPlayers = activeMatchupType === "2ball" ? 2 : 3;
          if (matchup.players.length < minPlayers) return;
          
          // Extract players with valid odds
          const validPlayers = matchup.players.filter(p => p.odds && p.odds > 1);
          if (validPlayers.length < minPlayers) return;
          
          // Sort players by odds (lowest decimal odds = favorite)
          validPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
          
          // For 3-ball matchups:
          if (activeMatchupType === "3ball") {
            // Get the favorite and other players
            const favorite = validPlayers[0];
            const otherPlayers = validPlayers.slice(1);
            
            // Debug the favorite's odds
            console.log(`[RecommendedPicks] 3-ball favorite ${favorite.name} has odds ${favorite.odds}`);
            
            // Calculate odds gap in American odds (consistent with matchups-table.tsx)
            const gaps = otherPlayers.map(other => {
              // Convert odds to American format - EXACTLY like matchups-table.tsx
              const favoriteAmerican = decimalToAmericanInt(favorite.odds);
              const otherAmerican = decimalToAmericanInt(other.odds);
              
              // Calculate the absolute difference
              const gap = Math.abs(favoriteAmerican - otherAmerican);
              console.log(`[RecommendedPicks] Gap between ${favorite.name} (${favoriteAmerican}) and ${other.name} (${otherAmerican}): ${gap}`);
              return gap;
            });
            
            // Check if favorite has significant gap against ALL other players
            const hasGapAgainstAll = gaps.every(gap => gap >= oddsGapPercentage);
            
            // If the favorite has an odds gap exceeding the threshold against all others, recommend them
            if (hasGapAgainstAll) {
              // Add the lowest gap as the score for ranking
              const minGap = Math.min(...gaps);
              playersWithGoodOdds.push({
                ...favorite,
                confidenceScore: minGap
              });
              console.log(`[RecommendedPicks] FOUND GOOD ODDS for ${favorite.name} with gaps: ${gaps.join(', ')}`);
            } else {
              console.log(`[RecommendedPicks] ${favorite.name} didn't meet threshold, gaps: ${gaps.join(', ')}`);
            }
            
            // Helper function to match matchups-table.tsx exactly
            function decimalToAmericanInt(decimalOdds: number): number {
              if (decimalOdds >= 2.0) return Math.round((decimalOdds - 1) * 100);
              else return Math.round(-100 / (decimalOdds - 1));
            }
          }
          // For 2-ball matchups:
          else if (validPlayers.length === 2) {
            const p1 = validPlayers[0];
            const p2 = validPlayers[1];
            
            // Calculate odds gap using the same function as 3-ball
            const p1American = decimalToAmericanInt(p1.odds);
            const p2American = decimalToAmericanInt(p2.odds);
            const gap = Math.abs(p1American - p2American);
            
            console.log(`[RecommendedPicks] 2-ball gap between ${p1.name} (${p1American}) and ${p2.name} (${p2American}): ${gap}`);
            
            // If gap exceeds threshold, add the favorite to recommendations
            if (gap >= oddsGapPercentage) {
              playersWithGoodOdds.push({
                ...p1,
                confidenceScore: gap
              });
              console.log(`[RecommendedPicks] FOUND GOOD ODDS for ${p1.name} with gap: ${gap}`);
            } else {
              console.log(`[RecommendedPicks] ${p1.name} didn't meet threshold, gap: ${gap}`);
            }
            
            // Helper function matching the one above
            function decimalToAmericanInt(decimalOdds: number): number {
              if (decimalOdds >= 2.0) return Math.round((decimalOdds - 1) * 100);
              else return Math.round(-100 / (decimalOdds - 1));
            }
          }
        });
        
        // Note: We're now using decimalToAmericanInt() defined inside the matchup processing
        
        // Sort by odds gap (descending) and take the top 'limit'
        const sortedRecommendations = playersWithGoodOdds
          .sort((a, b) => b.confidenceScore - a.confidenceScore)
          .slice(0, limit);

        console.log(`[RecommendedPicks] Found ${playersWithGoodOdds.length} players with odds gap >= ${oddsGapPercentage}`);
        if (playersWithGoodOdds.length > 0) {
          console.log('[RecommendedPicks] Top players with good odds:', 
            playersWithGoodOdds.slice(0, 3).map(p => ({
              name: p.name,
              odds: p.odds,
              gap: p.confidenceScore
            }))
          );
        }

        setRecommendations(sortedRecommendations); // Store player data directly

      } catch (err) {
        console.error("Failed to fetch recommendations:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
        setRecommendations([])
      } finally {
        setLoading(false)
      }
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
    }
    return recommendations;
  }, [filterId, recommendations]);

<<<<<<< HEAD
  // All user parlays for indicator logic
  const userId = '00000000-0000-0000-0000-000000000001';
  const { data: allParlays = [] } = useParlaysQuery(userId);
  const allParlayPicks = (allParlays ?? []).flatMap((parlay: any) => parlay.picks || []);
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => (pick.picked_player_name || '').toLowerCase() === playerName.toLowerCase());
=======
    fetchRecommendations()
  }, [activeMatchupType, bookmaker, limit, oddsGapPercentage, eventId]) // Re-fetch if props change
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32

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

  // --- Restored return block, updated for UUID/DG_ID ---
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
<<<<<<< HEAD
        <h2 className="text-xl font-bold mb-4">Top {limit} Recommended Picks</h2>
=======
        <h2 className="text-xl font-bold mb-4">
          Top {activeMatchupType === "3ball" ? "3-Ball" : "2-Ball"} Picks
        </h2>
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32

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
            <AlertDescription>{error?.message || 'An unknown error occurred'} </AlertDescription>
          </Alert>
        )}

        {!isLoading && !isError && filteredAndMatchedRecommendations.length === 0 && (
          <p className="text-gray-400 text-center py-4">No recommendations available based on current data and filters.</p>
        )}

        {!isLoading && !isError && filteredAndMatchedRecommendations.length > 0 && (
          <div className="space-y-3">
<<<<<<< HEAD
            {filteredAndMatchedRecommendations.map((player, index) => {
              const { inParlay, selectionId } = isPlayerInParlay(String(player.dg_id), player.name)
              return (
                <div key={player.dg_id} className="p-4 bg-[#1e1e23] rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-lg">{player.name}</div>
                      <div className="text-sm text-gray-400">Matchup: {player.matchupId}</div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`text-lg font-semibold px-2 py-1 rounded mb-1 ${player.valueRating >= 8 ? "bg-green-900/30 text-green-400" : player.valueRating >= 7 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400"}`}>{player.valueRating?.toFixed(1)}</span>
                      <span className="text-base font-medium text-green-400">{formatOdds(player.odds)}</span>
                    </div>
=======
            {recommendations.map((player) => (
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
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                  </div>
                  <Button
                    size="sm"
                    variant={inParlay ? "secondary" : "outline"}
                    className="w-full mt-2 bg-[#2a2a35] border-none hover:bg-[#34343f] text-white"
                    onClick={() => {
                      if (inParlay && selectionId) {
                        removeFromParlay(selectionId, String(player.dg_id), player.name)
                      } else {
                        addToParlay({
                          id: `${player.matchupId}-${player.dg_id}`,
                          player: player.name,
                          matchupId: player.matchupId,
                          odds: player.odds,
                          valueRating: player.valueRating,
                          confidenceScore: player.confidenceScore ?? 75,
                          matchupType: matchupType,
                          group: player.group ?? "",
                        }, String(player.dg_id))
                      }
                    }}
                  >
                    {inParlay ? 'Remove from Parlay' : (<><Plus size={16} className="mr-1" /> Add to Parlay</>)}
                  </Button>
                </div>
<<<<<<< HEAD
              )
            })}
=======
                {(() => {
                  // Check if this player is already in the parlay
                  const { inParlay, selectionId } = isPlayerInParlay(player.id, player.name)
                  
                  return inParlay ? (
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full mt-2 bg-primary border-none hover:bg-primary/90 text-white"
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
                      className="w-full mt-2 bg-[#2a2a35] border-none hover:bg-[#34343f] text-white"
                      onClick={() => {
                        if (!player.id || !player.name) return;
                        
                        // Convert decimal odds to American odds if needed
                        const americanOdds = convertToAmericanOdds(player.odds);
                        
                        // Add player to parlay context
                        addToParlay({
                          id: Date.now().toString(),
                          matchupType: activeMatchupType,
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
                  );
                })()}
                
              </div>
            ))}
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
          </div>
        )}
      </CardContent>
    </Card>
  )
}
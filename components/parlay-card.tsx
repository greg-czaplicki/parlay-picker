'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    findPlayerMatchup,
    PlayerMatchupData,
    getLiveStatsForPlayers,
    addParlayPick,
    removeParlayPick,
    deleteParlay,
    ParlayPick,
    ParlayWithPicks,
    ParlayPickWithData 
} from '@/app/actions/matchups';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { LiveTournamentStat } from '@/types/definitions';
import { Trash2 } from 'lucide-react';

// Structure to hold player name, matchup, and live stats
interface ParlayPlayer {
  name: string; // The name used for searching (e.g., "Corey Conners")
  pickId?: number; // ID from the parlay_picks table
  matchup: PlayerMatchupData | null;
  liveStats: Record<number, LiveTournamentStat> | null; // dg_id -> LiveStat
  isLoadingMatchup: boolean;
  isLoadingStats: boolean;
  matchupError?: string;
  statsError?: string;
  isPersisted: boolean; // Flag to indicate if it's saved in DB
}

// Helper to format player name from "Last, First" to "First Last"
const formatPlayerNameDisplay = (name: string | null | undefined): string => {
    if (!name) return "N/A";
    return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
};

// Helper to format score
const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "-";
    if (score === 0) return "E";
    return score > 0 ? `+${score}` : `${score}`;
};

// Define Props for ParlayCard
interface ParlayCardProps {
    parlayId: number;
    parlayName: string | null;
    initialPicks: ParlayPick[];
    initialPicksWithData?: ParlayPickWithData[];
    selectedRound?: number | null; // Allow the parent to specify which round to display
    onDelete?: (parlayId: number) => void; // Callback to notify parent when parlay is deleted
}

export default function ParlayCard({ 
  parlayId,
  parlayName, 
  initialPicks,
  initialPicksWithData = [],
  selectedRound = null,
  onDelete
}: ParlayCardProps) {
  // Track component mount state
  const isMounted = useRef(true);
  
  // Track refresh interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Initialize state from props - use preloaded data if available
  const [players, setPlayers] = useState<ParlayPlayer[]>(() => {
    return initialPicks.map(pick => {
      // Check if we have preloaded data for this pick
      const preloadedData = initialPicksWithData.find(data => data.pick.id === pick.id);
      
      if (preloadedData) {
        // Use preloaded data
        return {
          name: pick.picked_player_name,
          pickId: pick.id,
          matchup: preloadedData.matchup,
          liveStats: preloadedData.liveStats,
          isLoadingMatchup: false,
          isLoadingStats: false,
          isPersisted: true,
          matchupError: preloadedData.matchupError,
          statsError: preloadedData.statsError,
        };
      } else {
        // No preloaded data, use default values
        return {
          name: pick.picked_player_name,
          pickId: pick.id,
          matchup: null,
          liveStats: null,
          isLoadingMatchup: true, // Start loading
          isLoadingStats: false,
          isPersisted: true,
          matchupError: undefined,
          statsError: undefined,
        };
      }
    });
  });
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  // Removed isLoadingInitialPicks, as data comes via props now

  // useEffect to fetch initial picks REMOVED (handled by initial state)

  // Function to load matchup data for a player
  const loadMatchupForPlayer = async (player: ParlayPlayer, index: number) => {
    // Skip if component unmounted
    if (!isMounted.current) return;
    
    try {
      const { matchup, error } = await findPlayerMatchup(player.name);
      
      // Skip if component unmounted during async call
      if (!isMounted.current) return;
      
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchup, matchupError: error, isLoadingMatchup: false } : p
      ));
      
      // If we got a matchup or even if we didn't (try to load stats by player name)
      if (isMounted.current) {
        if (matchup) {
          // If we have a matchup, load stats using the player IDs
          await loadStatsForPlayer({ ...player, matchup }, index);
        } else {
          // If no matchup, try to load stats just by player name
          await loadStatsByPlayerName(player, index);
        }
      }
    } catch (err) {
      console.error(`Error loading matchup for ${player.name}:`, err);
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchupError: "Failed to load matchup", isLoadingMatchup: false } : p
      ));

      // Even if matchup fails, try to get stats by player name
      if (isMounted.current) {
        await loadStatsByPlayerName(player, index);
      }
    }
  };
  
  // Function to load stats for a player's matchup
  // Function to load stats by player name when we don't have a matchup
  const loadStatsByPlayerName = async (player: ParlayPlayer, index: number) => {
    if (!isMounted.current) return;
    
    try {
      // Set loading state
      setPlayers(prev => prev.map((p, i) => 
        i === index ? { ...p, isLoadingStats: true } : p
      ));
      
      // Extract potential name formats for the search
      let playerName = player.name;
      let searchPatterns = [playerName];
      
      // Handle "Last, First" format
      if (playerName.includes(",")) {
        const [lastName, firstName] = playerName.split(",").map(part => part.trim());
        searchPatterns.push(`${firstName} ${lastName}`); // Convert to "First Last"
      } else {
        // Handle "First Last" format
        const parts = playerName.split(" ");
        if (parts.length >= 2) {
          const firstName = parts.slice(0, -1).join(" ");
          const lastName = parts[parts.length - 1];
          searchPatterns.push(`${lastName}, ${firstName}`); // Convert to "Last, First"
        }
      }
      
      // Make the database query to find stats based on name
      const supabase = createBrowserClient();
      
      // Build a like query for each pattern
      const likeQueries = searchPatterns.map(pattern => 
        `player_name.ilike."%${pattern}%"`
      ).join(",");
      
      const { data: playerStats, error } = await supabase
        .from('live_tournament_stats')
        .select('*')
        .or(likeQueries)
        .eq('event_name', 'Truist Championship') // Try to match current event
        .order('data_golf_updated_at', { ascending: false })
        .limit(10)
        .returns<LiveTournamentStat[]>();
      
      // Skip if component unmounted during async call
      if (!isMounted.current) return;
      
      if (error) {
        console.error(`Stats query error for ${player.name}:`, error);
        setPlayers(prev => prev.map((p, i) => 
          i === index ? {
            ...p,
            statsError: "Failed to query stats by name",
            isLoadingStats: false
          } : p
        ));
        return;
      }
      
      if (!playerStats || playerStats.length === 0) {
        console.log(`No stats found for player ${player.name}`);
        setPlayers(prev => prev.map((p, i) => 
          i === index ? {
            ...p,
            isLoadingStats: false
          } : p
        ));
        return;
      }
      
      // Process and update stats
      const statsMap: Record<number, LiveTournamentStat> = {};
      playerStats.forEach(stat => {
        if (stat.dg_id) {
          statsMap[stat.dg_id] = stat;
        }
      });
      
      console.log(`Found ${Object.keys(statsMap).length} stats for ${player.name}`);
      
      setPlayers(prev => prev.map((p, i) => 
        i === index ? {
          ...p, 
          liveStats: statsMap,
          isLoadingStats: false
        } : p
      ));
    } catch (err) {
      console.error(`Error loading stats by name for ${player.name}:`, err);
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      setPlayers(prev => prev.map((p, i) => 
        i === index ? {
          ...p,
          statsError: "Failed to load stats by name",
          isLoadingStats: false
        } : p
      ));
    }
  };
  
  // Function to load stats for a player's matchup
  const loadStatsForPlayer = async (player: ParlayPlayer, index: number) => {
    // Skip if no matchup or component unmounted
    if (!player.matchup || !isMounted.current) return;
    
    try {
      const playerIds = [
        player.matchup.p1_dg_id,
        player.matchup.p2_dg_id,
        player.matchup.p3_dg_id,
      ].filter((id): id is number => id !== null);
      
      if (playerIds.length === 0) {
        // Skip if component unmounted
        if (!isMounted.current) return;
        
        setPlayers(prev => prev.map((p, i) => 
          i === index ? { ...p, isLoadingStats: false, statsError: "No player IDs for stats" } : p
        ));
        return;
      }
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      // Set loading state
      setPlayers(prev => prev.map((p, i) => 
        i === index ? { ...p, isLoadingStats: true } : p
      ));
      
      const { stats, error } = await getLiveStatsForPlayers(playerIds);
      
      // Skip if component unmounted during async call
      if (!isMounted.current) return;
      
      // Process and update stats
      const statsMap: Record<number, LiveTournamentStat> = {};
      (stats || []).forEach(stat => {
        if (stat.dg_id) {
          statsMap[stat.dg_id] = stat;
        }
      });
      
      setPlayers(prev => prev.map((p, i) => 
        i === index ? {
          ...p, 
          liveStats: statsMap,
          statsError: error,
          isLoadingStats: false
        } : p
      ));
      
      if (error) {
        console.warn(`Stats error for ${player.name}:`, error);
      }
    } catch (err) {
      console.error(`Error loading stats for ${player.name}:`, err);
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      setPlayers(prev => prev.map((p, i) => 
        i === index ? {
          ...p,
          statsError: "Failed to load stats",
          isLoadingStats: false
        } : p
      ));
    }
  };
  
  
  // Load data once on component mount (only for players without preloaded data)
  useEffect(() => {
    // Set initial mounted state
    isMounted.current = true;
    
    // Skip if no players
    if (players.length === 0) return;
    
    // Set last refreshed time if we have preloaded data
    if (initialPicksWithData.length > 0) {
      setLastRefreshed(new Date());
    }
    
    // Get current players that need data loaded (don't have preloaded data)
    const pendingMatchupFetches = players.filter(p => !p.matchup && p.isLoadingMatchup && !p.matchupError);
    
    // Only load if we have any players that need data
    if (pendingMatchupFetches.length === 0) {
      return;
    }
    
    // Initial loading - happens once when the component mounts
    const loadInitialData = async () => {
      try {
        // First load all matchups one at a time to avoid race conditions
        for (let i = 0; i < pendingMatchupFetches.length; i++) {
          // Skip if component was unmounted
          if (!isMounted.current) return;
          
          const player = pendingMatchupFetches[i];
          const index = players.findIndex(p => p.name === player.name && p.pickId === player.pickId);
          
          if (index !== -1) {
            await loadMatchupForPlayer(player, index);
          }
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Skip if component was unmounted
        if (!isMounted.current) return;
        
        // Set the last refreshed time
        setLastRefreshed(new Date());
      } catch (error) {
        console.error("Error loading initial data:", error);
      }
    };
    
    // Start initial data loading
    loadInitialData();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount
  
  // Add a function to refresh data
  const refreshData = async () => {
    // Skip if already refreshing, no players, or component unmounted
    if (isRefreshing || players.length === 0 || !isMounted.current) return;
    
    setIsRefreshing(true);
    
    try {
      // Process each player - get matchups for those without, refresh stats for those with matchups
      for (let index = 0; index < players.length; index++) {
        // Skip if component unmounted
        if (!isMounted.current) break;
        
        const player = players[index];
        
        // If player doesn't have a matchup yet, load it first
        if (!player.matchup && !player.matchupError) {
          await loadMatchupForPlayer(player, index);
        } 
        // If player has a matchup, just refresh the stats
        else if (player.matchup) {
          await loadStatsForPlayer(player, index);
        }
        
        // Add a small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      // Update the last refreshed timestamp
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error refreshing data:", err);
      
      // Skip if component unmounted
      if (!isMounted.current) return;
      
      toast({
        title: "Error Refreshing Stats",
        description: "An unexpected error occurred while refreshing stats.",
        variant: "destructive",
      });
    } finally {
      // Only update state if component still mounted
      if (isMounted.current) {
        setIsRefreshing(false);
      }
    }
  };
  
  
  // Effect to refresh data every 5 minutes - with proper cleanup
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Only set up interval if we have players with matchups
    if (players.length > 0 && players.some(p => p.matchup)) {
      // Create a new interval that checks mounted state before refreshing
      intervalRef.current = setInterval(() => {
        // Only refresh if component is still mounted
        if (isMounted.current) {
          refreshData();
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
    
    // Clear interval on cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - set up once on mount

  // --- Add Player Handler ---
  const addPlayer = async () => {
    const trimmedName = newPlayerName.trim();
    if (!trimmedName || players.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({
            title: "Invalid Input",
            description: trimmedName ? "Player already added." : "Please enter a player name.",
            variant: "destructive",
        });
      return;
    }

    setIsAdding(true);
    setNewPlayerName('');

    try {
      // 1. Find the matchup first
      const { matchup, error: matchupError } = await findPlayerMatchup(trimmedName);

      if (matchupError) throw new Error(matchupError);
      if (!matchup) {
          toast({
              title: "Matchup Not Found",
              description: `No 3-ball matchup found for ${trimmedName}.`,
              variant: "default",
          });
          setIsAdding(false);
          return;
      }

      // Fix type for pickedPlayerId
      let pickedPlayerId: number | null | undefined;
      if (formatPlayerNameDisplay(matchup.p1_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p1_dg_id;
      else if (formatPlayerNameDisplay(matchup.p2_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p2_dg_id;
      else if (formatPlayerNameDisplay(matchup.p3_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p3_dg_id;

      if (!pickedPlayerId) { // Checks for null or undefined
          throw new Error("Could not identify picked player ID within the found matchup.");
      }

      // 2. Add to DB (use parlayId from props)
      const { pick, error: addPickError } = await addParlayPick({
          parlay_id: parlayId, // Use prop
          picked_player_dg_id: pickedPlayerId,
          picked_player_name: trimmedName,
          matchup_id: matchup.id,
          event_name: matchup.event_name,
          round_num: matchup.round_num,
      });

      if (addPickError) throw new Error(addPickError);
      if (!pick) throw new Error("Failed to save pick to database.");

      // 3. Add to local state
      const newPlayerEntry: ParlayPlayer = {
        name: trimmedName,
        pickId: pick.id,
        matchup: matchup,
        liveStats: null,
        isLoadingMatchup: false,
        isLoadingStats: false, // Stats fetch triggered by useEffect
        isPersisted: true,
        matchupError: undefined,
        statsError: undefined,
      };
      setPlayers(prev => [...prev, newPlayerEntry]);

    } catch (e) {
        console.error("Failed to add player:", e);
        const errorMessage = e instanceof Error ? e.message : "An unexpected error occurred.";
        toast({ title: "Error Adding Player", description: errorMessage, variant: "destructive" });
    } finally {
        setIsAdding(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNewPlayerName(event.target.value);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      addPlayer();
    }
  };

  const removePlayer = async (pickIdToRemove?: number, nameToRemove?: string) => {
    // Prefer removing by DB id if available
    if (pickIdToRemove) {
        const { success, error } = await removeParlayPick(pickIdToRemove);
        if (success) {
            setPlayers(prev => prev.filter(p => p.pickId !== pickIdToRemove));
        } else {
            toast({ title: "Error Removing Pick", description: error || "Failed to remove pick from database.", variant: "destructive" });
        }
    } else if (nameToRemove) {
        setPlayers(prev => prev.filter(p => p.name !== nameToRemove));
    } else {
        console.error("Remove player called without identifier.");
    }
  };

  // Updated render helper to accept optional status style/icon
  const renderMatchupPlayerLine = (
      dgId: number | null,
      playerName: string | null,
      liveStatsMap: Record<number, LiveTournamentStat> | null,
      searchedPlayerName: string,
      groupIsLoadingStats: boolean,
      statusStyle?: string, // Optional style for the searched player
      statusIcon?: React.ReactNode, // Optional icon for the searched player
      pickRoundNum?: number | null // Round number this pick is for
  ) => {
    if (!dgId || !playerName) return null;

    const liveStat = liveStatsMap?.[dgId];
    
    // Use round 2 scores if this card is showing a round 2 parlay
    const isRound2 = pickRoundNum === 2 || (!pickRoundNum && selectedRound === 2);
    const displayScore = (liveStat?.today !== undefined) ? formatScore(liveStat?.today) : "-";

    // Status information
    let displayThru = ""; // Default to empty
    if (liveStat) {
      if (liveStat.position === "F" || liveStat.thru === 18) {
        displayThru = " (F)"; // Show F if position is F OR thru is 18
      } else if (liveStat.thru) {
        displayThru = ` (Thru ${liveStat.thru})`; // Show Thru X otherwise
      } else if (liveStat.position === "CUT") {
        displayThru = " (CUT)";
      } else if (liveStat.position === "WD") {
        displayThru = " (WD)";
      }
    }

    const formattedPlayerName = formatPlayerNameDisplay(playerName);
    const isSearchedPlayer = formattedPlayerName.toLowerCase() === searchedPlayerName.toLowerCase();

    // Determine the final style: use statusStyle if it's the searched player, otherwise default
    const finalStyle = isSearchedPlayer ? statusStyle : '';

    return (
        <div
            key={dgId}
            className={`flex justify-between items-center px-2 py-1 rounded ${finalStyle}`}
        >
            <span className="text-sm flex items-center">
                 {formattedPlayerName}
                 {/* Render icon only for the searched player */} 
                 {isSearchedPlayer && statusIcon ? statusIcon : null}
            </span>
            <span className="text-xs whitespace-nowrap font-mono tracking-tight">
                {liveStat ? `${displayScore}${displayThru}` : groupIsLoadingStats ? <Loader2 className="h-3 w-3 animate-spin inline-block"/> : '-'}
            </span>
        </div>
    );
  };

  // --- Calculate Status Logic ---
  const calculateStatus = (player: ParlayPlayer) => {
      let playerLineStyle = 'font-bold text-primary';
      let playerLineIcon = null as React.ReactNode | null;
      let groupContainerStyle = '';
      const groupIsLoadingStats = player.isLoadingStats;

      const checkIcon = <Check size={14} className="inline-block ml-1.5 text-green-500" />;
      const xIcon = <X size={14} className="inline-block ml-1.5 text-red-500" />;

      if (player.matchup && player.liveStats && !player.isLoadingStats && !player.statsError) {
          const p1Id = player.matchup.p1_dg_id;
          const p2Id = player.matchup.p2_dg_id;
          const p3Id = player.matchup.p3_dg_id;

          const p1Stat = p1Id ? player.liveStats[p1Id] : undefined;
          const p2Stat = p2Id ? player.liveStats[p2Id] : undefined;
          const p3Stat = p3Id ? player.liveStats[p3Id] : undefined;

          // Find which player (p1, p2, p3) corresponds to the searched name
          let selectedPlayerId: number | null = null;
          if (p1Id && formatPlayerNameDisplay(player.matchup.p1_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p1Id;
          else if (p2Id && formatPlayerNameDisplay(player.matchup.p2_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p2Id;
          else if (p3Id && formatPlayerNameDisplay(player.matchup.p3_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p3Id;

          const selectedLiveStat = selectedPlayerId ? player.liveStats[selectedPlayerId] : undefined;

          // Check if the stats are relevant for the selected round
          const isP1StatRelevant = !selectedRound || !p1Stat?.round_num || 
            (selectedRound && p1Stat?.round_num && String(p1Stat.round_num) === String(selectedRound));
          const isP2StatRelevant = !selectedRound || !p2Stat?.round_num || 
            (selectedRound && p2Stat?.round_num && String(p2Stat.round_num) === String(selectedRound));
          const isP3StatRelevant = !selectedRound || !p3Stat?.round_num || 
            (selectedRound && p3Stat?.round_num && String(p3Stat.round_num) === String(selectedRound));
          const isSelectedStatRelevant = !selectedRound || !selectedLiveStat?.round_num || 
            (selectedRound && selectedLiveStat?.round_num && String(selectedLiveStat.round_num) === String(selectedRound));

          // If we're viewing a different round than the picks, don't show win/loss styling
          if (selectedRound && player.matchup.round_num !== selectedRound) {
            return { playerLineStyle, playerLineIcon, groupContainerStyle };
          }

          // Ensure all 3 players and the selected player's stats are available for comparison
          if (p1Stat && p2Stat && p3Stat && selectedLiveStat && selectedPlayerId &&
              isP1StatRelevant && isP2StatRelevant && isP3StatRelevant && isSelectedStatRelevant) {
              const scores = [
                  isP1StatRelevant ? (p1Stat.today ?? Infinity) : Infinity,
                  isP2StatRelevant ? (p2Stat.today ?? Infinity) : Infinity,
                  isP3StatRelevant ? (p3Stat.today ?? Infinity) : Infinity,
              ];
              const selectedScore = isSelectedStatRelevant ? (selectedLiveStat.today ?? Infinity) : Infinity;

              const finished = [
                  p1Stat.thru === 18 || p1Stat.position === 'F' || p1Stat.position === 'CUT' || p1Stat.position === 'WD',
                  p2Stat.thru === 18 || p2Stat.position === 'F' || p2Stat.position === 'CUT' || p2Stat.position === 'WD',
                  p3Stat.thru === 18 || p3Stat.position === 'F' || p3Stat.position === 'CUT' || p3Stat.position === 'WD',
              ];
              const selectedFinished = finished[p1Id === selectedPlayerId ? 0 : p2Id === selectedPlayerId ? 1 : 2];
              const allFinished = finished.every(f => f);

              // Find min score, excluding Infinity
              const validScores = scores.filter(s => s !== Infinity);
              const minScore = validScores.length > 0 ? Math.min(...validScores) : Infinity;

              const isWinning = selectedScore === minScore && scores.filter(s => s === minScore).length === 1;
              const isTiedForLead = selectedScore === minScore && scores.filter(s => s === minScore).length > 1;
              const isLosing = selectedScore > minScore;
              const shotsBehind = isLosing ? selectedScore - minScore : 0;

              // Player Line Style & Icon
              if (selectedScore === Infinity) {
                  playerLineStyle = 'font-bold text-muted-foreground';
              } else if (allFinished) {
                  // Final Result styling (applies to group container too)
                  if (isWinning || isTiedForLead) {
                      playerLineStyle = 'font-bold text-green-500';
                      playerLineIcon = checkIcon;
                      groupContainerStyle = 'border border-green-500/30 bg-green-500/5 rounded-md p-2';
                  } else { // Lost and Finished
                      playerLineStyle = 'font-bold text-red-500';
                      playerLineIcon = xIcon;
                      groupContainerStyle = 'border border-red-500/30 bg-red-500/5 rounded-md p-2';
                  }
              } else {
                  // In-Progress Styling (only player line changes color)
                  if (isWinning) {
                      playerLineStyle = 'font-bold text-green-500';
                  } else if (isTiedForLead) {
                      playerLineStyle = 'font-bold text-yellow-500';
                  } else if (isLosing) {
                      if (shotsBehind === 1) {
                          playerLineStyle = 'font-bold text-orange-400'; // Losing by 1
                      } else { // shotsBehind > 1
                          playerLineStyle = 'font-bold text-red-400'; // Losing by 2+ (Lighter Red)
                      }
                  }
                  // Set default padding for in-progress group container
                  groupContainerStyle = 'border border-transparent p-2';
              }
          }
      }
      // Ensure default padding if calculated style is empty (e.g., loading)
      if (!groupContainerStyle) {
         groupContainerStyle = 'border border-transparent p-2';
      }

      return { playerLineStyle, playerLineIcon, groupContainerStyle };
  };

  // Handler to delete the entire parlay
  const handleDeleteParlay = async () => {
    if (!confirm(`Are you sure you want to delete this parlay?`)) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const { success, error } = await deleteParlay(parlayId);
      if (success) {
        toast({ title: "Parlay Deleted", description: "Parlay has been successfully deleted." });
        onDelete?.(parlayId); // Notify parent page
      } else {
        toast({ title: "Error Deleting Parlay", description: error, variant: "destructive" });
      }
    } catch (err) {
      console.error("Error deleting parlay:", err);
      toast({ title: "Error Deleting Parlay", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Format the last refreshed time in 12-hour format
  const formatRefreshTime = () => {
    if (!lastRefreshed) return "";
    
    // Get hours in 12-hour format
    let hours = lastRefreshed.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12
    
    // Format as h:MM AM/PM
    const minutes = lastRefreshed.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <Card className="bg-background/90 backdrop-blur-sm border border-border/40 shadow-lg flex flex-col h-full">
      <CardHeader className="flex-row justify-between items-center pb-3"> {/* Use flex row for title and action buttons */} 
        <div>
          <CardTitle className="text-lg font-semibold">{parlayName || `Parlay #${parlayId}`}</CardTitle>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1">Last updated: {formatRefreshTime()}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs px-2 h-8" 
            onClick={refreshData} 
            disabled={isRefreshing || players.length === 0 || !players.some(p => p.matchup)}
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            )}
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
          
          {/* Delete Parlay Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-destructive" 
            onClick={handleDeleteParlay} 
            disabled={isDeleting}
            title="Delete Parlay"
          > 
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
          </Button>
        </div>
      </CardHeader>
      {/* Content takes remaining space and scrolls internally if needed */}
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">

        {/* Players List */}
        <div>
          {/* Removed "Selected Players & Matchups" header, implied by card title */}
          {players.length > 0 ? (
            <ul className="space-y-3">
              {players.map((player) => {
                  const groupIsLoadingStats = player.isLoadingStats;
                  const { playerLineStyle, playerLineIcon, groupContainerStyle } = calculateStatus(player);

                  return (
                    <li key={player.pickId || player.name} className="p-2 rounded-md border border-border/20 bg-muted/30 relative group">
                       <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayer(player.pickId, player.name)}
                            className="absolute top-0 right-0 h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove pick"
                        >
                            <X size={14} /> {/* Use X icon for removing pick */} 
                        </Button>
                        {player.matchupError && (
                            <p className="text-xs text-destructive px-1 py-2">Error finding matchup: {player.matchupError}</p>
                        )}
                        {!player.isLoadingMatchup && !player.matchupError && player.matchup && (
                            <div className={`text-sm text-muted-foreground space-y-0.5 ${groupContainerStyle}`}>
                               <p className="text-xs font-medium mb-1 text-muted-foreground/80">
                                 Group (R{player.matchup.round_num})
                                 {player.matchup.round_num === 1 && (
                                   <span className="text-blue-500 ml-1">Round 1</span>
                                 )}
                                 {player.matchup.round_num === 2 && (
                                   <span className="text-green-500 ml-1">Round 2 (Current)</span>
                                 )}
                               </p>
                               {renderMatchupPlayerLine(player.matchup.p1_dg_id, player.matchup.p1_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon, player.matchup.round_num)}
                               {renderMatchupPlayerLine(player.matchup.p2_dg_id, player.matchup.p2_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon, player.matchup.round_num)}
                               {renderMatchupPlayerLine(player.matchup.p3_dg_id, player.matchup.p3_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon, player.matchup.round_num)}
                               {player.statsError && !groupIsLoadingStats && (
                                   <p className="text-xs text-destructive mt-1">Error loading scores: {player.statsError}</p>
                               )}
                            </div>
                        )}
                        {!player.isLoadingMatchup && !player.matchupError && !player.matchup && (
                            <div className="p-4 bg-[#1e1e23] rounded-lg">
                              <div className="flex justify-between items-center">
                                <div className="font-medium">{player.name}</div>
                                <div className="text-xs px-2 py-1 rounded bg-[#2a2a35]">
                                  {player.pickId ? "Added from Parlay Builder" : "From Search"}
                                </div>
                              </div>
                              {/* Try to display live stats if available */}
                              {player.liveStats && Object.keys(player.liveStats).length > 0 ? (
                                <div className="mt-3 border border-border/20 rounded p-2 space-y-2">
                                  <div className="text-xs font-medium text-muted-foreground">
                                    Tournament Stats
                                  </div>
                                  {Object.values(player.liveStats).map((stat, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                      <div>{stat.event_name} (R{stat.round_num})</div>
                                      <div className="font-mono">
                                        {stat.position && 
                                          <span className="px-1.5 py-0.5 text-xs bg-primary/20 rounded ml-1">
                                            {stat.position}
                                          </span>
                                        }
                                        {stat.today !== undefined && 
                                          <span className={`px-1.5 py-0.5 text-xs rounded ml-1 ${
                                            stat.today < 0 ? "bg-green-500/20 text-green-300" : 
                                            stat.today > 0 ? "bg-red-500/20 text-red-300" : 
                                            "bg-gray-500/20"
                                          }`}>
                                            {stat.today === 0 ? "E" : stat.today > 0 ? `+${stat.today}` : stat.today}
                                          </span>
                                        }
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  No live tournament data available for this player.
                                </div>
                              )}
                            </div>
                        )}
                         {/* Show loader only if matchup is loading */}
                         {player.isLoadingMatchup && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto my-2" />}
                    </li>
                  );
              })}
            </ul>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-2">No picks added to this parlay yet.</p>
          )}
        </div>
      </CardContent>
      {/* No dialog needed for this simpler implementation */}
    </Card>
  );
}
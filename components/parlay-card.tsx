'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    findPlayerMatchup,
    PlayerMatchupData,
    getLiveStatsForPlayers,
    getParlaysAndPicks,
    addParlayPick,
    removeParlayPick,
    ParlayPick,
    ParlayWithPicks
} from '@/app/actions/matchups';
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
    // Optional: Add a callback to notify parent page when parlay is deleted
    // onDelete?: (parlayId: number) => void;
}

export default function ParlayCard({ parlayId, parlayName, initialPicks /*, onDelete */ }: ParlayCardProps) {
  // Initialize state from props
  const [players, setPlayers] = useState<ParlayPlayer[]>(() =>
      initialPicks.map(pick => ({
          name: pick.picked_player_name,
          pickId: pick.id,
          matchup: null,
          liveStats: null,
          isLoadingMatchup: true, // Start loading
          isLoadingStats: false,
          isPersisted: true,
          matchupError: undefined,
          statsError: undefined,
      }))
  );
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  // Removed isLoadingInitialPicks, as data comes via props now

  // useEffect to fetch initial picks REMOVED (handled by initial state)

  // Function to load matchup data for a player
  const loadMatchupForPlayer = async (player: ParlayPlayer, index: number) => {
    try {
      const { matchup, error } = await findPlayerMatchup(player.name);
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchup, matchupError: error, isLoadingMatchup: false } : p
      ));
      
      // If we got a matchup, immediately load stats for it
      if (matchup) {
        await loadStatsForPlayer({ ...player, matchup }, index);
      }
    } catch (err) {
      console.error(`Error loading matchup for ${player.name}:`, err);
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchupError: "Failed to load matchup", isLoadingMatchup: false } : p
      ));
    }
  };
  
  // Function to load stats for a player's matchup
  const loadStatsForPlayer = async (player: ParlayPlayer, index: number) => {
    if (!player.matchup) return;
    
    try {
      const playerIds = [
        player.matchup.p1_dg_id,
        player.matchup.p2_dg_id,
        player.matchup.p3_dg_id,
      ].filter((id): id is number => id !== null);
      
      if (playerIds.length === 0) {
        setPlayers(prev => prev.map((p, i) => 
          i === index ? { ...p, isLoadingStats: false, statsError: "No player IDs for stats" } : p
        ));
        return;
      }
      
      // Set loading state
      setPlayers(prev => prev.map((p, i) => 
        i === index ? { ...p, isLoadingStats: true } : p
      ));
      
      const { stats, error } = await getLiveStatsForPlayers(playerIds);
      
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
      setPlayers(prev => prev.map((p, i) => 
        i === index ? {
          ...p,
          statsError: "Failed to load stats",
          isLoadingStats: false
        } : p
      ));
    }
  };
  
  // Load data for all players on mount and when players change
  useEffect(() => {
    // Skip if no players
    if (players.length === 0) return;
    
    // Create a map of pending actions to track what needs to be fetched
    const pendingMatchupFetches = players.filter(p => !p.matchup && p.isLoadingMatchup && !p.matchupError);
    const pendingStatsFetches = players.filter(p => p.matchup && !p.liveStats && !p.isLoadingStats && !p.statsError);
    
    // Only proceed if there's actual work to do
    if (pendingMatchupFetches.length === 0 && pendingStatsFetches.length === 0) {
      return;
    }
    
    // Initial loading - happens once when the component mounts
    const loadInitialData = async () => {
      // First load all matchups
      await Promise.all(pendingMatchupFetches.map(async (player) => {
        const index = players.findIndex(p => p.name === player.name && p.pickId === player.pickId);
        if (index !== -1) {
          await loadMatchupForPlayer(player, index);
        }
      }));
      
      // Then load stats for any players that have matchups but no stats yet
      const updatedPlayers = [...players];
      const pendingStats = updatedPlayers.filter(p => p.matchup && !p.liveStats && !p.isLoadingStats);
      
      await Promise.all(pendingStats.map(async (player) => {
        const index = updatedPlayers.findIndex(p => p.name === player.name && p.pickId === player.pickId);
        if (index !== -1) {
          await loadStatsForPlayer(player, index);
        }
      }));
      
      // Set the last refreshed time
      setLastRefreshed(new Date());
    };
    
    loadInitialData();
  }, [players.length]);
  
  // Add a function to refresh data
  const refreshData = async () => {
    if (isRefreshing || players.length === 0) return;
    
    setIsRefreshing(true);
    
    try {
      // Process each player - get matchups for those without, refresh stats for those with matchups
      const refreshPromises = players.map(async (player, index) => {
        // If player doesn't have a matchup yet, load it first
        if (!player.matchup && !player.matchupError) {
          await loadMatchupForPlayer(player, index);
        } 
        // If player has a matchup, just refresh the stats
        else if (player.matchup) {
          await loadStatsForPlayer(player, index);
        }
      });
      
      // Wait for all refresh operations to complete
      await Promise.all(refreshPromises);
      
      // Update the last refreshed timestamp
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error refreshing data:", err);
      toast({
        title: "Error Refreshing Stats",
        description: "An unexpected error occurred while refreshing stats.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Effect to refresh data every 5 minutes
  useEffect(() => {
    // Skip if no players or no matchups to refresh
    if (players.length === 0 || !players.some(p => p.matchup)) {
      return;
    }
    
    const interval = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length, players.some(p => p.matchup)]);

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
      statusIcon?: React.ReactNode // Optional icon for the searched player
  ) => {
    if (!dgId || !playerName) return null;

    const liveStat = liveStatsMap?.[dgId];
    const displayScore = formatScore(liveStat?.today);

    // Update Thru display logic
    let displayThru = ""; // Default to empty
    if (liveStat?.position === "F" || liveStat?.thru === 18) {
        displayThru = " (F)"; // Show F if position is F OR thru is 18
    } else if (liveStat?.thru) {
        displayThru = ` (Thru ${liveStat.thru})`; // Show Thru X otherwise
    } else if (liveStat?.position === "CUT") {
        displayThru = " (CUT)";
    } else if (liveStat?.position === "WD") {
        displayThru = " (WD)";
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

          // Ensure all 3 players and the selected player's stats are available for comparison
          if (p1Stat && p2Stat && p3Stat && selectedLiveStat && selectedPlayerId) {
              const scores = [
                  p1Stat.today ?? Infinity,
                  p2Stat.today ?? Infinity,
                  p3Stat.today ?? Infinity,
              ];
              const selectedScore = selectedLiveStat.today ?? Infinity;

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

  // Optional: Handler to delete the entire parlay
  // const handleDeleteParlay = async () => {
  //    if (confirm(`Are you sure you want to delete the parlay "${parlayName || `ID: ${parlayId}`}"? This cannot be undone.`)) {
  //       const { success, error } = await deleteParlay(parlayId); // Assuming deleteParlay action exists
  //       if (success) {
  //          toast({ title: "Parlay Deleted" });
  //          onDelete?.(parlayId); // Notify parent page
  //       } else {
  //          toast({ title: "Error Deleting Parlay", description: error, variant: "destructive" });
  //       }
  //    }
  // };

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
          
          {/* Optional: Delete Parlay Button */}
          {/* <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleDeleteParlay} title="Delete Parlay"> 
             <Trash2 size={16} />
          </Button> */}
        </div>
      </CardHeader>
      {/* Content takes remaining space and scrolls internally if needed */}
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4"> 
        {/* Input section */}
        <div className="flex space-x-2"> 
          <Input
            type="text"
            placeholder="Add player name..."
            value={newPlayerName}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isAdding}
            className="flex-grow h-9 text-sm"
          />
          <Button onClick={addPlayer} disabled={isAdding || !newPlayerName.trim()} size="sm">
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add
          </Button>
        </div>

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
                               <p className="text-xs font-medium mb-1 text-muted-foreground/80">Group (R{player.matchup.round_num}):</p>
                               {renderMatchupPlayerLine(player.matchup.p1_dg_id, player.matchup.p1_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon)}
                               {renderMatchupPlayerLine(player.matchup.p2_dg_id, player.matchup.p2_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon)}
                               {renderMatchupPlayerLine(player.matchup.p3_dg_id, player.matchup.p3_player_name, player.liveStats, player.name, groupIsLoadingStats, playerLineStyle, playerLineIcon)}
                               {player.statsError && !groupIsLoadingStats && (
                                   <p className="text-xs text-destructive mt-1">Error loading scores: {player.statsError}</p>
                               )}
                            </div>
                        )}
                        {!player.isLoadingMatchup && !player.matchupError && !player.matchup && (
                            <p className="text-sm text-muted-foreground italic px-1 py-2">No 3-ball matchup data found for {player.name}.</p>
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
    </Card>
  );
} 
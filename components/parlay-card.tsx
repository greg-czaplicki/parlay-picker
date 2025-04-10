'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    findPlayerMatchup,
    PlayerMatchupData,
    getLiveStatsForPlayers,
    getParlayPicks,
    addParlayPick,
    removeParlayPick,
    ParlayPick
} from '@/app/actions/matchups';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { LiveTournamentStat } from '@/types/definitions';

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

export default function ParlayCard() {
  const [players, setPlayers] = useState<ParlayPlayer[]>([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoadingInitialPicks, setIsLoadingInitialPicks] = useState(true);

  // --- Fetch initial picks on mount ---
  useEffect(() => {
      setIsLoadingInitialPicks(true);
      getParlayPicks().then(({ picks, error }) => {
          if (error) {
              toast({ title: "Error Loading Saved Picks", description: error, variant: "destructive" });
          } else if (picks && picks.length > 0) {
              const initialPlayers: ParlayPlayer[] = picks.map(pick => ({
                  name: pick.picked_player_name, // Use the name from the pick
                  pickId: pick.id,
                  matchup: null, // Will be fetched
                  liveStats: null, // Will be fetched
                  isLoadingMatchup: true, // Start loading matchup
                  isLoadingStats: false,
                  isPersisted: true, // Mark as loaded from DB
                  matchupError: undefined,
                  statsError: undefined,
              }));
              setPlayers(initialPlayers);
          } else {
          }
          setIsLoadingInitialPicks(false);
      }).catch(err => {
         console.error("Error in getParlayPicks promise:", err);
         toast({ title: "Error Loading Saved Picks", description: err.message, variant: "destructive" });
         setIsLoadingInitialPicks(false);
      });
  }, []);

  // --- Fetch matchup/stats when players change (includes initial load) ---
  useEffect(() => {
    players.forEach((player, index) => {
        // Fetch matchup if needed
        if (!player.matchup && player.isLoadingMatchup && !player.matchupError) {
             findPlayerMatchup(player.name).then(({ matchup, error }) => {
                setPlayers(prev => prev.map((p, i) =>
                    i === index ? { ...p, matchup, matchupError: error, isLoadingMatchup: false } : p
                ));
                if (error) { /* Optional: toast? */ }
             });
        }

        // Fetch stats if matchup is loaded, stats aren't, etc.
        if (player.matchup && !player.liveStats && !player.isLoadingStats && !player.statsError) {
             const playerIds = [
                player.matchup.p1_dg_id,
                player.matchup.p2_dg_id,
                player.matchup.p3_dg_id,
             ].filter((id): id is number => id !== null);

             if (playerIds.length > 0) {
                 setPlayers(prev => {
                    return prev.map((p, i) => i === index ? { ...p, isLoadingStats: true } : p);
                 });

                 getLiveStatsForPlayers(playerIds).then(({ stats, error }) => {
                    const statsMap: Record<number, LiveTournamentStat> = {};
                    (stats || []).forEach(stat => {
                        if (stat.dg_id) {
                           statsMap[stat.dg_id] = stat;
                        }
                    });
                    setPlayers(prev => {
                        return prev.map((p, i) => i === index ? {
                            ...p,
                            liveStats: statsMap,
                            statsError: error,
                            isLoadingStats: false
                        } : p);
                    });
                    if (error) {
                       toast({
                           title: "Error Fetching Live Stats",
                           description: `Failed to get live stats for ${player.name}'s group: ${error}`,
                           variant: "destructive",
                       });
                    }
                 }).catch(err => {
                      console.error(`   -> Error in getLiveStatsForPlayers promise for index ${index}:`, err);
                      // Also update state on promise rejection
                      setPlayers(prev => prev.map((p, i) => i === index ? {
                          ...p,
                          statsError: err.message || "Promise failed",
                          isLoadingStats: false
                      } : p));
                 });
             } else {
                 setPlayers(prev => prev.map((p, i) => i === index ? { ...p, isLoadingStats: false, statsError: "No player IDs for stats" } : p));
             }
        }
    });
  }, [players]);

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
    setNewPlayerName(''); // Clear input immediately

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

      // 2. Add to DB
      const { pick, error: addPickError } = await addParlayPick({
          picked_player_dg_id: pickedPlayerId,
          picked_player_name: trimmedName, // Store the name used for searching
          matchup_id: matchup.id,
          event_name: matchup.event_name,
          round_num: matchup.round_num,
      });

      if (addPickError) throw new Error(addPickError);
      if (!pick) throw new Error("Failed to save pick to database.");

      // 3. Add to local state (with the new pickId)
      const newPlayerEntry: ParlayPlayer = {
        name: trimmedName,
        pickId: pick.id,
        matchup: matchup, // We already have it
        liveStats: null, // Will be fetched by useEffect
        isLoadingMatchup: false, // Already loaded
        isLoadingStats: false, // Let useEffect handle setting this to true
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
    const displayThru = liveStat?.thru ? ` (Thru ${liveStat.thru})` : liveStat?.position === "CUT" ? " (CUT)" : liveStat?.position === "WD" ? " (WD)" : ""; // Add WD status
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

  return (
    <Card className="bg-background/90 backdrop-blur-sm border border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Parlay Builder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-6">
          <Input
            type="text"
            placeholder="Add player name (e.g., Scottie Scheffler)"
            value={newPlayerName}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isAdding}
            className="flex-grow"
          />
          <Button onClick={addPlayer} disabled={isAdding || !newPlayerName.trim()}>
            {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Add Player
          </Button>
        </div>
        <div>
          <h3 className="font-medium mb-3 text-base text-muted-foreground">Selected Players & Matchups:</h3>
          {isLoadingInitialPicks ? (
              <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin inline-block text-muted-foreground" /></div>
          ) : players.length > 0 ? (
            <ul className="space-y-3">
              {players.map((player) => {
                  const groupIsLoadingStats = player.isLoadingStats;
                  let statusStyle = 'font-bold text-primary'; // Default style
                  let statusIcon = null as React.ReactNode | null;
                  const checkIcon = <Check size={14} className="inline-block ml-1.5 text-green-500" />;
                  const xIcon = <X size={14} className="inline-block ml-1.5 text-red-500" />;

                  // Calculate status if matchup and stats are loaded
                  if (player.matchup && player.liveStats && !groupIsLoadingStats && !player.statsError) {
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

                          const isWinning = selectedScore === minScore && scores.filter(s => s === minScore).length === 1; // Strictly lowest
                          const isTiedForLead = selectedScore === minScore && scores.filter(s => s === minScore).length > 1;

                          if (selectedScore === Infinity) { // Handle missing score case
                             statusStyle = 'font-bold text-muted-foreground'; // Dim if no score
                          } else if (isWinning) {
                              statusStyle = 'font-bold text-green-500';
                              if (allFinished) statusIcon = checkIcon;
                          } else if (isTiedForLead) {
                              statusStyle = 'font-bold text-yellow-500'; // Maybe yellow for tied?
                              if (allFinished) statusIcon = checkIcon; // Still 'won' if tied and finished
                          } else { // Losing
                              if (allFinished) {
                                 statusStyle = 'font-bold text-red-500';
                                 statusIcon = xIcon;
                              } else if (!selectedFinished) {
                                 statusStyle = 'font-bold text-yellow-500'; // Losing but in progress
                              } else {
                                 statusStyle = 'font-bold text-red-500'; // Finished and lost (others may still play)
                              }
                          }
                      }
                  }

                  return (
                    <li key={player.pickId || player.name} className="p-3 rounded-md border border-border/30 bg-muted/40 relative group">
                       <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePlayer(player.pickId, player.name)}
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove player"
                        >
                            <span className="text-xs">✕</span>
                        </Button>
                      <div className="flex items-center mb-2">
                        {(player.isLoadingMatchup) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>

                      {player.matchupError && (
                        <p className="text-xs text-destructive">Error finding matchup: {player.matchupError}</p>
                      )}
                      {!player.isLoadingMatchup && !player.matchupError && player.matchup && (
                        <div className="text-sm text-muted-foreground space-y-0.5">
                           {/* Pass calculated statusStyle and statusIcon */} 
                           {renderMatchupPlayerLine(player.matchup.p1_dg_id, player.matchup.p1_player_name, player.liveStats, player.name, groupIsLoadingStats, statusStyle, statusIcon)}
                           {renderMatchupPlayerLine(player.matchup.p2_dg_id, player.matchup.p2_player_name, player.liveStats, player.name, groupIsLoadingStats, statusStyle, statusIcon)}
                           {renderMatchupPlayerLine(player.matchup.p3_dg_id, player.matchup.p3_player_name, player.liveStats, player.name, groupIsLoadingStats, statusStyle, statusIcon)}

                           {player.statsError && !groupIsLoadingStats && (
                               <p className="text-xs text-destructive mt-1">Error loading scores: {player.statsError}</p>
                           )}
                        </div>
                      )}
                       {!player.isLoadingMatchup && !player.matchupError && !player.matchup && (
                         <p className="text-sm text-muted-foreground italic">No 3-ball matchup data found.</p>
                       )}
                    </li>
                  );
              })}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground py-4">No players added yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 
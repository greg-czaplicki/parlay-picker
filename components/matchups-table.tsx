"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Sliders, CheckCircle, Info, PlusCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { detect3BallDivergence } from "@/lib/utils"
import { useMatchupsQuery } from "@/hooks/use-matchups-query"
import { usePlayerStatsQuery, PlayerStat } from "@/hooks/use-player-stats-query"
import { useParlayContext } from "@/context/ParlayContext"
import { useParlaysQuery } from '@/hooks/use-parlays-query'
import { PlayerSearchWithCount, usePlayerSearch } from "@/components/ui/player-search"
import React from 'react'

// Only 3-ball matchups
interface SupabaseMatchupRow {
  uuid: string;
  event_id: string;
  event_name?: string;
  round_num: number;
  type: string;
  created_at: string;
  player1_dg_id: number;
  player1_name: string;
  player2_dg_id: number;
  player2_name: string;
  player3_dg_id?: number | null;
  player3_name?: string | null;
  odds1?: number | null;
  odds2?: number | null;
  odds3?: number | null;
  draftkings_p1_odds?: number | null;
  draftkings_p2_odds?: number | null;
  draftkings_p3_odds?: number | null;
  dg_odds1?: number | null;
  dg_odds2?: number | null;
  dg_odds3?: number | null;
  teetime?: string | null;
  tee_time?: string | null;
}

// Interface for 2-ball matchups
interface SupabaseMatchupRow2Ball {
  uuid: string;
  event_id: string;
  event_name?: string;
  round_num: number;
  type: string;
  created_at: string;
  player1_dg_id: number;
  player1_name: string;
  player2_dg_id: number;
  player2_name: string;
  odds1?: number | null;
  odds2?: number | null;
  draftkings_p1_odds?: number | null;
  draftkings_p2_odds?: number | null;
  dg_odds1?: number | null;
  dg_odds2?: number | null;
  teetime?: string | null;
  tee_time?: string | null;
  // Individual player tee times for 2-ball matchups
  player1_teetime?: string | null;
  player2_teetime?: string | null;
  player1_tee_time?: string | null;
  player2_tee_time?: string | null;
}

// Interface for live tournament stats
interface LiveTournamentStat {
  dg_id: number;
  player_name: string;
  event_name: string;
  round_num: string;
  position: string | null;
  thru: number | null;
  today: number | null;
  total: number | null;
}

// Combined type for both matchup types
type MatchupRow = SupabaseMatchupRow | SupabaseMatchupRow2Ball;

// Helper type guard for SupabaseMatchupRow
function isSupabaseMatchupRow(matchup: MatchupRow): matchup is SupabaseMatchupRow {
  return (matchup as any).type === '3ball';
}

// Helper type guard for SupabaseMatchupRow2Ball
function isSupabaseMatchupRow2Ball(matchup: MatchupRow): matchup is SupabaseMatchupRow2Ball {
  return (matchup as any).type === '2ball';
}

interface MatchupsTableProps {
  eventId: number | null;
  matchupType?: "2ball" | "3ball";
  roundNum?: number | null;
  showFilters?: boolean;
  compactFilters?: boolean;
  // Allow passing pre-fetched matchups data to prevent duplicate API calls
  sharedMatchupsData?: MatchupRow[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  // Player search props for highlighting
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
}

interface Player {
  id: string;
  dg_id: number | null | undefined;
  name: string;
  odds: number | null | undefined;
  dgOdds: number | null | undefined;
  tee_time: string | null;
}

export default function MatchupsTable({ 
  eventId, 
  matchupType = "3ball", 
  roundNum, 
  sharedMatchupsData,
  isLoading,
  isError,
  error,
  playerSearchTerm,
  highlightText
}: MatchupsTableProps) {
  // Odds gap filter state
  const [oddsGapThreshold, setOddsGapThreshold] = useState(0);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Use our matchups query directly, but only if shared data is not provided
  const { data: matchups, isLoading: matchupsLoading, isError: matchupsError, error: matchupsErrorDetails } = useMatchupsQuery(
    sharedMatchupsData ? null : eventId, 
    matchupType, 
    roundNum
  );

  // Use shared data if provided, otherwise use query result
  const finalMatchupsData = sharedMatchupsData || matchups;
  const finalIsLoading = sharedMatchupsData ? (isLoading ?? false) : matchupsLoading;
  const finalIsError = sharedMatchupsData ? (isError ?? false) : matchupsError;
  const finalError = sharedMatchupsData ? error : matchupsErrorDetails;

  // Use type guards before accessing fields to extract player IDs for stats
  const playerIds = (finalMatchupsData ?? []).flatMap(m => {
    if (isSupabaseMatchupRow(m)) {
      const ids = [
        (m as any).player1_dg_id,
        (m as any).player2_dg_id
      ];
      if ((m as any).player3_dg_id != null) ids.push((m as any).player3_dg_id);
      return ids.filter((id): id is number => typeof id === 'number' && !isNaN(id));
    } else if (isSupabaseMatchupRow2Ball(m)) {
      const ids = [
        (m as any).player1_dg_id,
        (m as any).player2_dg_id
      ];
      return ids.filter((id): id is number => typeof id === 'number' && !isNaN(id));
    }
    return [];
  }).map(String);

  // Use React Query for player stats (use roundNum prop directly, default to 1)
  const safeRoundNum = typeof roundNum === 'number' && !isNaN(roundNum) && roundNum > 0 ? roundNum : 1;
  const { data: playerStats, isLoading: loadingStats, isError: isErrorStats, error: errorStats } = usePlayerStatsQuery(eventId, safeRoundNum, playerIds);

  // Always use string keys for playerStatsMap
  const playerStatsMap: Record<string, PlayerStat> = (playerStats ?? []).reduce((acc, stat) => {
    if (stat.player_id != null) acc[String(stat.player_id)] = stat;
    return acc;
  }, {} as Record<string, PlayerStat>);

  const decimalToAmerican = (decimalOdds: number): string => {
    if (decimalOdds >= 2.0) return `+${Math.round((decimalOdds - 1) * 100)}`;
    else if (decimalOdds > 1.0) return `${Math.round(-100 / (decimalOdds - 1))}`;
    else return "-";
  };

  const formatOdds = (odds: number | null): string => {
    if (odds === null || odds === undefined || odds <= 1) return "-";
    return decimalToAmerican(odds);
  };

  const formatPlayerName = (name: string): string => {
    return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name ?? "";
  };

  // Helper function to format golf scores properly
  const formatGolfScore = (scoreValue: number | undefined | null): string => {
    if (scoreValue === undefined || scoreValue === null) return '-';
    if (scoreValue === 0) {
      return 'E';
    } else if (scoreValue >= 50 && scoreValue <= 100) {
      // This is likely a raw stroke count (66, 73, etc.)
      return scoreValue.toString();
    } else if (scoreValue >= -15 && scoreValue <= 25) {
      // This is likely relative to par
      if (scoreValue > 0) {
        return `+${scoreValue}`;
      } else {
        return scoreValue.toString();
      }
    } else {
      // Outside expected ranges, might be bad data
      return '-';
    }
  };

  // Helper function to format player position data
  const formatPlayerPosition = (playerId: string, teeTime: string | null): { position: string; score: string } => {
    const playerStat = playerStatsMap[playerId];
    
    if (!playerStat) {
      return { position: '-', score: '-' };
    }

    // If we have no tee time yet, or the tee time is in the future, show just position
    const now = new Date();
    const teeTimeDate = teeTime ? new Date(teeTime) : null;
    if (!teeTimeDate || teeTimeDate > now) {
      return { position: playerStat.position || '-', score: '-' };
    }

    // Format position
    const position = playerStat.position || '-';
    
    // Format score based on available data
    let score = '-';
    if (playerStat.total !== null) {
      score = formatGolfScore(playerStat.total);
    } else if (playerStat.today !== null) {
      score = formatGolfScore(playerStat.today);
    }

    // Add "thru" information if available
    if (playerStat.thru !== null) {
      if (playerStat.thru === 18) {
        score += ' (F)';
      } else {
        score += ` (${playerStat.thru})`;
      }
    }

    return { position, score };
  };

  // Format tee time - assume times are already in correct local tournament time
  const formatTeeTime = (teeTime: string | null): { localTime: string; easternDiff: string } => {
    if (!teeTime) return { localTime: "-", easternDiff: "" };
    
    try {
      // Handle the teetime format which is simpler: "2025-06-12 08:02"
      if (teeTime.includes(' ') && !teeTime.includes('T')) {
        // This is the teetime format: "2025-06-12 08:02"
        const timePart = teeTime.split(' ')[1]; // Get "08:02"
        if (timePart) {
          const [hours, minutes] = timePart.split(':').map(Number);
          const localDate = new Date();
          localDate.setHours(hours, minutes, 0, 0);
          
          const localTime = localDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          return { localTime, easternDiff: "" };
        }
      }
      
      // Fallback for ISO format tee_time
      const teeTimeDate = new Date(teeTime);
      const hours = teeTimeDate.getUTCHours();
      const minutes = teeTimeDate.getUTCMinutes();
      
      const localDate = new Date();
      localDate.setHours(hours, minutes, 0, 0);
      
      const localTime = localDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return { localTime, easternDiff: "" };
    } catch (error) {
      return { localTime: "-", easternDiff: "" };
    }
  };

  // Calculate if the odds gap exceeds the threshold
  const hasSignificantOddsGap = (playerOdds: number | null, referenceOdds: number | null): boolean => {
    if (!playerOdds || !referenceOdds || playerOdds <= 1 || referenceOdds <= 1) return false;
    // For 3-ball matchups, we want to highlight value - odds that are higher than expected
    // compared to the second favorite
    // Convert decimal odds to American for comparison
    const americanStrPlayer = decimalToAmerican(playerOdds);
    const americanStrReference = decimalToAmerican(referenceOdds);
    // Parse American odds to numbers, respecting negative values for favorites
    const americanPlayer = parseInt(americanStrPlayer);
    const americanReference = parseInt(americanStrReference);
    if (isNaN(americanPlayer) || isNaN(americanReference)) return false;
    // Calculate the absolute difference between the odds
    const diff = Math.abs(americanPlayer - americanReference);
    // For the comparison to be meaningful, we're looking for significant discrepancies
    // where the player's odds are notably different from the second-best player
    return diff >= oddsGapThreshold;
  };

  // Parlay context and all user parlays for indicator logic - only check against active parlays (not settled ones)
  const userId = '00000000-0000-0000-0000-000000000001';
  const { selections, addSelection, removeSelection } = useParlayContext();
  const { data: allParlays = [] } = useParlaysQuery(userId);
  
  // Filter to only active parlays (parlays with at least one unsettled pick)
  const activeParlays = (allParlays ?? []).filter((parlay: any) => {
    if (!Array.isArray(parlay.picks)) return false;
    return parlay.picks.some((pick: any) => 
      !pick.settlement_status || pick.settlement_status === 'pending'
    );
  });
  
  // Flatten all picks from active parlays only (for conflict detection)
  const allParlayPicks = activeParlays.flatMap((parlay: any) => 
    (parlay.picks || []).map((pick: any) => ({
      ...pick,
      parlay_round_num: parlay.round_num  // Include round number from parent parlay
    }))
  );

  // Flatten all picks from ALL parlays (for round indicator), but only for the current tournament
  const allHistoricalPicks = (allParlays ?? []).flatMap((parlay: any) => 
    (parlay.picks || []).map((pick: any) => ({
      ...pick,
      parlay_round_num: parlay.round_num  // Include round number from parent parlay
    }))
  ).filter((pick: any) => {
    // Only include picks from the current tournament (event_id)
    // We need to check if the pick's event_id matches the current eventId
    return pick.event_id === eventId;
  });

  
  // Helper to check if a player is in the current parlay
  const isPlayerInCurrentParlay = (playerName: string) => {
    const inCurrent = selections.some(s => s.player.toLowerCase() === playerName.toLowerCase());
    return inCurrent;
  }
  
  // Helper to check if a player is in any active/pending parlay
  const isPlayerInAnyParlay = (playerName: string) => {
    // Check current parlay selections
    const inCurrent = isPlayerInCurrentParlay(playerName);
    // Check active/pending parlays only (settled parlays allow reuse)
    const inSubmitted = allParlayPicks.some((pick: any) => {
      const pickPlayerName = pick.picked_player_name || '';
      // Format both names the same way for comparison
      const formattedPickName = formatPlayerName(pickPlayerName).toLowerCase();
      const formattedCheckName = formatPlayerName(playerName).toLowerCase();
      return formattedPickName === formattedCheckName;
    });
    return inCurrent || inSubmitted;
  }
  
  // Helper to get player status for visual indicators
  const getPlayerStatus = (playerName: string) => {
    const inCurrent = isPlayerInCurrentParlay(playerName);
    
    // Check active parlays for conflicts
    const usedInActiveParlay = allParlayPicks.find((pick: any) => {
      const pickPlayerName = (pick.picked_player_name || '');
      const checkPlayerName = playerName;
      
      // Format both names the same way for comparison
      const formattedPickName = formatPlayerName(pickPlayerName).toLowerCase();
      const formattedCheckName = formatPlayerName(checkPlayerName).toLowerCase();
      
      const matches = formattedPickName === formattedCheckName;
      return matches;
    });
    
    // Check ALL parlays for round indicator
    const usedInAnyParlay = allHistoricalPicks.find((pick: any) => {
      const pickPlayerName = (pick.picked_player_name || '');
      const checkPlayerName = playerName;
      
      // Format both names the same way for comparison
      const formattedPickName = formatPlayerName(pickPlayerName).toLowerCase();
      const formattedCheckName = formatPlayerName(checkPlayerName).toLowerCase();
      
      const matches = formattedPickName === formattedCheckName;
      
      
      return matches;
    });
    
    if (inCurrent) {
      return { status: 'current', label: 'In current parlay' };
    } else if (usedInActiveParlay) {
      const roundNum = usedInActiveParlay.parlay_round_num || 1;
      return { 
        status: 'used', 
        label: `Already used in Round ${roundNum}`,
        roundNum: roundNum
      };
    } else if (usedInAnyParlay) {
      const roundNum = usedInAnyParlay.parlay_round_num || 1;
      const result = { 
        status: 'available', 
        label: 'Available',
        roundNum: roundNum
      };
      
      
      return result;
    } else {
      return { status: 'available', label: 'Available' };
    }
  }

  if (finalIsLoading) {
    return (
      <div className="glass-card p-6 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <div>Loading matchups...</div>
          </div>
      </div>
    );
  }

  if (finalIsError) {
    return (
      <div className="glass-card p-6 text-center">
          <div className="text-red-500">Error: {finalError?.message}</div>
          <Button onClick={() => {
            // Implement retry logic here
          }} className="mt-4">Try Again</Button>
      </div>
    );
  }

  // This function is redundant since we already have isSupabaseMatchupRow
  // Using the existing type guard throughout the code instead

  // Filter matchups to only those with valid FanDuel odds for all players
  const filteredMatchups = (finalMatchupsData ?? []).filter(matchup => {
    if (isSupabaseMatchupRow(matchup)) {
      return (
        Number((matchup as SupabaseMatchupRow).odds1 ?? 0) > 1 &&
        Number((matchup as SupabaseMatchupRow).odds2 ?? 0) > 1 &&
        Number((matchup as SupabaseMatchupRow).odds3 ?? 0) > 1
      );
    } else if (isSupabaseMatchupRow2Ball(matchup)) {
      const m2 = matchup as SupabaseMatchupRow2Ball;
      return (
        Number(m2.odds1 ?? 0) > 1 &&
        Number(m2.odds2 ?? 0) > 1
      );
    }
    return false;
  }).sort((a, b) => {
    // Sort by tee time first for both 2ball and 3ball matchups (earliest first)
    const aTeeTime = a.tee_time ? new Date(a.tee_time).getTime() : Infinity;
    const bTeeTime = b.tee_time ? new Date(b.tee_time).getTime() : Infinity;
    
    if (aTeeTime !== bTeeTime) {
      return aTeeTime - bTeeTime;
    }
    
    // Fallback after tee time sorting: Sort by odds-based value (favorites first)
    if (isSupabaseMatchupRow(a) && isSupabaseMatchupRow(b)) {
      const aMinOdds = Math.min(
        Number((a as SupabaseMatchupRow).odds1 ?? Infinity),
        Number((a as SupabaseMatchupRow).odds2 ?? Infinity),
        Number((a as SupabaseMatchupRow).odds3 ?? Infinity)
      );
      const bMinOdds = Math.min(
        Number((b as SupabaseMatchupRow).odds1 ?? Infinity),
        Number((b as SupabaseMatchupRow).odds2 ?? Infinity),
        Number((b as SupabaseMatchupRow).odds3 ?? Infinity)
      );
      return aMinOdds - bMinOdds;
    } else if (isSupabaseMatchupRow2Ball(a) && isSupabaseMatchupRow2Ball(b)) {
      const a2 = a as SupabaseMatchupRow2Ball;
      const b2 = b as SupabaseMatchupRow2Ball;
      const aMinOdds = Math.min(Number(a2.odds1 ?? Infinity), Number(a2.odds2 ?? Infinity));
      const bMinOdds = Math.min(Number(b2.odds1 ?? Infinity), Number(b2.odds2 ?? Infinity));
      return aMinOdds - bMinOdds;
    }
    
    return 0;
  });

  // Use filteredMatchups directly since search filtering is now handled at the Dashboard level
  const searchFilteredMatchups = filteredMatchups
    
  return (
    <TooltipProvider>
      <div className="glass-card p-6 sm:p-4">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-bold">{matchupType === "3ball" ? "3-Ball" : "2-Ball"} Matchups</h2>
                {matchupType === "2ball" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    2-ball matchups are head-to-head betting markets. Players may have different tee times.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Sliders className="h-4 w-4" />
                      <span>Filter</span>
                      {oddsGapThreshold > 0 && 
                        <span className="ml-1 bg-green-500/20 text-green-400 text-xs px-1.5 py-0.5 rounded-full">
                          {oddsGapThreshold}+
                        </span>
                      }
                      {(() => {
                        // Calculate how many matchups have highlighted odds
                        if (oddsGapThreshold > 0 && (filteredMatchups ?? []).length > 0) {
                          const highlightedCount = (filteredMatchups ?? []).reduce((count, matchup) => {
                            if (isSupabaseMatchupRow(matchup)) {
                              const players = [
                                { id: 'p1', odds: (matchup as SupabaseMatchupRow).odds1 },
                                { id: 'p2', odds: (matchup as SupabaseMatchupRow).odds2 },
                                { id: 'p3', odds: (matchup as SupabaseMatchupRow).odds3 }
                              ].filter(p => p.odds && p.odds > 1);
                              
                              if (players.length >= 3) {
                                players.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = players[0];
                                const otherPlayers = players.slice(1);
                                
                                const hasGapAgainstAll = otherPlayers.every(other => 
                                  hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null)
                                );
                                
                                if (hasGapAgainstAll) count++;
                              }
                            } else if (isSupabaseMatchupRow2Ball(matchup)) {
                              const m2 = matchup as SupabaseMatchupRow2Ball;
                              const fdP1Odds = Number(m2.odds1 ?? 0);
                              const fdP2Odds = Number(m2.odds2 ?? 0);
                              
                              if (fdP1Odds > 1 && fdP2Odds > 1) {
                                if ((fdP1Odds < fdP2Odds && hasSignificantOddsGap(fdP1Odds, fdP2Odds)) || 
                                    (fdP2Odds < fdP1Odds && hasSignificantOddsGap(fdP2Odds, fdP1Odds))) {
                                  count++;
                                }
                              }
                            }
                            return count;
                          }, 0);
                          
                          if (highlightedCount > 0) {
                            return (
                              <span className="ml-1 bg-green-500/20 text-green-400 text-xs px-1.5 py-0.5 rounded-full">
                                {highlightedCount}
                              </span>
                            );
                          }
                        }
                        return null;
                      })()}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Odds Gap Filter</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="mb-4">
                        <Label htmlFor="odds-gap">
                          Highlight odds gaps of at least {oddsGapThreshold} points
                        </Label>
                        <div className="flex items-center space-x-2 mt-2">
                          <Slider 
                            id="odds-gap"
                            defaultValue={[oddsGapThreshold]} 
                            max={200} 
                            step={5}
                            onValueChange={(values) => setOddsGapThreshold(values[0])}
                            className="flex-1"
                          />
                          <Input 
                            type="number" 
                            value={oddsGapThreshold} 
                            onChange={(e) => setOddsGapThreshold(parseInt(e.target.value) || 0)}
                            className="w-16 ml-2" 
                          />
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 mt-2">
                        This will highlight golfers with significant odds gaps between bookmakers.
                        <br />Setting the value to 0 will disable highlighting.
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Check if we have any position data across all matchups */}
            {(() => {
              const hasAnyPositionDataAcrossMatchups = filteredMatchups.some(matchup => {
                if (isSupabaseMatchupRow(matchup)) {
                  const m = matchup as SupabaseMatchupRow;
                  return [m.player1_dg_id, m.player2_dg_id, m.player3_dg_id].some(id => {
                    if (!id) return false;
                    const playerStat = playerStatsMap[String(id)];
                    return playerStat && (playerStat.position || playerStat.today !== null || playerStat.total !== null);
                  });
                } else if (isSupabaseMatchupRow2Ball(matchup)) {
                  const m = matchup as SupabaseMatchupRow2Ball;
                  return [m.player1_dg_id, m.player2_dg_id].some(id => {
                    if (!id) return false;
                    const playerStat = playerStatsMap[String(id)];
                    return playerStat && (playerStat.position || playerStat.today !== null || playerStat.total !== null);
                  });
                }
                return false;
              });

              if (!hasAnyPositionDataAcrossMatchups && !loadingStats) {
                return (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-400">
                    📊 Live tournament position data not yet available. Positions will update when the tournament begins or live scoring data becomes available.
                  </div>
                );
              }
              return null;
            })()}


          </div>
          {filteredMatchups && filteredMatchups.length > 0 ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg overflow-hidden border border-gray-800">
                <Table className="w-full">
                  <TableHeader className="bg-[#1e1e23]">
                    <TableRow>
                      <TableHead className="text-white">Player</TableHead>
                      <TableHead className="text-white text-center">
                        {matchupType === "3ball" ? "Group Tee Time" : "Tee Time"}
                      </TableHead>
                      <TableHead className="text-white text-center">Position</TableHead>
                      <TableHead className="text-white text-center">FanDuel</TableHead>
                      <TableHead className="text-white text-center">DataGolf</TableHead>
                      <TableHead className="text-white w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatchups.map((matchup, matchupIndex) => {
                      if (!matchup.id) return null;

                      const players = isSupabaseMatchupRow(matchup) ? [
                        {
                          id: 'p1',
                          dg_id: matchup.player1_dg_id,
                          name: matchup.player1_name || '',
                          odds: matchup.odds1,
                          dgOdds: matchup.dg_odds1,
                          tee_time: matchup.tee_time || null
                        },
                        {
                          id: 'p2',
                          dg_id: matchup.player2_dg_id,
                          name: matchup.player2_name || '',
                          odds: matchup.odds2,
                          dgOdds: matchup.dg_odds2,
                          tee_time: matchup.tee_time || null
                        },
                        {
                          id: 'p3',
                          dg_id: matchup.player3_dg_id,
                          name: matchup.player3_name || '',
                          odds: matchup.odds3,
                          dgOdds: matchup.dg_odds3,
                          tee_time: matchup.tee_time || null
                        }
                      ].filter(p => p.dg_id !== null && p.name).sort((a, b) => {
                        // Sort by odds (lowest first, since that's the favorite)
                        const aOdds = Number(a.odds) || Infinity;
                        const bOdds = Number(b.odds) || Infinity;
                        return aOdds - bOdds;
                      }) : [
                        {
                          id: 'p1',
                          dg_id: matchup.player1_dg_id,
                          name: matchup.player1_name || '',
                          odds: matchup.odds1,
                          dgOdds: matchup.dg_odds1,
                          tee_time: isSupabaseMatchupRow2Ball(matchup) ? matchup.player1_tee_time || matchup.tee_time || null : matchup.tee_time || null
                        },
                        {
                          id: 'p2',
                          dg_id: matchup.player2_dg_id,
                          name: matchup.player2_name || '',
                          odds: matchup.odds2,
                          dgOdds: matchup.dg_odds2,
                          tee_time: isSupabaseMatchupRow2Ball(matchup) ? matchup.player2_tee_time || matchup.tee_time || null : matchup.tee_time || null
                        }
                      ].sort((a, b) => {
                        // Sort by odds (lowest first, since that's the favorite)
                        const aOdds = Number(a.odds) || Infinity;
                        const bOdds = Number(b.odds) || Infinity;
                        return aOdds - bOdds;
                      });

                      const { localTime: groupTeeTime } = formatTeeTime(matchup.tee_time || null);

                      return (
                        <React.Fragment key={matchup.id}>
                          {/* Add a group header row */}
                          <TableRow className="bg-gray-900/60">
                            <TableCell colSpan={6} className="py-2">
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-medium text-primary/80">
                                  {matchupType === "3ball" ? "3-Ball Group" : "2-Ball Match"} {matchupIndex + 1}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded bg-gray-800">
                                  Tee Time: {groupTeeTime}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {players.map((player: Player, idx: number) => {
                            const playerName = formatPlayerName(player.name);
                            const playerStatus = getPlayerStatus(playerName);
                            const positionData = formatPlayerPosition(String(player.dg_id), player.tee_time);
                            const { localTime: playerTeeTime } = formatTeeTime(player.tee_time);

                            // Check if this player has a significant odds gap (only for favorites)
                            const isOddsGapHighlight = (() => {
                              if (oddsGapThreshold <= 0 || !player.odds) return false;
                              
                              // For 3-ball: highlight if this is the favorite and has gap against all others
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                // Only highlight if this player is the favorite and has gap against all others
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null));
                              }
                              
                              // For 2-ball: highlight if this is the favorite and has gap against the other
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                
                                // Only highlight the favorite if there's a significant gap
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.odds ?? null, p2.odds ?? null);
                              }
                              
                              return false;
                            })();

                            // Check for FanDuel odds gap highlighting
                            const hasFanDuelOddsGap = (() => {
                              if (oddsGapThreshold <= 0 || !player.odds) return false;
                              
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null));
                              }
                              
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.odds ?? null, p2.odds ?? null);
                              }
                              
                              return false;
                            })();

                            // Check for DataGolf odds gap highlighting
                            const hasDataGolfOddsGap = (() => {
                              if (oddsGapThreshold <= 0 || !player.dgOdds) return false;
                              
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.dgOdds && p.dgOdds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.dgOdds || 999) - (b.dgOdds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.dgOdds ?? null, other.dgOdds ?? null));
                              }
                              
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.dgOdds && p.dgOdds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.dgOdds || 999) - (b.dgOdds || 999));
                                
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.dgOdds ?? null, p2.dgOdds ?? null);
                              }
                              
                              return false;
                            })();

                            return (
                              <TableRow 
                                key={`${matchup.id}-${player.id}`}
                                className={`
                                  ${idx === players.length - 1 ? 'border-b-8 border-b-gray-900' : 'border-b border-b-gray-800'}
                                  ${playerStatus.status === 'used' ? 'bg-yellow-50/5' : ''}
                                  ${playerStatus.status === 'current' ? 'bg-primary/5' : ''}
                                  ${isOddsGapHighlight ? 'bg-green-500/10 border-l-4 border-l-green-500' : ''}
                                  bg-gray-950/30
                                `}
                              >
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {playerSearchTerm && highlightText ? 
                                      highlightText(playerName) : 
                                      playerName
                                    }
                                    {playerStatus.roundNum && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-gray-700/50 text-gray-300 font-mono">
                                        R{playerStatus.roundNum}
                                      </span>
                                    )}
                                    {playerStatus.status !== 'available' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info 
                                            className={playerStatus.status === 'current' ? 
                                              'text-blue-400/70' : 
                                              'text-yellow-400/70'
                                            } 
                                            size={14} 
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {playerStatus.label}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">{playerTeeTime}</TableCell>
                                <TableCell className="text-center">
                                  <div>{positionData.position}</div>
                                  <div className="text-xs text-muted-foreground">{positionData.score}</div>
                                </TableCell>
                                <TableCell className={`text-center ${hasFanDuelOddsGap ? 'bg-green-500/20 text-green-300 font-semibold' : ''}`}>
                                  {formatOdds(player.odds ?? null)}
                                </TableCell>
                                <TableCell className={`text-center ${hasDataGolfOddsGap ? 'bg-green-500/20 text-green-300 font-semibold' : ''}`}>
                                  {formatOdds(player.dgOdds ?? null)}
                                </TableCell>
                                <TableCell>
                                  {playerStatus.status === 'current' ? (
                                    <Button 
                                      size="icon" 
                                      variant="secondary" 
                                      className="h-6 w-6 p-0" 
                                      onClick={() => {
                                        if (typeof player.dg_id !== 'number') return;
                                        removeSelection(`${player.dg_id}-${matchup.id}`);
                                      }}
                                    >
                                      <CheckCircle className="text-green-400" size={16} />
                                    </Button>
                                  ) : playerStatus.status === 'used' ? (
                                    <Button size="icon" variant="secondary" disabled className="h-6 w-6 p-0">
                                      <CheckCircle className="text-yellow-400/70" size={16} />
                                    </Button>
                                  ) : (
                                    <Button 
                                      size="icon" 
                                      variant="outline" 
                                      className="h-6 w-6 p-0 group group-hover:text-white" 
                                      onClick={() => {
                                        if (typeof player.dg_id !== 'number') return;
                                        addSelection({
                                          id: `${player.dg_id}-${matchup.id}`,
                                          matchupType,
                                          group: `Event ${eventId || 'Unknown'}`,
                                          player: playerName,
                                          odds: Number(player.odds) || 0,
                                          matchupId: matchup.id,
                                          eventName: matchup.event_name || '',
                                          roundNum: matchup.round_num || 0,
                                          valueRating: 7.5,
                                          confidenceScore: 75
                                        });
                                      }}
                                    >
                                      <PlusCircle className="text-primary group-hover:text-white" size={16} />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-8">
                {filteredMatchups.map((matchup, matchupIndex) => {
                  if (!matchup.id) return null;

                  const players = isSupabaseMatchupRow(matchup) ? [
                    {
                      id: 'p1',
                      dg_id: matchup.player1_dg_id,
                      name: matchup.player1_name || '',
                      odds: matchup.odds1,
                      dgOdds: matchup.dg_odds1,
                      tee_time: matchup.tee_time || null
                    },
                    {
                      id: 'p2',
                      dg_id: matchup.player2_dg_id,
                      name: matchup.player2_name || '',
                      odds: matchup.odds2,
                      dgOdds: matchup.dg_odds2,
                      tee_time: matchup.tee_time || null
                    },
                    {
                      id: 'p3',
                      dg_id: matchup.player3_dg_id,
                      name: matchup.player3_name || '',
                      odds: matchup.odds3,
                      dgOdds: matchup.dg_odds3,
                      tee_time: matchup.tee_time || null
                    }
                  ].filter(p => p.dg_id !== null && p.name).sort((a, b) => {
                    // Sort by odds (lowest first, since that's the favorite)
                    const aOdds = Number(a.odds) || Infinity;
                    const bOdds = Number(b.odds) || Infinity;
                    return aOdds - bOdds;
                  }) : [
                    {
                      id: 'p1',
                      dg_id: matchup.player1_dg_id,
                      name: matchup.player1_name || '',
                      odds: matchup.odds1,
                      dgOdds: matchup.dg_odds1,
                      tee_time: isSupabaseMatchupRow2Ball(matchup) ? matchup.player1_tee_time || matchup.tee_time || null : matchup.tee_time || null
                    },
                    {
                      id: 'p2',
                      dg_id: matchup.player2_dg_id,
                      name: matchup.player2_name || '',
                      odds: matchup.odds2,
                      dgOdds: matchup.dg_odds2,
                      tee_time: isSupabaseMatchupRow2Ball(matchup) ? matchup.player2_tee_time || matchup.tee_time || null : matchup.tee_time || null
                    }
                  ].sort((a, b) => {
                    // Sort by odds (lowest first, since that's the favorite)
                    const aOdds = Number(a.odds) || Infinity;
                    const bOdds = Number(b.odds) || Infinity;
                    return aOdds - bOdds;
                  });

                  // Get the group tee time (for 3-ball) or earliest tee time (for 2-ball)
                  const groupTeeTime = isSupabaseMatchupRow(matchup) 
                    ? formatTeeTime(matchup.tee_time || null).localTime
                    : formatTeeTime(
                        players.reduce((earliest, p) => {
                          const teetime = p.tee_time || null;
                          if (!earliest) return teetime;
                          if (!teetime) return earliest;
                          return new Date(teetime) < new Date(earliest) ? teetime : earliest;
                        }, null as string | null)
                      ).localTime;

                  return (
                    <div key={matchup.id} className="space-y-2">
                      <div className="px-2">
                        <span className="text-sm font-medium text-primary/80">
                          {matchupType === "3ball" ? "3-Ball Group" : "2-Ball Match"} {matchupIndex + 1}
                        </span>
                      </div>
                      <div className="glass-card overflow-hidden">
                        {/* Add tee time header */}
                        <div className="bg-[#1e1e23] px-4 py-3 flex justify-between items-center border-b-2 border-b-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Tee Time</span>
                            <span className="text-sm px-2 py-0.5 rounded bg-gray-800/80 text-primary/80">
                              {groupTeeTime}
                            </span>
                          </div>
                        </div>
                        <div className="p-0 divide-y-2 divide-gray-800/50">
                          {players.map((player: Player, idx: number) => {
                            const playerName = formatPlayerName(player.name);
                            const playerStatus = getPlayerStatus(playerName);
                            const positionData = formatPlayerPosition(String(player.dg_id), player.tee_time);
                            const { localTime: playerTeeTime } = formatTeeTime(player.tee_time);

                            // Check if this player has a significant odds gap (only for favorites)
                            const isOddsGapHighlight = (() => {
                              if (oddsGapThreshold <= 0 || !player.odds) return false;
                              
                              // For 3-ball: highlight if this is the favorite and has gap against all others
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                // Only highlight if this player is the favorite and has gap against all others
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null));
                              }
                              
                              // For 2-ball: highlight if this is the favorite and has gap against the other
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                
                                // Only highlight the favorite if there's a significant gap
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.odds ?? null, p2.odds ?? null);
                              }
                              
                              return false;
                            })();

                            // Check for FanDuel odds gap highlighting
                            const hasFanDuelOddsGap = (() => {
                              if (oddsGapThreshold <= 0 || !player.odds) return false;
                              
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null));
                              }
                              
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.odds && p.odds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.odds ?? null, p2.odds ?? null);
                              }
                              
                              return false;
                            })();

                            // Check for DataGolf odds gap highlighting
                            const hasDataGolfOddsGap = (() => {
                              if (oddsGapThreshold <= 0 || !player.dgOdds) return false;
                              
                              if (matchupType === "3ball") {
                                const allPlayers = players.filter(p => p.dgOdds && p.dgOdds > 1);
                                if (allPlayers.length < 2) return false;
                                const sortedByOdds = allPlayers.sort((a, b) => (a.dgOdds || 999) - (b.dgOdds || 999));
                                const favorite = sortedByOdds[0];
                                const others = sortedByOdds.slice(1);
                                
                                return player.dg_id === favorite.dg_id && 
                                       others.every(other => hasSignificantOddsGap(favorite.dgOdds ?? null, other.dgOdds ?? null));
                              }
                              
                              if (matchupType === "2ball") {
                                const validPlayers = players.filter(p => p.dgOdds && p.dgOdds > 1);
                                if (validPlayers.length !== 2) return false;
                                const [p1, p2] = validPlayers.sort((a, b) => (a.dgOdds || 999) - (b.dgOdds || 999));
                                
                                return player.dg_id === p1.dg_id && hasSignificantOddsGap(p1.dgOdds ?? null, p2.dgOdds ?? null);
                              }
                              
                              return false;
                            })();

                            return (
                              <div 
                                key={`${matchup.id}-${player.id}`}
                                className={`
                                  ${idx === players.length - 1 ? 'border-b-8 border-b-gray-900' : 'border-b border-b-gray-800'}
                                  ${playerStatus.status === 'used' ? 'bg-yellow-50/5' : ''}
                                  ${playerStatus.status === 'current' ? 'bg-primary/5' : ''}
                                  ${isOddsGapHighlight ? 'bg-green-500/10 border-l-4 border-l-green-500' : ''}
                                  bg-gray-950/30 p-4
                                `}
                              >
                                {/* Player Name and Status */}
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-2 px-2">
                                    <span className="font-medium">
                                      {playerSearchTerm && highlightText ? 
                                        highlightText(playerName) : 
                                        playerName
                                      }
                                    </span>
                                    {playerStatus.roundNum && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-gray-700/50 text-gray-300 font-mono">
                                        R{playerStatus.roundNum}
                                      </span>
                                    )}
                                    {playerStatus.status !== 'available' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info 
                                            className={playerStatus.status === 'current' ? 
                                              'text-blue-400/70' : 
                                              'text-yellow-400/70'
                                            } 
                                            size={14} 
                                          />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {playerStatus.label}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                  {playerStatus.status === 'current' ? (
                                    <Button 
                                      size="icon" 
                                      variant="secondary" 
                                      className="h-8 w-8" 
                                      onClick={() => {
                                        if (typeof player.dg_id !== 'number') return;
                                        removeSelection(`${player.dg_id}-${matchup.id}`);
                                      }}
                                    >
                                      <CheckCircle className="text-green-400" size={16} />
                                    </Button>
                                  ) : playerStatus.status === 'used' ? (
                                    <Button size="icon" variant="secondary" disabled className="h-8 w-8">
                                      <CheckCircle className="text-yellow-400/70" size={16} />
                                    </Button>
                                  ) : (
                                    <Button 
                                      size="icon" 
                                      variant="outline" 
                                      className="h-8 w-8 group group-hover:text-white" 
                                      onClick={() => {
                                        if (typeof player.dg_id !== 'number') return;
                                        addSelection({
                                          id: `${player.dg_id}-${matchup.id}`,
                                          matchupType,
                                          group: `Event ${eventId || 'Unknown'}`,
                                          player: playerName,
                                          odds: Number(player.odds) || 0,
                                          matchupId: matchup.id,
                                          eventName: matchup.event_name || '',
                                          roundNum: matchup.round_num || 0,
                                          valueRating: 7.5,
                                          confidenceScore: 75
                                        });
                                      }}
                                    >
                                      <PlusCircle className="text-primary group-hover:text-white" size={16} />
                                    </Button>
                                  )}
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4 text-sm px-2">
                                  <div>
                                    <div className="text-muted-foreground text-xs mb-1">Position</div>
                                    <div className="font-medium">{positionData.position}</div>
                                    <div className="text-xs text-muted-foreground">{positionData.score}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground text-xs mb-1">Odds</div>
                                    <div className={`font-medium ${hasFanDuelOddsGap ? 'text-green-300 font-semibold' : ''}`}>
                                      {formatOdds(player.odds ?? null)}
                                    </div>
                                    <div className={`text-xs ${hasDataGolfOddsGap ? 'text-green-300 font-semibold' : 'text-muted-foreground'}`}>
                                      DG: {formatOdds(player.dgOdds ?? null)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-400">No {matchupType === "3ball" ? "3-ball" : "2-ball"} matchups found for the selected event.</p>
            </div>
          )}
      </div>
    </TooltipProvider>
  );
}
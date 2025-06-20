"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
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
  const formatGolfScore = (scoreValue: number): string => {
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
  
  // Flatten all picks from active parlays only
  const allParlayPicks = activeParlays.flatMap((parlay: any) => parlay.picks || []);
  
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
    const inSubmitted = allParlayPicks.some((pick: any) => {
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
    } else if (inSubmitted) {
      return { status: 'used', label: 'Already used in a parlay' };
    } else {
      return { status: 'available', label: 'Available' };
    }
  }

  if (finalIsLoading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <div>Loading matchups...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (finalIsError) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <div className="text-red-500">Error: {finalError?.message}</div>
          <Button onClick={() => {
            // Implement retry logic here
          }} className="mt-4">Try Again</Button>
        </CardContent>
      </Card>
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
    const aTeeTime = a.teetime ? new Date(a.teetime).getTime() : Infinity;
    const bTeeTime = b.teetime ? new Date(b.teetime).getTime() : Infinity;
    
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
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{matchupType === "3ball" ? "3-Ball" : "2-Ball"} Matchups</h2>
                {matchupType === "2ball" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    2-ball matchups are head-to-head betting markets. Players may have different tee times.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <Sliders className="h-4 w-4" />
                      <span>Filter</span>
                      {oddsGapThreshold > 0 && 
                        <span className="ml-1 bg-green-700 text-green-100 text-xs px-1.5 py-0.5 rounded-full">
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
                              <span className="ml-1 bg-green-900 text-green-100 text-xs px-1.5 py-0.5 rounded-full">
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
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <Table>
                <TableHeader className="bg-[#1e1e23]">
                  <TableRow>
                    <TableHead className="text-white text-center">Players</TableHead>
                    <TableHead className="text-white text-center">
                      {matchupType === "3ball" ? "Group Tee Time" : "Individual Tee Times"}
                    </TableHead>
                    <TableHead className="text-white text-center">Position</TableHead>
                    <TableHead className="text-white text-center">FanDuel Odds</TableHead>
                    <TableHead className="text-white text-center">Data Golf Odds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatchups.map((matchup) => {
                    if (!matchup.uuid) return null; // Strict: only render if uuid exists
                    if (isSupabaseMatchupRow(matchup)) {
                      // DataGolf odds are only available in the SupabaseMatchupRow type
                      const dg_p1_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds1 ?? null : null;
                      const dg_p2_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds2 ?? null : null;
                      const dg_p3_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds3 ?? null : null;
                      
                      // Check both for divergence and significant odds gaps
                      // We're inside the isSupabaseMatchupRow branch so these props exist
                      const divergence = detect3BallDivergence({
                        odds: {
                          fanduel: {
                            p1: (matchup as SupabaseMatchupRow).odds1,
                            p2: (matchup as SupabaseMatchupRow).odds2,
                            p3: (matchup as SupabaseMatchupRow).odds3,
                          },
                          datagolf: {
                            p1: dg_p1_odds,
                            p2: dg_p2_odds,
                            p3: dg_p3_odds,
                          },
                        },
                      });
                      
                      // Initialize gap flags for both FanDuel and DataGolf
                      let p1HasFDGap = false;
                      let p2HasFDGap = false;
                      let p3HasFDGap = false;
                      let p1HasDGGap = false;
                      let p2HasDGGap = false;
                      let p3HasDGGap = false;
                      
                      // Track the favorite players for tooltips
                      let favoriteFDPlayer = null;
                      let favoriteDGPlayer = null;
                      let gapFDDetails = "";
                      let gapDGDetails = "";
                      
                      // For odds arrays - we're already inside isSupabaseMatchupRow guard branch
                      const fdPlayers = [
                        { id: 'p1', odds: (matchup as SupabaseMatchupRow).odds1, name: (matchup as SupabaseMatchupRow).player1_name },
                        { id: 'p2', odds: (matchup as SupabaseMatchupRow).odds2, name: (matchup as SupabaseMatchupRow).player2_name },
                        { id: 'p3', odds: (matchup as SupabaseMatchupRow).odds3, name: (matchup as SupabaseMatchupRow).player3_name ?? '' }
                      ].filter(p => p.odds && p.odds > 1);
                      
                      // Only highlight if we have at least 3 valid odds to compare
                      if (fdPlayers.length >= 3) {
                        // Sort by odds (lowest decimal odds = favorite)
                        fdPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                        
                        // Get the favorite player
                        const favorite = fdPlayers[0];
                        // Get the other two players
                        const otherPlayers = fdPlayers.slice(1);
                        
                        // Calculate the actual gaps
                        const gaps = otherPlayers.map(other => {
                          const gap = Math.abs(
                            parseInt(decimalToAmerican(favorite.odds || 0)) - 
                            parseInt(decimalToAmerican(other.odds || 0))
                          );
                          return { player: other, gap };
                        });
                        
                        // Check if the favorite has significant gaps against BOTH other players
                        const hasGapAgainstAll = gaps.every(({gap}) => gap >= oddsGapThreshold);
                        
                        // Only highlight the favorite if they have significant gaps against both others
                        if (hasGapAgainstAll) {
                          // Set the flag for the favorite in FanDuel column
                          if (favorite.id === 'p1') p1HasFDGap = true;
                          else if (favorite.id === 'p2') p2HasFDGap = true;
                          else if (favorite.id === 'p3') p3HasFDGap = true;
                          
                          // Store favorite for tooltip
                          favoriteFDPlayer = favorite;
                          
                          // Create gap details for tooltip
                          gapFDDetails = gaps.map(({player, gap}) => 
                            `${formatPlayerName(player.name)}: ${gap} points`
                          ).join(", ");
                        }
                      }
                      
                      // Calculate DataGolf gaps
                      const dgPlayers = [
                        { id: 'p1', odds: dg_p1_odds, name: (matchup as SupabaseMatchupRow).player1_name ?? '' },
                        { id: 'p2', odds: dg_p2_odds, name: (matchup as SupabaseMatchupRow).player2_name ?? '' },
                        { id: 'p3', odds: dg_p3_odds, name: (matchup as SupabaseMatchupRow).player3_name ?? '' }
                      ].filter(p => p.odds && p.odds > 1);
                      
                      // Only highlight if we have at least 3 valid odds to compare
                      if (dgPlayers.length >= 3) {
                        // Sort by odds (lowest decimal odds = favorite)
                        dgPlayers.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                        
                        // Get the favorite player
                        const favorite = dgPlayers[0];
                        // Get the other two players
                        const otherPlayers = dgPlayers.slice(1);
                        
                        // Calculate the actual gaps
                        const gaps = otherPlayers.map(other => {
                          const gap = Math.abs(
                            parseInt(decimalToAmerican(favorite.odds || 0)) - 
                            parseInt(decimalToAmerican(other.odds || 0))
                          );
                          return { player: other, gap };
                        });
                        
                        // Check if the favorite has significant gaps against BOTH other players
                        const hasGapAgainstAll = gaps.every(({gap}) => gap >= oddsGapThreshold);
                        
                        // Only highlight the favorite if they have significant gaps against both others
                        if (hasGapAgainstAll) {
                          // Set the flag for the favorite in DataGolf column
                          if (favorite.id === 'p1') p1HasDGGap = true;
                          else if (favorite.id === 'p2') p2HasDGGap = true;
                          else if (favorite.id === 'p3') p3HasDGGap = true;
                          
                          // Store favorite for tooltip
                          favoriteDGPlayer = favorite;
                          
                          // Create gap details for tooltip
                          gapDGDetails = gaps.map(({player, gap}) => 
                            `${formatPlayerName(player.name)}: ${gap} points`
                          ).join(", ");
                        }
                      }
                      
                      // For 3-ball matchups
                      const sortedPlayers = [
                        {
                          id: 'p1',
                          dg_id: (matchup as SupabaseMatchupRow).player1_dg_id,
                          odds: (matchup as SupabaseMatchupRow).odds1,
                          name: (matchup as SupabaseMatchupRow).player1_name,
                          dgOdds: dg_p1_odds,
                          hasGap: p1HasFDGap,
                          hasDGGap: p1HasDGGap,
                          dgFavorite: divergence?.datagolfFavorite === 'p1',
                        },
                        {
                          id: 'p2',
                          dg_id: (matchup as SupabaseMatchupRow).player2_dg_id,
                          odds: (matchup as SupabaseMatchupRow).odds2,
                          name: (matchup as SupabaseMatchupRow).player2_name,
                          dgOdds: dg_p2_odds,
                          hasGap: p2HasFDGap,
                          hasDGGap: p2HasDGGap,
                          dgFavorite: divergence?.datagolfFavorite === 'p2',
                        },
                        {
                          id: 'p3',
                          dg_id: (matchup as SupabaseMatchupRow).player3_dg_id ?? undefined,
                          odds: (matchup as SupabaseMatchupRow).odds3,
                          name: (matchup as SupabaseMatchupRow).player3_name ?? '',
                          dgOdds: dg_p3_odds,
                          hasGap: p3HasFDGap,
                          hasDGGap: p3HasDGGap,
                          dgFavorite: divergence?.datagolfFavorite === 'p3',
                        },
                      ].filter(p => p.dg_id !== null && p.dg_id !== undefined)
                       .sort((a, b) => {
                          if (!a.odds || a.odds <= 1) return 1;
                          if (!b.odds || b.odds <= 1) return -1;
                          return (a.odds || 0) - (b.odds || 0);
                        });

                      // Format the player's tournament position and score
                      const formatPlayerPosition = (playerId: string | number, teeTime?: string | null) => {
                        const playerStat = playerStatsMap[String(playerId)];
                        
                        if (!playerStat) {
                          return { position: '-', score: '-' };
                        }
                        
                        // Position should be leaderboard position (T5, 1, etc.)
                        const position = playerStat.position || '-';
                        
                        // Score should be from the last completed round
                        let score: string = '-';
                        
                        // Check if we have round-specific data available
                        if (playerStat.round_scores) {
                          const roundScores = playerStat.round_scores;
                          
                          // Get the most recent available round score (prioritize R1 since we're showing Round 1)
                          let roundScore: number | null = null;
                          if (roundScores.R1 !== null && roundScores.R1 !== undefined) {
                            roundScore = roundScores.R1;
                          } else if (roundScores.R2 !== null && roundScores.R2 !== undefined) {
                            roundScore = roundScores.R2;
                          } else if (roundScores.R3 !== null && roundScores.R3 !== undefined) {
                            roundScore = roundScores.R3;
                          } else if (roundScores.R4 !== null && roundScores.R4 !== undefined) {
                            roundScore = roundScores.R4;
                          }
                          
                          // Format the round score
                          if (roundScore !== null && typeof roundScore === 'number') {
                            // This is a raw score (like 66, 68, etc.) - display as-is
                            score = roundScore.toString();
                          }
                        }
                        
                        // Fallback to today's score if round data isn't available
                        if (score === '-') {
                          const scoreValue = playerStat.today ?? playerStat.total;
                          
                          if (typeof scoreValue === 'number') {
                            score = formatGolfScore(scoreValue);
                          }
                        }
                        
                        return { position, score };
                      };
                      
                      // Check if we have any valid position data for this matchup
                      const hasAnyPositionData = sortedPlayers.some(player => {
                        if (!player.dg_id) return false;
                        const playerStat = playerStatsMap[String(player.dg_id)];
                        return playerStat && (playerStat.position || playerStat.today !== null || playerStat.total !== null);
                      });

                      // Check for matchup-level conflicts (multiple picks from same group)
                      const playersInThisMatchup = sortedPlayers.filter(player => {
                        return isPlayerInAnyParlay(formatPlayerName(player.name));
                      });
                      
                      const hasMultiplePicksInGroup = playersInThisMatchup.length > 1;
                      const hasConflictInGroup = playersInThisMatchup.some(player => {
                        const playerStatus = getPlayerStatus(formatPlayerName(player.name));
                        return playerStatus.status === 'used'; // Has picks in submitted parlays
                      });

                      return (
                        <TableRow 
                          key={`3ball-${matchup.uuid}`}
                          className={`
                            ${hasMultiplePicksInGroup ? 'bg-yellow-50/5 border-yellow-200/10' : ''}
                            ${hasConflictInGroup ? 'bg-yellow-50/5 border-yellow-200/10' : ''}
                          `}
                        >
                          <TableCell>
                            {hasMultiplePicksInGroup && (
                              <div className="mb-2 p-2 bg-yellow-50/5 border border-yellow-200/20 rounded text-xs text-yellow-500/80 flex items-center gap-1">
                                <AlertTriangle size={12} />
                                Multiple picks in this group
                              </div>
                            )}
                            {sortedPlayers.map((player, idx) => {
                              const playerStatus = getPlayerStatus(formatPlayerName(player.name));
                              
                              return (
                                <div 
                                  key={`player-${idx}`} 
                                  className={`
                                    py-1 h-8 flex items-center rounded px-1 transition-colors
                                    ${playerStatus.status === 'used' ? 'bg-yellow-50/10 border border-yellow-200/20' : ''}
                                    ${playerStatus.status === 'current' ? 'bg-primary/5 border border-primary/20' : ''}
                                  `}
                                >
                                  <span className="mr-2 flex items-center gap-1">
                                    {playerStatus.status === 'current' ? (
                                      <Button 
                                        size="icon" 
                                        variant="secondary" 
                                        className="h-6 w-6 p-0" 
                                        onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          // Remove from current parlay
                                          removeSelection(String(player.dg_id));
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
                                        className="h-6 w-6 p-0" 
                                        onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          
                                          // Check if user is already picking someone else from this group
                                          const otherPlayersInGroup = sortedPlayers.filter(p => 
                                            p.dg_id !== player.dg_id && isPlayerInAnyParlay(formatPlayerName(p.name))
                                          );
                                          
                                          if (otherPlayersInGroup.length > 0) {
                                            const otherPlayerNames = otherPlayersInGroup.map(p => formatPlayerName(p.name)).join(', ');
                                            toast({
                                              title: "Warning: Conflicting Pick",
                                              description: `You already have ${otherPlayerNames} from this group in your parlays. Adding ${formatPlayerName(player.name)} means you're betting against yourself.`,
                                              duration: 5000,
                                              variant: "destructive"
                                            });
                                          }
                                          
                                          addSelection({
                                            id: String(player.dg_id),
                                            matchupType,
                                            group: `Event ${eventId || 'Unknown'}`,
                                            player: formatPlayerName(player.name),
                                            odds: Number(player.odds) || 0,
                                            matchupId: matchup.uuid,
                                            eventName: matchup.event_name || '',
                                            roundNum: matchup.round_num || 0,
                                            valueRating: 7.5,
                                            confidenceScore: 75
                                          });
                                        }}
                                      >
                                        <PlusCircle className="text-primary" size={16} />
                                      </Button>
                                    )}
                                    {playerStatus.status !== 'available' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className={playerStatus.status === 'current' ? 'text-blue-400/70' : 'text-yellow-400/70'} size={14} />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {playerStatus.label}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </span>
                                  <span className={`
                                    ${playerStatus.status === 'used' ? 'text-yellow-600/70 font-medium' : ''}
                                    ${playerStatus.status === 'current' ? 'text-blue-600/70 font-medium' : ''}
                                  `}>
                                    {playerSearchTerm && highlightText ? highlightText(player.name) : formatPlayerName(player.name)}
                                  </span>
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          {/* Tee Time column */}
                          <TableCell className="text-center">
                            {(() => {
                              const { localTime, easternDiff } = formatTeeTime(matchup.teetime ?? null);
                              return (
                                <div className="text-center">
                                  <div className="text-xs font-medium">{localTime}</div>
                                  {easternDiff && <div className="text-xs text-muted-foreground">{easternDiff}</div>}
                                </div>
                              );
                            })()}
                          </TableCell>
                          
                          {/* Position column */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              let playerId = '';
                              
                              if (isSupabaseMatchupRow(matchup)) {
                                if (player.id === 'p1') {
                                  playerId = String((matchup as SupabaseMatchupRow).player1_dg_id);
                                } else if (player.id === 'p2') {
                                  playerId = String((matchup as SupabaseMatchupRow).player2_dg_id);
                                } else if (player.id === 'p3' && (matchup as SupabaseMatchupRow).player3_dg_id != null) {
                                  playerId = String((matchup as SupabaseMatchupRow).player3_dg_id);
                                }
                              }
                              
                              const positionData = formatPlayerPosition(String(playerId), matchup.teetime);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-xs font-medium">{positionData.position}</div>
                                    <div className="text-xs text-muted-foreground">{positionData.score}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {(sortedPlayers.filter((player: typeof sortedPlayers[number]) => player.odds && player.odds > 1) as typeof sortedPlayers).map((player: typeof sortedPlayers[number], idx: number) => {
                              const formatted = formatOdds(player.odds ?? 0);
                              return (
                                <div key={`odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasGap ? "font-bold text-green-400" : ""}`}>{formatted}</div>
                              );
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            {(sortedPlayers.filter((player: typeof sortedPlayers[number]) => player.dgOdds && player.dgOdds > 1) as typeof sortedPlayers).map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`dg-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDGGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dgOdds ?? 0)}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    } else if (isSupabaseMatchupRow2Ball(matchup)) {
                      const m2 = matchup as SupabaseMatchupRow2Ball;
                      const fdP1Odds = Number(m2.odds1 ?? 0);
                      const fdP2Odds = Number(m2.odds2 ?? 0);
                      const dgP1Odds = Number(m2.dg_odds1 ?? 0);
                      const dgP2Odds = Number(m2.dg_odds2 ?? 0);

                      // Check if at least one player has odds from FanDuel
                      const hasAnyValidOdds = (fdP1Odds > 1) || (fdP2Odds > 1);
                      if (!hasAnyValidOdds) {
                        return null; // Skip this matchup
                      }
                      
                      // Initialize gap flags for both FanDuel and DataGolf
                      let p1HasFDGap = false;
                      let p2HasFDGap = false;
                      let p1HasDGGap = false;
                      let p2HasDGGap = false;
                      
                      // Check for FanDuel gaps
                      // Check if player 1 is the favorite with a significant gap in FanDuel
                      if (fdP1Odds > 1 && fdP2Odds > 1 && fdP1Odds < fdP2Odds) {
                        // Convert odds to American and calculate the gap
                        const americanP1 = parseInt(decimalToAmerican(fdP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(fdP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p1HasFDGap = true;
                        }
                      }
                      // Check if player 2 is the favorite with a significant gap in FanDuel
                      if (fdP1Odds > 1 && fdP2Odds > 1 && fdP2Odds < fdP1Odds) {
                        const americanP1 = parseInt(decimalToAmerican(fdP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(fdP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p2HasFDGap = true;
                        }
                      }
                      // Check for DataGolf gaps
                      if (dgP1Odds > 1 && dgP2Odds > 1 && dgP1Odds < dgP2Odds) {
                        const americanP1 = parseInt(decimalToAmerican(dgP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dgP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p1HasDGGap = true;
                        }
                      }
                      if (dgP1Odds > 1 && dgP2Odds > 1 && dgP2Odds < dgP1Odds) {
                        const americanP1 = parseInt(decimalToAmerican(dgP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dgP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p2HasDGGap = true;
                        }
                      }
                      
                      // For 2-ball matchups (inside isSupabaseMatchupRow2Ball branch)
                      const sortedPlayers = [
                        {
                          id: 'p1',
                          dg_id: m2.player1_dg_id,
                          odds: m2.odds1,
                          name: m2.player1_name,
                          dgOdds: dgP1Odds,
                          hasGap: p1HasFDGap,
                          hasDGGap: p1HasDGGap,
                        },
                        {
                          id: 'p2',
                          dg_id: m2.player2_dg_id,
                          odds: m2.odds2,
                          name: m2.player2_name,
                          dgOdds: dgP2Odds,
                          hasGap: p2HasFDGap,
                          hasDGGap: p2HasDGGap,
                        },
                      ].filter(p => p.dg_id !== null && p.dg_id !== undefined)
                       .sort((a, b) => {
                          if (!a.odds || a.odds <= 1) return 1;
                          if (!b.odds || b.odds <= 1) return -1;
                          return (a.odds || 0) - (b.odds || 0);
                        });

                      // Format the player's tournament position and score
                      const formatPlayerPosition = (playerId: string | number, teeTime?: string | null) => {
                        const playerStat = playerStatsMap[String(playerId)];
                        
                        if (!playerStat) {
                          return { position: '-', score: '-' };
                        }
                        
                        // Position should be leaderboard position (T5, 1, etc.)
                        const position = playerStat.position || '-';
                        
                        // Score should be from the last completed round
                        let score: string = '-';
                        
                        // Check if we have round-specific data available
                        if (playerStat.round_scores) {
                          const roundScores = playerStat.round_scores;
                          
                          // Get the most recent available round score (prioritize R1 since we're showing Round 1)
                          let roundScore: number | null = null;
                          if (roundScores.R1 !== null && roundScores.R1 !== undefined) {
                            roundScore = roundScores.R1;
                          } else if (roundScores.R2 !== null && roundScores.R2 !== undefined) {
                            roundScore = roundScores.R2;
                          } else if (roundScores.R3 !== null && roundScores.R3 !== undefined) {
                            roundScore = roundScores.R3;
                          } else if (roundScores.R4 !== null && roundScores.R4 !== undefined) {
                            roundScore = roundScores.R4;
                          }
                          
                          // Format the round score
                          if (roundScore !== null && typeof roundScore === 'number') {
                            // This is a raw score (like 66, 68, etc.) - display as-is
                            score = roundScore.toString();
                          }
                        }
                        
                        // Fallback to today's score if round data isn't available
                        if (score === '-') {
                          const scoreValue = playerStat.today ?? playerStat.total;
                          
                          if (typeof scoreValue === 'number') {
                            score = formatGolfScore(scoreValue);
                          }
                        }
                        
                        return { position, score };
                      };
                      
                      // Check if we have any valid position data for this matchup
                      const hasAnyPositionData = sortedPlayers.some(player => {
                        if (!player.dg_id) return false;
                        const playerStat = playerStatsMap[String(player.dg_id)];
                        return playerStat && (playerStat.position || playerStat.today !== null || playerStat.total !== null);
                      });

                      // Check for matchup-level conflicts (multiple picks from same group)
                      const playersInThisMatchup = sortedPlayers.filter(player => {
                        return isPlayerInAnyParlay(formatPlayerName(player.name));
                      });
                      
                      const hasMultiplePicksInGroup = playersInThisMatchup.length > 1;
                      const hasConflictInGroup = playersInThisMatchup.some(player => {
                        const playerStatus = getPlayerStatus(formatPlayerName(player.name));
                        return playerStatus.status === 'used'; // Has picks in submitted parlays
                      });

                      return (
                        <TableRow 
                          key={`2ball-${m2.uuid}`}
                          className={`
                            ${hasMultiplePicksInGroup ? 'bg-yellow-50/5 border-yellow-200/10' : ''}
                            ${hasConflictInGroup ? 'bg-yellow-50/5 border-yellow-200/10' : ''}
                          `}
                        >
                          <TableCell>
                            {hasMultiplePicksInGroup && (
                              <div className="mb-2 p-2 bg-yellow-50/5 border border-yellow-200/20 rounded text-xs text-yellow-500/80 flex items-center gap-1">
                                <AlertTriangle size={12} />
                                Multiple picks in this group
                              </div>
                            )}
                            {sortedPlayers.map((player, idx) => {
                              const playerStatus = getPlayerStatus(formatPlayerName(player.name));
                              
                              return (
                                <div 
                                  key={`player-${idx}`} 
                                  className={`
                                    py-1 h-8 flex items-center rounded px-1 transition-colors
                                    ${playerStatus.status === 'used' ? 'bg-yellow-50/10 border border-yellow-200/20' : ''}
                                    ${playerStatus.status === 'current' ? 'bg-primary/5 border border-primary/20' : ''}
                                  `}
                                >
                                  <span className="mr-2 flex items-center gap-1">
                                    {playerStatus.status === 'current' ? (
                                      <Button 
                                        size="icon" 
                                        variant="secondary" 
                                        className="h-6 w-6 p-0" 
                                        onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          // Remove from current parlay
                                          removeSelection(String(player.dg_id));
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
                                        className="h-6 w-6 p-0" 
                                        onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          
                                          // Check if user is already picking someone else from this group
                                          const otherPlayersInGroup = sortedPlayers.filter(p => 
                                            p.dg_id !== player.dg_id && isPlayerInAnyParlay(formatPlayerName(p.name))
                                          );
                                          
                                          if (otherPlayersInGroup.length > 0) {
                                            const otherPlayerNames = otherPlayersInGroup.map(p => formatPlayerName(p.name)).join(', ');
                                            toast({
                                              title: "Warning: Conflicting Pick",
                                              description: `You already have ${otherPlayerNames} from this group in your parlays. Adding ${formatPlayerName(player.name)} means you're betting against yourself.`,
                                              duration: 5000,
                                              variant: "destructive"
                                            });
                                          }
                                          
                                          addSelection({
                                            id: String(player.dg_id),
                                            matchupType,
                                            group: `Event ${eventId || 'Unknown'}`,
                                            player: formatPlayerName(player.name),
                                            odds: Number(player.odds) || 0,
                                            matchupId: m2.uuid,
                                            eventName: m2.event_name || '',
                                            roundNum: m2.round_num || 0,
                                            valueRating: 7.5,
                                            confidenceScore: 75
                                          });
                                        }}
                                      >
                                        <PlusCircle className="text-primary" size={16} />
                                      </Button>
                                    )}
                                    {playerStatus.status !== 'available' && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Info className={playerStatus.status === 'current' ? 'text-blue-400/70' : 'text-yellow-400/70'} size={14} />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          {playerStatus.label}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}
                                  </span>
                                  <span className={`
                                    ${playerStatus.status === 'used' ? 'text-yellow-600/70 font-medium' : ''}
                                    ${playerStatus.status === 'current' ? 'text-blue-600/70 font-medium' : ''}
                                  `}>
                                    {playerSearchTerm && highlightText ? highlightText(player.name) : formatPlayerName(player.name)}
                                  </span>
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          {/* Tee Time column for 2-ball */}
                          <TableCell className="text-center">
                            {(() => {
                              const { localTime: teeTimeLocal, easternDiff: teeTimeDiff } = formatTeeTime(m2.teetime ?? null);
                              return (
                                <div className="text-center">
                                  <div className="text-xs font-medium">{teeTimeLocal}</div>
                                  {teeTimeDiff && <div className="text-xs text-muted-foreground">{teeTimeDiff}</div>}
                                </div>
                              );
                            })()}
                          </TableCell>
                          
                          {/* Position column for 2-ball */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              let playerId = '';

                              if (isSupabaseMatchupRow2Ball(matchup)) {
                                if (player.id === 'p1') {
                                  playerId = String((matchup as SupabaseMatchupRow2Ball).player1_dg_id);
                                } else if (player.id === 'p2') {
                                  playerId = String((matchup as SupabaseMatchupRow2Ball).player2_dg_id);
                                }
                              }
                              
                              const positionData = formatPlayerPosition(String(playerId), m2.teetime);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-xs font-medium">{positionData.position}</div>
                                    <div className="text-xs text-muted-foreground">{positionData.score}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {(sortedPlayers.filter((player: typeof sortedPlayers[number]) => player.odds && player.odds > 1) as typeof sortedPlayers).map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.odds ?? 0)}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-center">
                            {(sortedPlayers.filter((player: typeof sortedPlayers[number]) => player.dgOdds && player.dgOdds > 1) as typeof sortedPlayers).map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`dg-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDGGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dgOdds ?? 0)}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      return null;
                    }
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-400">No {matchupType === "3ball" ? "3-ball" : "2-ball"} matchups found for the selected event.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
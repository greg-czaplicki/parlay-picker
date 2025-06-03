"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, DollarSign, Sliders, CheckCircle, Info, PlusCircle } from "lucide-react"
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
import { detect3BallDivergence } from "@/lib/utils"
import { useMatchupsQuery } from "@/hooks/use-matchups-query"
import { usePlayerStatsQuery, PlayerStat } from "@/hooks/use-player-stats-query"
import { useParlayContext } from '@/context/ParlayContext'
import { useParlaysQuery } from '@/hooks/use-parlays-query'
import { FilterService } from "@/filters/filter-service"

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
  filterId?: string | null;
}

export default function MatchupsTable({ eventId, matchupType = "3ball", roundNum, filterId }: MatchupsTableProps) {
  const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel">("fanduel");
  // Odds gap filter state
  const [oddsGapThreshold, setOddsGapThreshold] = useState(40); // Default 40 points in American odds
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Use React Query for matchups
  const { data: matchups, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType, roundNum);

  // Use type guards before accessing fields
  const playerIds = (matchups ?? []).flatMap(m => {
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

  // Parlay context and all user parlays for indicator logic
  const userId = '00000000-0000-0000-0000-000000000001';
  const { selections, addSelection, removeSelection } = useParlayContext();
  const { data: allParlays = [] } = useParlaysQuery(userId);
  // Flatten all picks from all parlays
  const allParlayPicks = (allParlays ?? []).flatMap((parlay: any) => parlay.picks || []);
  // Helper to check if a player is in the current parlay
  const isPlayerInCurrentParlay = (playerName: string) =>
    selections.some(s => s.player.toLowerCase() === playerName.toLowerCase());
  // Helper to check if a player is in any other parlay
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => (pick.picked_player_name || '').toLowerCase() === playerName.toLowerCase());

  if (isLoading) {
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

  if (isError) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <div className="text-red-500">Error: {error?.message}</div>
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
  const filteredMatchups = (matchups ?? []).filter(matchup => {
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
  });
    
  return (
    <TooltipProvider>
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{matchupType === "3ball" ? "3-Ball" : "2-Ball"} Matchups</h2>
                {matchups && matchups.length > 0 && (
                  <p className="text-sm text-gray-400">
                    Event: {isSupabaseMatchupRow(matchups[0]) || isSupabaseMatchupRow2Ball(matchups[0]) ? matchups[0].event_name : ""}
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
          </div>
          {filteredMatchups && filteredMatchups.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <Table>
                <TableHeader className="bg-[#1e1e23]">
                  <TableRow>
                    <TableHead className="text-white text-center">Players</TableHead>
                    <TableHead className="text-white text-center">Position</TableHead>
                    <TableHead className="text-white text-center">FanDuel Odds</TableHead>
                    <TableHead className="text-white text-center">
                      {matchupType === "3ball" ? "Data Golf Odds" : "DraftKings Odds"}
                    </TableHead>
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
                      const formatPlayerPosition = (playerId: string | number) => {
                        const playerStat = playerStatsMap[String(playerId)];
                        if (!playerStat) return { position: '-', score: '-' };
                        const position = playerStat.position || '-';
                        let score: string = '-';
                        if (playerStat.total === 0) {
                          score = 'E';
                        } else if (typeof playerStat.total === 'number' && playerStat.total > 0) {
                          score = `+${playerStat.total}`;
                        } else if (typeof playerStat.total === 'number' && playerStat.total < 0) {
                          score = playerStat.total.toString();
                        }
                        return { position, score };
                      };
                      
                      return (
                        <TableRow key={`3ball-${matchup.uuid}`}>
                          <TableCell>
                            {sortedPlayers.map((player, idx) => (
                              <div key={`player-${idx}`} className="py-1 h-8 flex items-center">
                                {(() => {
                                  const inCurrent = isPlayerInCurrentParlay(formatPlayerName(player.name));
                                  const inAny = isPlayerInAnyParlay(formatPlayerName(player.name));
                                  return (
                                    <span className="mr-2 flex items-center gap-1">
                                      {inCurrent ? (
                                        <Button size="icon" variant="secondary" disabled className="h-6 w-6 p-0"><CheckCircle className="text-green-400" size={16} /></Button>
                                      ) : (
                                        <Button size="icon" variant="outline" className="h-6 w-6 p-0" onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          addSelection({
                                            id: String(player.dg_id),
                                            matchupType,
                                            player: formatPlayerName(player.name),
                                            odds: Number(player.odds) || 0,
                                            matchupId: matchup.uuid,
                                            eventName: matchup.event_name,
                                            roundNum: matchup.round_num
                                          });
                                        }}><PlusCircle className="text-primary" size={16} /></Button>
                                      )}
                                      {inAny && !inCurrent && (
                                        <Tooltip><TooltipTrigger asChild><Info className="text-blue-400" size={16} /></TooltipTrigger><TooltipContent>Already used in another parlay</TooltipContent></Tooltip>
                                      )}
                                    </span>
                                  );
                                })()}
                                {formatPlayerName(player.name)}
                              </div>
                            ))}
                          </TableCell>
                          
                          {/* New Position column */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              let playerId = '';
                              
                              if (isSupabaseMatchupRow(matchup)) {
                                if (player.id === 'p1') {
                                  playerId = (matchup as SupabaseMatchupRow).player1_dg_id;
                                } else if (player.id === 'p2') {
                                  playerId = (matchup as SupabaseMatchupRow).player2_dg_id;
                                } else if (player.id === 'p3' && (matchup as SupabaseMatchupRow).player3_dg_id != null) {
                                  playerId = (matchup as SupabaseMatchupRow).player3_dg_id;
                                }
                              }
                              
                              const positionData = formatPlayerPosition(String(playerId));
                              
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
                      const dkP1Odds = Number(m2.draftkings_p1_odds ?? 0);
                      const dkP2Odds = Number(m2.draftkings_p2_odds ?? 0);

                      // Check if at least one player has odds from FanDuel
                      const hasAnyValidOdds = (fdP1Odds > 1) || (fdP2Odds > 1);
                      if (!hasAnyValidOdds) {
                        return null; // Skip this matchup
                      }
                      
                      // Initialize gap flags for both FanDuel and DraftKings
                      let p1HasFDGap = false;
                      let p2HasFDGap = false;
                      let p1HasDKGap = false;
                      let p2HasDKGap = false;
                      
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
                      // Check for DraftKings gaps
                      if (dkP1Odds > 1 && dkP2Odds > 1 && dkP1Odds < dkP2Odds) {
                        const americanP1 = parseInt(decimalToAmerican(dkP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dkP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p1HasDKGap = true;
                        }
                      }
                      if (dkP1Odds > 1 && dkP2Odds > 1 && dkP2Odds < dkP1Odds) {
                        const americanP1 = parseInt(decimalToAmerican(dkP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dkP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        if (gap >= oddsGapThreshold) {
                          p2HasDKGap = true;
                        }
                      }
                      
                      // For 2-ball matchups (inside isSupabaseMatchupRow2Ball branch)
                      const sortedPlayers = [
                        {
                          id: 'p1',
                          dg_id: m2.player1_dg_id,
                          odds: m2.odds1,
                          name: m2.player1_name,
                          dkOdds: dkP1Odds,
                          hasGap: p1HasFDGap,
                          hasDKGap: p1HasDKGap,
                        },
                        {
                          id: 'p2',
                          dg_id: m2.player2_dg_id,
                          odds: m2.odds2,
                          name: m2.player2_name,
                          dkOdds: dkP2Odds,
                          hasGap: p2HasFDGap,
                          hasDKGap: p2HasDKGap,
                        },
                      ].filter(p => p.dg_id !== null && p.dg_id !== undefined)
                       .sort((a, b) => {
                          if (!a.odds || a.odds <= 1) return 1;
                          if (!b.odds || b.odds <= 1) return -1;
                          return (a.odds || 0) - (b.odds || 0);
                        });

                      // Format the player's tournament position and score
                      const formatPlayerPosition = (playerId: string | number) => {
                        const playerStat = playerStatsMap[String(playerId)];
                        if (!playerStat) return { position: '-', score: '-' };
                        const position = playerStat.position || '-';
                        let score: string = '-';
                        if (playerStat.total === 0) {
                          score = 'E';
                        } else if (typeof playerStat.total === 'number' && playerStat.total > 0) {
                          score = `+${playerStat.total}`;
                        } else if (typeof playerStat.total === 'number' && playerStat.total < 0) {
                          score = playerStat.total.toString();
                        }
                        return { position, score };
                      };
                      
                      return (
                        <TableRow key={`2ball-${m2.uuid}`}>
                          <TableCell>
                            {sortedPlayers.map((player, idx) => (
                              <div key={`player-${idx}`} className="py-1 h-8 flex items-center">
                                {(() => {
                                  const inCurrent = isPlayerInCurrentParlay(formatPlayerName(player.name));
                                  const inAny = isPlayerInAnyParlay(formatPlayerName(player.name));
                                  return (
                                    <span className="mr-2 flex items-center gap-1">
                                      {inCurrent ? (
                                        <Button size="icon" variant="secondary" disabled className="h-6 w-6 p-0"><CheckCircle className="text-green-400" size={16} /></Button>
                                      ) : (
                                        <Button size="icon" variant="outline" className="h-6 w-6 p-0" onClick={() => {
                                          if (typeof player.dg_id !== 'number' || isNaN(player.dg_id)) return;
                                          addSelection({
                                            id: String(player.dg_id),
                                            matchupType,
                                            player: formatPlayerName(player.name),
                                            odds: Number(player.odds) || 0,
                                            matchupId: m2.uuid,
                                            eventName: m2.event_name,
                                            roundNum: m2.round_num ?? 0
                                          });
                                        }}><PlusCircle className="text-primary" size={16} /></Button>
                                      )}
                                      {inAny && !inCurrent && (
                                        <Tooltip><TooltipTrigger asChild><Info className="text-blue-400" size={16} /></TooltipTrigger><TooltipContent>Already used in another parlay</TooltipContent></Tooltip>
                                      )}
                                    </span>
                                  );
                                })()}
                                {formatPlayerName(player.name)}
                              </div>
                            ))}
                          </TableCell>
                          
                          {/* Position column for 2-ball */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              let playerId = '';

                              if (isSupabaseMatchupRow2Ball(matchup)) {
                                if (player.id === 'p1') {
                                  playerId = (matchup as SupabaseMatchupRow2Ball).player1_dg_id;
                                } else if (player.id === 'p2') {
                                  playerId = (matchup as SupabaseMatchupRow2Ball).player2_dg_id;
                                }
                              }
                              
                              const positionData = formatPlayerPosition(String(playerId));
                              
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
                            {(sortedPlayers.filter((player: typeof sortedPlayers[number]) => player.dkOdds && player.dkOdds > 1) as typeof sortedPlayers).map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`dk-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDKGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dkOdds ?? 0)}
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
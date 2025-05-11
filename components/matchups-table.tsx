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
import { Loader2, AlertTriangle, DollarSign, Sliders, Trophy } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
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

// Only 3-ball matchups
interface SupabaseMatchupRow {
  id: number;
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id: number;
  p3_player_name: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  fanduel_p3_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  draftkings_p3_odds: number | null;
  datagolf_p1_odds?: number | null;
  datagolf_p2_odds?: number | null;
  datagolf_p3_odds?: number | null;
  odds?: any;
}

// Interface for 2-ball matchups
interface SupabaseMatchupRow2Ball {
  id: number;
  event_id: number;
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
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

export default function MatchupsTable({ 
  eventId, 
  matchupType = "3ball" 
}: { 
  eventId: number | null;
  matchupType?: "2ball" | "3ball";
}) {
  const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel">("fanduel");
  const [activeMatchupType, setActiveMatchupType] = useState<"2ball" | "3ball">(matchupType);
  // Odds gap filter state
  const [oddsGapThreshold, setOddsGapThreshold] = useState(40); // Default 40 points in American odds
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Use React Query for matchups
  const { data: matchups, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, activeMatchupType);

  // Extract all unique player IDs from matchups for stats
  const playerIds = (matchups ?? []).flatMap(m => {
    const ids = [m.p1_dg_id, m.p2_dg_id];
    if ('p3_dg_id' in m && m.p3_dg_id) ids.push(m.p3_dg_id);
    return ids;
  });

  // Use React Query for player stats (assume roundNum = 1 for now, or extract from matchups if needed)
  const roundNum = (matchups ?? []).length > 0 ? (matchups ?? [])[0].round_num : 1;
  const { data: playerStats, isLoading: loadingStats, isError: isErrorStats, error: errorStats } = usePlayerStatsQuery(eventId, roundNum, playerIds);

  // After fetching playerStats (which is PlayerStat[] | undefined), create a lookup object:
  const playerStatsMap: Record<number, PlayerStat> = (playerStats ?? []).reduce((acc, stat) => {
    if (stat.player_id != null) acc[stat.player_id] = stat;
    return acc;
  }, {} as Record<number, PlayerStat>);

  // Update the local state when the prop changes
  useEffect(() => {
    setActiveMatchupType(matchupType);
  }, [matchupType]);
  
  // Notify parent component when matchup type changes
  useEffect(() => {
    // If the parent has passed a callback function, call it when the matchup type changes
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      const event = new CustomEvent('matchupTypeChanged', { detail: activeMatchupType });
      window.dispatchEvent(event);
    }
  }, [activeMatchupType]);

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
    return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
  };

  // Calculate if the odds gap exceeds the threshold
  const hasSignificantOddsGap = (playerOdds: number | null, referenceOdds: number | null): boolean => {
    if (!playerOdds || !referenceOdds || playerOdds <= 1 || referenceOdds <= 1) return false;
    
    // For 3ball matchups, we want to highlight value - odds that are higher than expected
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

  // Detect if a matchup is a 3-ball matchup
  const is3BallMatchup = (matchup: any): matchup is SupabaseMatchupRow => {
    return 'p3_player_name' in matchup && 'p3_dg_id' in matchup;
  };
    
  return (
    <TooltipProvider>
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">{activeMatchupType === "3ball" ? "3-Ball" : "2-Ball"} Matchups</h2>
                {matchups && matchups.length > 0 && <p className="text-sm text-gray-400">Event: {matchups[0].event_name}</p>}
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
                        if (oddsGapThreshold > 0 && (matchups ?? []).length > 0) {
                          const highlightedCount = (matchups ?? []).reduce((count, matchup) => {
                            if (is3BallMatchup(matchup)) {
                              // For 3-ball, calculate gaps using the same logic as in the render
                              const players = [
                                { id: 'p1', odds: matchup.fanduel_p1_odds },
                                { id: 'p2', odds: matchup.fanduel_p2_odds },
                                { id: 'p3', odds: matchup.fanduel_p3_odds }
                              ].filter(p => p.odds && p.odds > 1);
                              
                              if (players.length >= 3) {
                                players.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = players[0];
                                const otherPlayers = players.slice(1);
                                
                                const hasGapAgainstAll = otherPlayers.every(other => 
                                  hasSignificantOddsGap(favorite.odds, other.odds)
                                );
                                
                                if (hasGapAgainstAll) count++;
                              }
                            } else {
                              // For 2-ball matchups
                              const p1Odds = matchup.fanduel_p1_odds || 0;
                              const p2Odds = matchup.fanduel_p2_odds || 0;
                              
                              if (p1Odds > 1 && p2Odds > 1) {
                                if ((p1Odds < p2Odds && hasSignificantOddsGap(p1Odds, p2Odds)) || 
                                    (p2Odds < p1Odds && hasSignificantOddsGap(p2Odds, p1Odds))) {
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
                <Select 
                  value={activeMatchupType} 
                  onValueChange={(value: string) => setActiveMatchupType(value as "2ball" | "3ball")}
                >
                  <SelectTrigger className="w-[120px] bg-[#1e1e23] border-none">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3ball">3-Ball</SelectItem>
                    <SelectItem value="2ball">2-Ball</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          {matchups && (matchups ?? []).length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <Table>
                <TableHeader className="bg-[#1e1e23]">
                  <TableRow>
                    <TableHead className="text-white text-center">Players</TableHead>
                    <TableHead className="text-white text-center">Position</TableHead>
                    <TableHead className="text-white text-center">FanDuel Odds</TableHead>
                    <TableHead className="text-white text-center">
                      {activeMatchupType === "3ball" ? "Data Golf Odds" : "DraftKings Odds"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(matchups ?? []).map((matchup, index) => {
                    // Generate a stable key - use id if available, otherwise use index and a type identifier
                    const key = matchup.id ? `matchup-${matchup.id}` : `matchup-${index}-${matchup.p1_dg_id}-${matchup.p2_dg_id}`;
                    
                    // Skip this matchup if it's missing odds
                    if (is3BallMatchup(matchup)) {
                      // Check if at least one player has odds from both FanDuel and DataGolf
                      const hasAnyValidOdds = (
                        (matchup.fanduel_p1_odds && matchup.fanduel_p1_odds > 1) ||
                        (matchup.fanduel_p2_odds && matchup.fanduel_p2_odds > 1) ||
                        (matchup.fanduel_p3_odds && matchup.fanduel_p3_odds > 1)
                      );
                      
                      if (!hasAnyValidOdds) {
                        return null; // Skip this matchup
                      }
                    } else {
                      // For 2-ball, check if at least one player has odds from FanDuel
                      const hasAnyValidOdds = (
                        (matchup.fanduel_p1_odds && matchup.fanduel_p1_odds > 1) ||
                        (matchup.fanduel_p2_odds && matchup.fanduel_p2_odds > 1)
                      );
                      
                      if (!hasAnyValidOdds) {
                        return null; // Skip this matchup
                      }
                    }
                    
                    // Handle 3-ball matchups
                    if (is3BallMatchup(matchup)) {
                      const dg_p1_odds = matchup.datagolf_p1_odds ?? matchup.odds?.datagolf?.p1 ?? null;
                      const dg_p2_odds = matchup.datagolf_p2_odds ?? matchup.odds?.datagolf?.p2 ?? null;
                      const dg_p3_odds = matchup.datagolf_p3_odds ?? matchup.odds?.datagolf?.p3 ?? null;
                      
                      // Check both for divergence and significant odds gaps
                      const divergence = detect3BallDivergence({
                        odds: {
                          fanduel: {
                            p1: matchup.fanduel_p1_odds,
                            p2: matchup.fanduel_p2_odds,
                            p3: matchup.fanduel_p3_odds,
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
                      
                      // Calculate FanDuel gaps
                      const fdPlayers = [
                        { id: 'p1', odds: matchup.fanduel_p1_odds, name: matchup.p1_player_name },
                        { id: 'p2', odds: matchup.fanduel_p2_odds, name: matchup.p2_player_name },
                        { id: 'p3', odds: matchup.fanduel_p3_odds, name: matchup.p3_player_name }
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
                        { id: 'p1', odds: dg_p1_odds, name: matchup.p1_player_name },
                        { id: 'p2', odds: dg_p2_odds, name: matchup.p2_player_name },
                        { id: 'p3', odds: dg_p3_odds, name: matchup.p3_player_name }
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
                      
                      // Sort players by their FanDuel odds (lowest first = favorite)
                      const sortedPlayers = [
                        { id: 'p1', odds: matchup.fanduel_p1_odds, name: matchup.p1_player_name, dgOdds: dg_p1_odds, hasGap: p1HasFDGap, hasDGGap: p1HasDGGap, dgFavorite: divergence?.datagolfFavorite === 'p1' },
                        { id: 'p2', odds: matchup.fanduel_p2_odds, name: matchup.p2_player_name, dgOdds: dg_p2_odds, hasGap: p2HasFDGap, hasDGGap: p2HasDGGap, dgFavorite: divergence?.datagolfFavorite === 'p2' },
                        { id: 'p3', odds: matchup.fanduel_p3_odds, name: matchup.p3_player_name, dgOdds: dg_p3_odds, hasGap: p3HasFDGap, hasDGGap: p3HasDGGap, dgFavorite: divergence?.datagolfFavorite === 'p3' }
                      ].sort((a, b) => {
                        // Handle null/undefined odds by placing them at the end
                        if (!a.odds || a.odds <= 1) return 1;
                        if (!b.odds || b.odds <= 1) return -1;
                        // Lower decimal odds = favorite (better odds)
                        return a.odds - b.odds;
                      });

                      // Format the player's tournament position and score
                      const formatPlayerPosition = (playerId: number) => {
                        const playerStat = playerStatsMap[playerId];
                        if (!playerStat) return null;
                        
                        // Format the position display
                        const position = playerStat.position || '';
                        
                        // Ensure score is always a string
                        let score: string | null = null;
                        if (playerStat.total !== null && playerStat.total !== undefined) {
                          if (playerStat.total === 0) {
                            score = 'E';
                          } else if (playerStat.total > 0) {
                            score = `+${playerStat.total}`;
                          } else {
                            score = playerStat.total.toString();
                          }
                        }
                          
                        return { position, score };
                      };
                      
                      return (
                        <TableRow key={`3ball-${key}`}>
                          <TableCell>
                            {sortedPlayers.map((player, idx) => (
                              <div key={`player-${idx}`} className="py-1 h-8 flex items-center">{formatPlayerName(player.name)}</div>
                            ))}
                          </TableCell>
                          
                          {/* New Position column */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              const playerId = player.id === 'p1' ? matchup.p1_dg_id : 
                                             player.id === 'p2' ? matchup.p2_dg_id : 
                                             player.id === 'p3' ? matchup.p3_dg_id : 0;
                              
                              const positionData = formatPlayerPosition(playerId);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
                                  {positionData ? (
                                    <div className="flex items-center justify-center space-x-2 w-full">
                                      <span className={`px-2 py-0.5 text-xs rounded min-w-12 text-center font-medium ${
                                        // Position heatmap - from gold (1st) to blue gradient (top 30) to gray (below top 30)
                                        positionData.position === '1' 
                                          ? 'bg-yellow-500/40 text-yellow-100' 
                                          : positionData.position === 'T1'
                                            ? 'bg-yellow-500/30 text-yellow-100'
                                          : positionData.position === '2' || positionData.position === 'T2'
                                            ? 'bg-amber-500/30 text-amber-100'
                                          : positionData.position === '3' || positionData.position === 'T3'
                                            ? 'bg-orange-500/30 text-orange-100'
                                          : positionData.position?.match(/^T?[4-5]$/)
                                            ? 'bg-red-500/30 text-red-100'
                                          : positionData.position?.match(/^T?[6-9]$/) || positionData.position === 'T10' || positionData.position === '10'
                                            ? 'bg-purple-500/30 text-purple-100'
                                          : positionData.position?.match(/^T?1[1-9]$/) || positionData.position?.match(/^T?2[0-5]$/)
                                            ? 'bg-blue-500/30 text-blue-100'
                                          : positionData.position?.match(/^T?2[6-9]$/) || positionData.position?.match(/^T?3[0-9]$/)
                                            ? 'bg-blue-700/30 text-blue-200' 
                                            : positionData.position === 'CUT' || positionData.position === 'WD'
                                              ? 'bg-rose-950/30 text-rose-300'
                                              : 'bg-gray-500/30 text-gray-300'
                                      }`}>
                                        {positionData.position}
                                      </span>
                                      {positionData.score && (
                                        <span className={`px-2 py-0.5 text-xs rounded min-w-12 text-center font-medium ${
                                          // Score heatmap - from deep red (best) to green (even) to gray (over par)
                                          positionData.score === 'E' 
                                            ? 'bg-green-600/30 text-green-100' 
                                            : positionData.score.startsWith('-') ? (
                                                // Under par gradient (better scores have deeper red)
                                                positionData.score <= '-10' 
                                                  ? 'bg-red-900/40 text-red-100' 
                                                  : positionData.score <= '-7'
                                                    ? 'bg-red-800/40 text-red-100'
                                                    : positionData.score <= '-5'
                                                      ? 'bg-red-700/40 text-red-100'
                                                      : positionData.score <= '-3'
                                                        ? 'bg-red-600/40 text-red-100'
                                                        : 'bg-red-500/40 text-red-100'
                                              ) : (
                                                // Over par gradient (worse scores have deeper gray)
                                                positionData.score >= '+10'
                                                  ? 'bg-gray-900/40 text-gray-100'
                                                  : positionData.score >= '+7'
                                                    ? 'bg-gray-800/40 text-gray-100'
                                                    : positionData.score >= '+5'
                                                      ? 'bg-gray-700/40 text-gray-100'
                                                      : positionData.score >= '+3'
                                                        ? 'bg-gray-600/40 text-gray-100'
                                                        : 'bg-gray-500/40 text-gray-100'
                                              )
                                        }`}>
                                          {positionData.score}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => (
                              <div key={`odds-${idx}`} className={`${player.hasGap ? "font-bold text-green-400" : ""} relative w-24 mx-auto py-1 h-8 flex items-center justify-center`}>
                                <span>{formatOdds(player.odds)}</span>
                                {divergence?.isDivergence && player.dgFavorite ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-green-600 text-green-100 rounded-full p-1 flex items-center justify-center cursor-pointer">
                                        <DollarSign size={12} className="text-green-100" aria-label="Data Golf value" />
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-50">
                                      <span>
                                        Divergence: FanDuel favorite: <b>{
                                          divergence.fanduelFavorite === 'p1' ? formatPlayerName(matchup.p1_player_name) :
                                          divergence.fanduelFavorite === 'p2' ? formatPlayerName(matchup.p2_player_name) :
                                          divergence.fanduelFavorite === 'p3' ? formatPlayerName(matchup.p3_player_name) :
                                          'N/A'
                                        }</b>, DG favorite: <b>{formatPlayerName(player.name)}</b>.
                                      </span>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : null}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => (
                              <div key={`dg-odds-${idx}`} className={`${player.hasDGGap ? "font-bold text-green-400" : ""} py-1 h-8 flex items-center justify-center`}>
                                {formatOdds(player.dgOdds)}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // Handle 2-ball matchups
                      // For 2ball, we want to identify when the favorite has a significant gap against the other player
                      
                      // Initialize gap flags for both FanDuel and DraftKings
                      let p1HasFDGap = false;
                      let p2HasFDGap = false;
                      let p1HasDKGap = false;
                      let p2HasDKGap = false;
                      
                      // Check for FanDuel gaps
                      const fdP1Odds = matchup.fanduel_p1_odds || 0;
                      const fdP2Odds = matchup.fanduel_p2_odds || 0;
                      
                      // Check if player 1 is the favorite with a significant gap in FanDuel
                      if (fdP1Odds > 1 && fdP2Odds > 1 && fdP1Odds < fdP2Odds) {
                        // Convert odds to American and calculate the gap
                        const americanP1 = parseInt(decimalToAmerican(fdP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(fdP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        
                        // If gap exceeds threshold, highlight player 1
                        if (gap >= oddsGapThreshold) {
                          p1HasFDGap = true;
                        }
                      }
                      
                      // Check if player 2 is the favorite with a significant gap in FanDuel
                      if (fdP1Odds > 1 && fdP2Odds > 1 && fdP2Odds < fdP1Odds) {
                        // Convert odds to American and calculate the gap
                        const americanP1 = parseInt(decimalToAmerican(fdP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(fdP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        
                        // If gap exceeds threshold, highlight player 2
                        if (gap >= oddsGapThreshold) {
                          p2HasFDGap = true;
                        }
                      }
                      
                      // Check for DraftKings gaps
                      const dkP1Odds = matchup.draftkings_p1_odds || 0;
                      const dkP2Odds = matchup.draftkings_p2_odds || 0;
                      
                      // Check if player 1 is the favorite with a significant gap in DraftKings
                      if (dkP1Odds > 1 && dkP2Odds > 1 && dkP1Odds < dkP2Odds) {
                        // Convert odds to American and calculate the gap
                        const americanP1 = parseInt(decimalToAmerican(dkP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dkP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        
                        // If gap exceeds threshold, highlight player 1
                        if (gap >= oddsGapThreshold) {
                          p1HasDKGap = true;
                        }
                      }
                      
                      // Check if player 2 is the favorite with a significant gap in DraftKings
                      if (dkP1Odds > 1 && dkP2Odds > 1 && dkP2Odds < dkP1Odds) {
                        // Convert odds to American and calculate the gap
                        const americanP1 = parseInt(decimalToAmerican(dkP1Odds));
                        const americanP2 = parseInt(decimalToAmerican(dkP2Odds));
                        const gap = Math.abs(americanP1 - americanP2);
                        
                        // If gap exceeds threshold, highlight player 2
                        if (gap >= oddsGapThreshold) {
                          p2HasDKGap = true;
                        }
                      }
                      
                      // Sort players by their FanDuel odds (lowest first = favorite)
                      const sortedPlayers = [
                        { id: 'p1', odds: matchup.fanduel_p1_odds, name: matchup.p1_player_name, dkOdds: matchup.draftkings_p1_odds, hasGap: p1HasFDGap, hasDKGap: p1HasDKGap },
                        { id: 'p2', odds: matchup.fanduel_p2_odds, name: matchup.p2_player_name, dkOdds: matchup.draftkings_p2_odds, hasGap: p2HasFDGap, hasDKGap: p2HasDKGap }
                      ].sort((a, b) => {
                        // Handle null/undefined odds by placing them at the end
                        if (!a.odds || a.odds <= 1) return 1;
                        if (!b.odds || b.odds <= 1) return -1;
                        // Lower decimal odds = favorite (better odds)
                        return a.odds - b.odds;
                      });

                      // Format the player's tournament position and score
                      const formatPlayerPosition = (playerId: number) => {
                        const playerStat = playerStatsMap[playerId];
                        if (!playerStat) return null;
                        
                        // Format the position display
                        const position = playerStat.position || '';
                        
                        // Ensure score is always a string
                        let score: string | null = null;
                        if (playerStat.total !== null && playerStat.total !== undefined) {
                          if (playerStat.total === 0) {
                            score = 'E';
                          } else if (playerStat.total > 0) {
                            score = `+${playerStat.total}`;
                          } else {
                            score = playerStat.total.toString();
                          }
                        }
                          
                        return { position, score };
                      };
                      
                      return (
                        <TableRow key={`2ball-${key}`}>
                          <TableCell>
                            {sortedPlayers.map((player, idx) => (
                              <div key={`player-${idx}`} className="py-1 h-8 flex items-center">{formatPlayerName(player.name)}</div>
                            ))}
                          </TableCell>
                          
                          {/* Position column for 2-ball */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
                              const playerId = player.id === 'p1' ? matchup.p1_dg_id : 
                                            player.id === 'p2' ? matchup.p2_dg_id : 0;
                              
                              const positionData = formatPlayerPosition(playerId);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
                                  {positionData ? (
                                    <div className="flex items-center justify-center space-x-2 w-full">
                                      <span className={`px-2 py-0.5 text-xs rounded min-w-12 text-center font-medium ${
                                        // Position heatmap - from gold (1st) to blue gradient (top 30) to gray (below top 30)
                                        positionData.position === '1' 
                                          ? 'bg-yellow-500/40 text-yellow-100' 
                                          : positionData.position === 'T1'
                                            ? 'bg-yellow-500/30 text-yellow-100'
                                          : positionData.position === '2' || positionData.position === 'T2'
                                            ? 'bg-amber-500/30 text-amber-100'
                                          : positionData.position === '3' || positionData.position === 'T3'
                                            ? 'bg-orange-500/30 text-orange-100'
                                          : positionData.position?.match(/^T?[4-5]$/)
                                            ? 'bg-red-500/30 text-red-100'
                                          : positionData.position?.match(/^T?[6-9]$/) || positionData.position === 'T10' || positionData.position === '10'
                                            ? 'bg-purple-500/30 text-purple-100'
                                          : positionData.position?.match(/^T?1[1-9]$/) || positionData.position?.match(/^T?2[0-5]$/)
                                            ? 'bg-blue-500/30 text-blue-100'
                                          : positionData.position?.match(/^T?2[6-9]$/) || positionData.position?.match(/^T?3[0-9]$/)
                                            ? 'bg-blue-700/30 text-blue-200' 
                                            : positionData.position === 'CUT' || positionData.position === 'WD'
                                              ? 'bg-rose-950/30 text-rose-300'
                                              : 'bg-gray-500/30 text-gray-300'
                                      }`}>
                                        {positionData.position}
                                      </span>
                                      {positionData.score && (
                                        <span className={`px-2 py-0.5 text-xs rounded min-w-12 text-center font-medium ${
                                          // Score heatmap - from deep red (best) to green (even) to gray (over par)
                                          positionData.score === 'E' 
                                            ? 'bg-green-600/30 text-green-100' 
                                            : positionData.score.startsWith('-') ? (
                                                // Under par gradient (better scores have deeper red)
                                                positionData.score <= '-10' 
                                                  ? 'bg-red-900/40 text-red-100' 
                                                  : positionData.score <= '-7'
                                                    ? 'bg-red-800/40 text-red-100'
                                                    : positionData.score <= '-5'
                                                      ? 'bg-red-700/40 text-red-100'
                                                      : positionData.score <= '-3'
                                                        ? 'bg-red-600/40 text-red-100'
                                                        : 'bg-red-500/40 text-red-100'
                                              ) : (
                                                // Over par gradient (worse scores have deeper gray)
                                                positionData.score >= '+10'
                                                  ? 'bg-gray-900/40 text-gray-100'
                                                  : positionData.score >= '+7'
                                                    ? 'bg-gray-800/40 text-gray-100'
                                                    : positionData.score >= '+5'
                                                      ? 'bg-gray-700/40 text-gray-100'
                                                      : positionData.score >= '+3'
                                                        ? 'bg-gray-600/40 text-gray-100'
                                                        : 'bg-gray-500/40 text-gray-100'
                                              )
                                        }`}>
                                          {positionData.score}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => (
                              <div key={`odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.odds)}
                              </div>
                            ))}
                          </TableCell>
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => (
                              <div key={`dk-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDKGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dkOdds)}
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    }
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-400">No {activeMatchupType === "3ball" ? "3-ball" : "2-ball"} matchups found for the selected event.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

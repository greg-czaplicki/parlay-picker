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
<<<<<<< HEAD
import { Loader2, DollarSign, Sliders, CheckCircle, Info, PlusCircle } from "lucide-react"
=======
import { Loader2, AlertTriangle, DollarSign, Sliders, Trophy } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase"
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
<<<<<<< HEAD
=======
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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

// Helper type guard for SupabaseMatchupRow (3ball)
function isSupabaseMatchupRow(matchup: MatchupRow): matchup is SupabaseMatchupRow {
  // 3ball matchups have type='3ball' and should handle as 3ball
  return (matchup as any).type === '3ball';
}

// Helper type guard for SupabaseMatchupRow2Ball
function isSupabaseMatchupRow2Ball(matchup: MatchupRow): matchup is SupabaseMatchupRow2Ball {
  // Simply check if the matchup has type '2ball'
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
<<<<<<< HEAD
  // Odds gap filter state
  const [oddsGapThreshold, setOddsGapThreshold] = useState(40); // Default 40 points in American odds
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Use React Query for matchups
  const { data: matchups, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType, roundNum);
  
  // Debug matchups data to diagnose event filtering issues
  console.log('MatchupsTable - props:', { eventId, matchupType, roundNum });
  console.log('MatchupsTable - matchups received:', matchups?.length, 'matchupType:', matchupType);
  if (matchups?.length) {
    console.log('First matchup event_id:', matchups[0].event_id, 'event_name:', matchups[0].event_name);
  }
=======
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [activeMatchupType, setActiveMatchupType] = useState<"2ball" | "3ball">(matchupType);
  
  // Odds gap filter state
  const [oddsGapThreshold, setOddsGapThreshold] = useState(40); // Default 40 points in American odds
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  
  // State for live tournament stats
  const [playerStats, setPlayerStats] = useState<Record<number, LiveTournamentStat>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    // Reset state before fetching new data
    setMatchups([]);
    setLoading(true);
    setError(null);
    setPlayerStats({});
    
    // For debugging - print event ID
    console.log("Current eventId in MatchupsTable:", eventId, 
                "activeMatchupType:", activeMatchupType);
    
    fetchMatchupsFromApi();
  }, [eventId, activeMatchupType]);
  
  // Function to fetch live stats for players in the matchups
  const fetchPlayerStats = async (matchups: MatchupRow[]) => {
    if (!matchups || matchups.length === 0) return;
    
    setLoadingStats(true);
    
    try {
      // Extract all player IDs from the matchups
      const playerIds = new Set<number>();
      
      matchups.forEach(matchup => {
        if (matchup.p1_dg_id) playerIds.add(matchup.p1_dg_id);
        if (matchup.p2_dg_id) playerIds.add(matchup.p2_dg_id);
        
        // If it's a 3-ball matchup, add player 3
        if ('p3_dg_id' in matchup && matchup.p3_dg_id) {
          playerIds.add(matchup.p3_dg_id);
        }
      });
      
      if (playerIds.size === 0) {
        setLoadingStats(false);
        return;
      }
      
      console.log(`Fetching live stats for ${playerIds.size} players...`);
      
      // Query the database for live stats for these players
      const supabase = createBrowserClient();
      
      // Look for stats for the current event first
      const currentEventName = matchups[0].event_name;
      const { data: eventStats, error: eventError } = await supabase
        .from('live_tournament_stats')
        .select('*')
        .in('dg_id', Array.from(playerIds))
        .eq('event_name', currentEventName)
        .order('data_golf_updated_at', { ascending: false });
        
      if (eventStats && eventStats.length > 0) {
        console.log(`Found ${eventStats.length} stats for event ${currentEventName}`);
        
        // Convert to a map for easier lookup
        const statsMap: Record<number, LiveTournamentStat> = {};
        eventStats.forEach(stat => {
          // Only store the most recent stats for each player (we already ordered by timestamp)
          if (!statsMap[stat.dg_id]) {
            statsMap[stat.dg_id] = stat;
          }
        });
        
        setPlayerStats(statsMap);
      } else {
        console.log(`No stats found for event ${currentEventName}, trying any recent stats`);
        
        // If no stats for this event, get any recent stats
        const { data: anyStats, error: anyError } = await supabase
          .from('live_tournament_stats')
          .select('*')
          .in('dg_id', Array.from(playerIds))
          .order('data_golf_updated_at', { ascending: false });
          
        if (anyStats && anyStats.length > 0) {
          // Convert to a map for easier lookup
          const statsMap: Record<number, LiveTournamentStat> = {};
          anyStats.forEach(stat => {
            // Only store the most recent stats for each player
            if (!statsMap[stat.dg_id]) {
              statsMap[stat.dg_id] = stat;
            }
          });
          
          setPlayerStats(statsMap);
        }
      }
    } catch (err) {
      console.error("Error fetching player stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Update the local state when the prop changes
  useEffect(() => {
    setActiveMatchupType(matchupType);
  }, [matchupType]);
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
  

<<<<<<< HEAD
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
=======
  // NOTE: We removed the direct fetch function since we're fixing the database directly
  // This is much cleaner than adding complex workarounds in the frontend

  const fetchMatchupsFromApi = async () => {
    setLoading(true);
    setError(null);
    try {
      // First try our more reliable debug endpoint
      const debugEndpoint = `/api/debug/db-check${eventId ? `?eventId=${eventId}` : ''}`;
      console.log(`First checking database content via: ${debugEndpoint}`);
      
      let dbCheck = null;
      try {
        const debugResponse = await fetch(debugEndpoint);
        dbCheck = await debugResponse.json();
        
        console.log("Database check:", {
          success: dbCheck.success,
          matchupCount: dbCheck.matchupCount,
          eventCounts: dbCheck.eventCounts,
          sampleMatchups: dbCheck.sampleMatchups
        });
      } catch (dbErr) {
        console.warn("Error checking database directly:", dbErr);
      }
      
      // Standard endpoint for all cases
      const endpoint = eventId 
        ? `/api/matchups/${activeMatchupType}?eventId=${eventId}` 
        : `/api/matchups/${activeMatchupType}`;
      
      console.log(`Fetching matchups from endpoint: ${endpoint}`);
      
      // Try the API endpoint
      let data;
      try {
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error: ${errorText}`);
          throw new Error(`Failed to fetch ${activeMatchupType} matchups: ${errorText}`);
        }
        
        data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || "API returned success: false");
        }
      } catch (apiErr) {
        console.error("API fetch error:", apiErr);
        
        // If we have DB check results, use those as a fallback
        if (dbCheck && dbCheck.success && dbCheck.sampleMatchups && dbCheck.sampleMatchups.length > 0) {
          console.log("Using DB sample as fallback since API failed");
          setMatchups(dbCheck.sampleMatchups);
          setLastUpdateTime(null);
          setLoading(false);
          return;
        }
        
        // Otherwise propagate the error
        throw apiErr;
      }
      
      // Process the successful API response
      console.log(`API Response for ${activeMatchupType} matchups:`, {
        success: data.success,
        eventId: eventId,
        hasMatchups: Array.isArray(data.matchups) ? data.matchups.length : 0
      });
      
      // Check different possible structures in the API response
      let matchupsData = [];
      
      // Case 1: Standard format with 'matchups' array
      if (Array.isArray(data.matchups)) {
        console.log("Using data.matchups array format");
        matchupsData = data.matchups;
        
        // Debug logging of all matchups event_ids and names
        const eventIdToName = {};
        matchupsData.forEach(m => {
          if (m.event_id && m.event_name) {
            eventIdToName[m.event_id] = m.event_name;
          }
        });
        console.log("Events in API response:", eventIdToName);
      } 
      // Case 2: Format with 'events' array (grouped by event)
      else if (Array.isArray(data.events)) {
        console.log("Using data.events array format");
        
        // Log all available events
        console.log("Events in API response:", data.events.map(e => ({
          event_id: e.event_id,
          event_name: e.event_name,
          matchup_count: e.matchups?.length || 0
        })));
        
        // Find the event that matches our eventId
        if (eventId) {
          // Convert to numbers first for consistent comparison
          const eventIdNum = Number(eventId);
          const selectedEvent = data.events.find((e: any) => 
            Number(e.event_id) === eventIdNum
          );
          
          if (selectedEvent && Array.isArray(selectedEvent.matchups)) {
            console.log(`Found event ${selectedEvent.event_name} (ID: ${selectedEvent.event_id}) with ${selectedEvent.matchups.length} matchups`);
            matchupsData = selectedEvent.matchups;
          } else {
            console.log(`No event found with ID ${eventIdNum} - checking all events for this ID`);
          }
        } else {
          // No eventId, combine all matchups from all events
          matchupsData = data.events.flatMap((e: any) => e.matchups || []);
        }
      }
      
      // Filter by eventId if we still need to (in case we got all matchups)
      let filtered = matchupsData;
      
      if (eventId && matchupsData.length > 0) {
        const eventIdNum = Number(eventId);
        
        // First double-check what we're filtering by
        const eventCounts = {};
        matchupsData.forEach(m => {
          const mEventId = Number(m.event_id);
          if (!eventCounts[mEventId]) {
            eventCounts[mEventId] = {
              name: m.event_name,
              count: 0
            };
          }
          eventCounts[mEventId].count++;
        });
        console.log("Matchups by event_id before filtering:", eventCounts);
        
        // Try filtering by event_id
        filtered = matchupsData.filter((m: any) => {
          const matchupEventId = Number(m.event_id);
          return matchupEventId === eventIdNum;
        });
        
        console.log(`After filtering: ${filtered.length} matchups match eventId=${eventId}`);
        
        // If nothing found, try to get the event name and filter by that
        if (filtered.length === 0 && window.currentEvents) {
          // @ts-ignore
          const currentEvents = window.currentEvents || [];
          const event = currentEvents.find((e: any) => Number(e.event_id) === eventIdNum);
          
          if (event) {
            console.log(`Trying to filter by event name "${event.event_name}" for eventId=${eventId}`);
            filtered = matchupsData.filter((m: any) => 
              m.event_name && m.event_name.includes(event.event_name)
            );
            console.log(`Found ${filtered.length} matchups by event name`);
          }
        }
      }
      
      setMatchups(filtered);
      if (filtered.length > 0) setLastUpdateTime(filtered[0].data_golf_update_time);
      else setLastUpdateTime(null);
      
      // Now that we have matchups, fetch the player stats
      if (filtered.length > 0) {
        await fetchPlayerStats(filtered);
      }
      
    } catch (err: any) {
      console.error("Error in fetchMatchupsFromApi:", err);
      setError(err.message);
      setMatchups([]);
      setLastUpdateTime(null);
    } finally {
      setLoading(false);
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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

  const formatOdds = (odds: number | null, fallbackOdds: number | null = null): string => {
    // First try the primary odds source (typically FanDuel)
    if (odds !== null && odds !== undefined && odds > 1) {
      return decimalToAmerican(odds);
    }
    // If primary odds aren't available, try the fallback (typically DataGolf)
    if (fallbackOdds !== null && fallbackOdds !== undefined && fallbackOdds > 1) {
      return decimalToAmerican(fallbackOdds);
    }
    // If no valid odds are available
    return "-";
  };

  const formatPlayerName = (name: string): string => {
    return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name ?? "";
  };

  // Calculate if the odds gap exceeds the threshold
  const hasSignificantOddsGap = (playerOdds: number | null, referenceOdds: number | null): boolean => {
    if (!playerOdds || !referenceOdds || playerOdds <= 1 || referenceOdds <= 1) return false;
<<<<<<< HEAD
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
=======
    
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
    
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
    // For the comparison to be meaningful, we're looking for significant discrepancies
    // where the player's odds are notably different from the second-best player
    return diff >= oddsGapThreshold;
  };

<<<<<<< HEAD
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
=======
  if (loading) {
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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


  // Filter matchups by type, event_id, and odds availability
  const filteredMatchups = (matchups ?? []).filter(matchup => {
    // First, make sure we're only looking at matchups for the selected event
    const isCorrectEvent = String(matchup.event_id) === String(eventId);
    if (!isCorrectEvent) {
      return false;
    }
    
    // Then, ensure we're only looking at matchups of the requested type
    const isCorrectType = 
      (matchupType === "3ball" && (matchup as any).type === "3ball") || 
      (matchupType === "2ball" && (matchup as any).type === "2ball");
    
    if (!isCorrectType) {
      return false;
    }
    
    // Now check if there are valid odds for the players
    if ((matchup as any).type === "3ball") {
      // For 3ball matchups, check if all three players have valid odds
      const m3 = matchup as any;
      const p1HasOdds = Number(m3.odds1 ?? 0) > 1 || Number(m3.dg_odds1 ?? 0) > 1;
      const p2HasOdds = Number(m3.odds2 ?? 0) > 1 || Number(m3.dg_odds2 ?? 0) > 1;
      const p3HasOdds = Number(m3.odds3 ?? 0) > 1 || Number(m3.dg_odds3 ?? 0) > 1;
      
      // For 3ball matchups, we need odds for all three players
      return p1HasOdds && p2HasOdds && p3HasOdds;
    } else {
      // For 2ball matchups, check if both players have valid odds from any source
      const m2 = matchup as any;
      const p1HasOdds = Number(m2.odds1 ?? 0) > 1 || Number(m2.dg_odds1 ?? 0) > 1;
      const p2HasOdds = Number(m2.odds2 ?? 0) > 1 || Number(m2.dg_odds2 ?? 0) > 1;
      
      // We only need odds for the two players in a 2ball matchup
      return p1HasOdds && p2HasOdds;
    }
  });
  
  // Debug the event filtering
  console.log(`Filtered matchups for event_id ${eventId} and type ${matchupType}: ${filteredMatchups?.length}`);
  if (filteredMatchups?.length) {
    console.log(`First filtered matchup: event_id=${filteredMatchups[0].event_id}, type=${filteredMatchups[0].type}, name=${filteredMatchups[0].event_name}`);
  } else if (matchups?.length) {
    // If we have no filtered matchups but we do have matchups, log details about the event_ids we received
    const eventIds = [...new Set((matchups ?? []).map(m => m.event_id))];
    console.log(`No matchups after filtering. Available event_ids: ${eventIds.join(', ')}`);
    
    const typeMatchups = (matchups ?? []).filter(m => (m as any).type === matchupType);
    console.log(`Matchups of type ${matchupType}: ${typeMatchups.length}`);
    
    if (typeMatchups.length > 0) {
      const typeEventIds = [...new Set(typeMatchups.map(m => m.event_id))];
      console.log(`Event IDs for ${matchupType} matchups: ${typeEventIds.join(', ')}`);
    }
  }
  
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
<<<<<<< HEAD
                        if (oddsGapThreshold > 0 && (filteredMatchups ?? []).length > 0) {
                          const highlightedCount = (filteredMatchups ?? []).reduce((count, matchup) => {
                            if (isSupabaseMatchupRow(matchup)) {
                              const players = [
                                { id: 'p1', odds: (matchup as SupabaseMatchupRow).odds1 },
                                { id: 'p2', odds: (matchup as SupabaseMatchupRow).odds2 },
                                { id: 'p3', odds: (matchup as SupabaseMatchupRow).odds3 }
=======
                        if (oddsGapThreshold > 0 && matchups.length > 0) {
                          const highlightedCount = matchups.reduce((count, matchup) => {
                            if (is3BallMatchup(matchup)) {
                              // For 3-ball, calculate gaps using the same logic as in the render
                              const players = [
                                { id: 'p1', odds: matchup.fanduel_p1_odds },
                                { id: 'p2', odds: matchup.fanduel_p2_odds },
                                { id: 'p3', odds: matchup.fanduel_p3_odds }
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                              ].filter(p => p.odds && p.odds > 1);
                              
                              if (players.length >= 3) {
                                players.sort((a, b) => (a.odds || 999) - (b.odds || 999));
                                const favorite = players[0];
                                const otherPlayers = players.slice(1);
                                
                                const hasGapAgainstAll = otherPlayers.every(other => 
<<<<<<< HEAD
                                  hasSignificantOddsGap(favorite.odds ?? null, other.odds ?? null)
=======
                                  hasSignificantOddsGap(favorite.odds, other.odds)
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                                );
                                
                                if (hasGapAgainstAll) count++;
                              }
<<<<<<< HEAD
                            } else if (isSupabaseMatchupRow2Ball(matchup)) {
                              const m2 = matchup as SupabaseMatchupRow2Ball;
                              const fdP1Odds = Number(m2.odds1 ?? 0);
                              const fdP2Odds = Number(m2.odds2 ?? 0);
                              
                              if (fdP1Odds > 1 && fdP2Odds > 1) {
                                if ((fdP1Odds < fdP2Odds && hasSignificantOddsGap(fdP1Odds, fdP2Odds)) || 
                                    (fdP2Odds < fdP1Odds && hasSignificantOddsGap(fdP2Odds, fdP1Odds))) {
=======
                            } else {
                              // For 2-ball matchups
                              const p1Odds = matchup.fanduel_p1_odds || 0;
                              const p2Odds = matchup.fanduel_p2_odds || 0;
                              
                              if (p1Odds > 1 && p2Odds > 1) {
                                if ((p1Odds < p2Odds && hasSignificantOddsGap(p1Odds, p2Odds)) || 
                                    (p2Odds < p1Odds && hasSignificantOddsGap(p2Odds, p1Odds))) {
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
<<<<<<< HEAD
=======
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
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
<<<<<<< HEAD
                  {filteredMatchups.map((matchup) => {
                    if (!matchup.uuid) return null; // Strict: only render if uuid exists
                    if (isSupabaseMatchupRow(matchup)) {
                      // DataGolf odds are only available in the SupabaseMatchupRow type
                      const dg_p1_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds1 ?? null : null;
                      const dg_p2_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds2 ?? null : null;
                      const dg_p3_odds = isSupabaseMatchupRow(matchup) ? (matchup as SupabaseMatchupRow).dg_odds3 ?? null : null;
                      
                      // Check both for divergence and significant odds gaps
                      // We're inside the isSupabaseMatchupRow branch so these props exist
=======
                  {matchups.map((matchup, index) => {
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
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
                      
<<<<<<< HEAD
                      // For odds arrays - we're already inside isSupabaseMatchupRow guard branch
                      const fdPlayers = [
                        { id: 'p1', odds: (matchup as SupabaseMatchupRow).odds1, name: (matchup as SupabaseMatchupRow).player1_name },
                        { id: 'p2', odds: (matchup as SupabaseMatchupRow).odds2, name: (matchup as SupabaseMatchupRow).player2_name },
                        { id: 'p3', odds: (matchup as SupabaseMatchupRow).odds3, name: (matchup as SupabaseMatchupRow).player3_name ?? '' }
=======
                      // Calculate FanDuel gaps
                      const fdPlayers = [
                        { id: 'p1', odds: matchup.fanduel_p1_odds, name: matchup.p1_player_name },
                        { id: 'p2', odds: matchup.fanduel_p2_odds, name: matchup.p2_player_name },
                        { id: 'p3', odds: matchup.fanduel_p3_odds, name: matchup.p3_player_name }
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
<<<<<<< HEAD
                        { id: 'p1', odds: dg_p1_odds, name: (matchup as SupabaseMatchupRow).player1_name ?? '' },
                        { id: 'p2', odds: dg_p2_odds, name: (matchup as SupabaseMatchupRow).player2_name ?? '' },
                        { id: 'p3', odds: dg_p3_odds, name: (matchup as SupabaseMatchupRow).player3_name ?? '' }
=======
                        { id: 'p1', odds: dg_p1_odds, name: matchup.p1_player_name },
                        { id: 'p2', odds: dg_p2_odds, name: matchup.p2_player_name },
                        { id: 'p3', odds: dg_p3_odds, name: matchup.p3_player_name }
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
                      
<<<<<<< HEAD
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
=======
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
                        const playerStat = playerStats[playerId];
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
                          
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                        return { position, score };
                      };
                      
                      return (
<<<<<<< HEAD
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
                                          if (typeof player.dg_id !== 'string' || player.dg_id.length === 0) return;
                                          addSelection({
                                            id: player.dg_id,
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
=======
                        <TableRow key={`3ball-${key}`}>
                          <TableCell>
                            {sortedPlayers.map((player, idx) => (
                              <div key={`player-${idx}`} className="py-1 h-8 flex items-center">{formatPlayerName(player.name)}</div>
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                            ))}
                          </TableCell>
                          
                          {/* New Position column */}
                          <TableCell className="text-center">
                            {sortedPlayers.map((player, idx) => {
<<<<<<< HEAD
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
=======
                              const playerId = player.id === 'p1' ? matchup.p1_dg_id : 
                                             player.id === 'p2' ? matchup.p2_dg_id : 
                                             player.id === 'p3' ? matchup.p3_dg_id : 0;
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                              
                              const positionData = formatPlayerPosition(playerId);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
<<<<<<< HEAD
=======
                                  {positionData ? (
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
<<<<<<< HEAD
=======
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
<<<<<<< HEAD
                            {sortedPlayers.map((player: typeof sortedPlayers[number], idx: number) => {
                              const formatted = formatOdds(player.odds ?? null, player.dgOdds ?? null);
                              return (
                                <div key={`odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasGap ? "font-bold text-green-400" : ""}`}>{formatted}</div>
                              );
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            {sortedPlayers.map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`dg-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDGGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dgOdds ?? null)}
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
                                          if (typeof player.dg_id !== 'string' || player.dg_id.length === 0) return;
                                          addSelection({
                                            id: player.dg_id,
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
                              
                              const positionData = formatPlayerPosition(playerId);
                              
                              return (
                                <div key={`position-${idx}`} className="py-1 h-8 flex items-center justify-center">
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
                                </div>
                              );
                            })}
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {sortedPlayers.map((player: typeof sortedPlayers[number], idx: number) => {
                              const formatted = formatOdds(player.odds ?? null, player.dkOdds ?? null);
                              return (
                                <div key={`odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasGap ? "font-bold text-green-400" : ""}`}>
                                  {formatted}
                                </div>
                              );
                            })}
                          </TableCell>
                          <TableCell className="text-center">
                            {sortedPlayers.map((player: typeof sortedPlayers[number], idx: number) => (
                              <div key={`dk-odds-${idx}`} className={`py-1 h-8 flex items-center justify-center ${player.hasDKGap ? "font-bold text-green-400" : ""}`}>
                                {formatOdds(player.dkOdds ?? null)}
=======
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
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
                              </div>
                            ))}
                          </TableCell>
                        </TableRow>
                      );
                    } else {
<<<<<<< HEAD
                      return null;
=======
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
                        const playerStat = playerStats[playerId];
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
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32
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
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
import { Loader2, AlertTriangle, DollarSign } from "lucide-react"
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
import { detect3BallDivergence } from "@/lib/utils"

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

// Combined type for both matchup types
type MatchupRow = SupabaseMatchupRow | SupabaseMatchupRow2Ball;

export default function MatchupsTable({ 
  eventId, 
  matchupType = "3ball" 
}: { 
  eventId: number | null;
  matchupType?: "2ball" | "3ball";
}) {
  const [matchups, setMatchups] = useState<MatchupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel">("fanduel");
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [activeMatchupType, setActiveMatchupType] = useState<"2ball" | "3ball">(matchupType);

  useEffect(() => {
    // Reset state before fetching new data
    setMatchups([]);
    setLoading(true);
    setError(null);
    
    // For debugging - print event ID
    console.log("Current eventId in MatchupsTable:", eventId, 
                "activeMatchupType:", activeMatchupType);
    
    fetchMatchupsFromApi();
  }, [eventId, activeMatchupType]);

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
      
    } catch (err: any) {
      console.error("Error in fetchMatchupsFromApi:", err);
      setError(err.message);
      setMatchups([]);
      setLastUpdateTime(null);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
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

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
          <div className="text-red-500">Error: {error}</div>
          <Button onClick={fetchMatchupsFromApi} className="mt-4">Try Again</Button>
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
                {matchups.length > 0 && <p className="text-sm text-gray-400">Event: {matchups[0].event_name}</p>}
              </div>
              <div className="flex items-center gap-2">
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
          {matchups.length > 0 ? (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              <Table>
                <TableHeader className="bg-[#1e1e23]">
                  <TableRow>
                    <TableHead className="text-white text-center">Players</TableHead>
                    <TableHead className="text-white text-center">FanDuel Odds</TableHead>
                    <TableHead className="text-white text-center">
                      {activeMatchupType === "3ball" ? "Data Golf Odds" : "DraftKings Odds"}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchups.map((matchup, index) => {
                    // Generate a stable key - use id if available, otherwise use index and a type identifier
                    const key = matchup.id ? `matchup-${matchup.id}` : `matchup-${index}-${matchup.p1_dg_id}-${matchup.p2_dg_id}`;
                    
                    // Handle 3-ball matchups
                    if (is3BallMatchup(matchup)) {
                      const dg_p1_odds = matchup.datagolf_p1_odds ?? matchup.odds?.datagolf?.p1 ?? null;
                      const dg_p2_odds = matchup.datagolf_p2_odds ?? matchup.odds?.datagolf?.p2 ?? null;
                      const dg_p3_odds = matchup.datagolf_p3_odds ?? matchup.odds?.datagolf?.p3 ?? null;
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
                      return (
                        <TableRow key={`3ball-${key}`}>
                          <TableCell>
                            <div>{formatPlayerName(matchup.p1_player_name)}</div>
                            <div>{formatPlayerName(matchup.p2_player_name)}</div>
                            <div>{formatPlayerName(matchup.p3_player_name)}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center">
                              {formatOdds(matchup.fanduel_p1_odds)}
                              {divergence?.isDivergence && divergence.datagolfFavorite === 'p1' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 bg-green-600 text-green-100 rounded-full p-1 flex items-center justify-center cursor-pointer">
                                      <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">
                                    <span>
                                      Divergence: FanDuel favorite is <b>{
                                        divergence.fanduelFavorite === 'p1' ? formatPlayerName(matchup.p1_player_name) :
                                        divergence.fanduelFavorite === 'p2' ? formatPlayerName(matchup.p2_player_name) :
                                        divergence.fanduelFavorite === 'p3' ? formatPlayerName(matchup.p3_player_name) :
                                        'N/A'
                                      }</b>, Data Golf favorite is <b>{
                                        formatPlayerName(matchup.p1_player_name)
                                      }</b>.
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="ml-1 p-1 flex items-center justify-center invisible">
                                  <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-center">
                              {formatOdds(matchup.fanduel_p2_odds)}
                              {divergence?.isDivergence && divergence.datagolfFavorite === 'p2' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 bg-green-600 text-green-100 rounded-full p-1 flex items-center justify-center cursor-pointer">
                                      <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">
                                    <span>
                                      Divergence: FanDuel favorite is <b>{
                                        divergence.fanduelFavorite === 'p1' ? formatPlayerName(matchup.p1_player_name) :
                                        divergence.fanduelFavorite === 'p2' ? formatPlayerName(matchup.p2_player_name) :
                                        divergence.fanduelFavorite === 'p3' ? formatPlayerName(matchup.p3_player_name) :
                                        'N/A'
                                      }</b>, Data Golf favorite is <b>{
                                        formatPlayerName(matchup.p2_player_name)
                                      }</b>.
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="ml-1 p-1 flex items-center justify-center invisible">
                                  <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-center">
                              {formatOdds(matchup.fanduel_p3_odds)}
                              {divergence?.isDivergence && divergence.datagolfFavorite === 'p3' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="ml-1 bg-green-600 text-green-100 rounded-full p-1 flex items-center justify-center cursor-pointer">
                                      <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="z-50">
                                    <span>
                                      Divergence: FanDuel favorite is <b>{
                                        divergence.fanduelFavorite === 'p1' ? formatPlayerName(matchup.p1_player_name) :
                                        divergence.fanduelFavorite === 'p2' ? formatPlayerName(matchup.p2_player_name) :
                                        divergence.fanduelFavorite === 'p3' ? formatPlayerName(matchup.p3_player_name) :
                                        'N/A'
                                      }</b>, Data Golf favorite is <b>{
                                        formatPlayerName(matchup.p3_player_name)
                                      }</b>.
                                    </span>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="ml-1 p-1 flex items-center justify-center invisible">
                                  <DollarSign size={14} className="text-green-100" aria-label="Data Golf value" />
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>{formatOdds(dg_p1_odds)}</div>
                            <div>{formatOdds(dg_p2_odds)}</div>
                            <div>{formatOdds(dg_p3_odds)}</div>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // Handle 2-ball matchups
                      return (
                        <TableRow key={`2ball-${key}`}>
                          <TableCell>
                            <div>{formatPlayerName(matchup.p1_player_name)}</div>
                            <div>{formatPlayerName(matchup.p2_player_name)}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="py-1">{formatOdds(matchup.fanduel_p1_odds)}</div>
                            <div className="py-1">{formatOdds(matchup.fanduel_p2_odds)}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="py-1">{formatOdds(matchup.draftkings_p1_odds)}</div>
                            <div className="py-1">{formatOdds(matchup.draftkings_p2_odds)}</div>
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

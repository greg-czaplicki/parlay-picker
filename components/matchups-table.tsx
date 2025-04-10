"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

// Interface matching the Supabase table structure
interface SupabaseMatchupRow {
  id: number // Assuming Supabase adds an id
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
}

// Initialize Supabase client (Use public variables for client-side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing in client-side environment variables.",
  );
  // Handle this error appropriately in your UI, maybe show a message
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // Add non-null assertion or proper handling

const PAGE_SIZE = 10;

// Helper function for relative time
function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const now = new Date();
  const past = new Date(isoTimestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  // Show minutes if less than 120 minutes (2 hours)
  if (diffInMinutes < 120) return `${diffInMinutes}m ago`;

  // 120 minutes or more, show hours (rounded down)
  const diffInHours = Math.floor(diffInMinutes / 60);
  return `${diffInHours}h ago`; // For longer durations, consider days or using a library
}

// Remove props from component definition
export default function MatchupsTable() {
  const [matchups, setMatchups] = useState<SupabaseMatchupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshingApi, setIsRefreshingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel" | "draftkings">("fanduel");
  const [totalCount, setTotalCount] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);

  useEffect(() => {
    fetchMatchupsFromSupabase();
  }, []); // Fetch only on initial mount

  const fetchMatchupsFromSupabase = async () => {
    if (!isRefreshingApi) {
        setLoading(true);
    }
    setError(null);
    let fetchedTimestamp: string | null = null;
    try {
      // Fetch the latest event name first
      const { data: latestEventData, error: eventError } = await supabase
          .from('latest_three_ball_matchups')
          .select('event_name')
          .order('data_golf_update_time', { ascending: false })
          .limit(1)
          .single();

      if (eventError) throw eventError;
      if (!latestEventData) {
          setMatchups([]);
          setTotalCount(0);
          setCurrentEvent(null);
          console.log("No matchup data found in Supabase.")
          setLastUpdateTime(null); // Set timestamp state
          return;
      }

      const eventName = latestEventData.event_name;
      setCurrentEvent(eventName);

      // Fetch matchups for the latest event
      const { data, error: dataError, count } = await supabase
        .from("latest_three_ball_matchups")
        .select("*", { count: "exact" })
        .eq('event_name', eventName)
        .order("data_golf_update_time", { ascending: false }) // Order by time to easily get latest
        .order("p1_player_name", { ascending: true }); // Secondary sort for display

      if (dataError) throw dataError;

      setMatchups(data || []);
      setTotalCount(count || 0);

      // Get and set the timestamp state
      if (data && data.length > 0) {
          fetchedTimestamp = data[0].data_golf_update_time;
      }
      setLastUpdateTime(fetchedTimestamp); // Set timestamp state

    } catch (err: any) {
      console.error("Error fetching matchups from Supabase:", err);
      setError(`Failed to fetch matchups: ${err.message}`);
      setMatchups([]);
      setTotalCount(0);
      setLastUpdateTime(null); // Set timestamp state on error
    } finally {
      if (!isRefreshingApi) {
          setLoading(false);
      }
    }
  };

  // Function to trigger API refresh and then re-fetch data for the table
  const triggerApiRefreshAndRefetch = async () => {
    setIsRefreshingApi(true);
    setLastUpdateTime(null); // Indicate update is in progress
    try {
      const response = await fetch("/api/matchups/3ball");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Matchups Refreshed",
          description: `${data.processedCount} 3-ball matchups updated from Data Golf.`,
        });
        // After successful API update, re-fetch data for the table display
        await fetchMatchupsFromSupabase();
      } else {
        throw new Error(data.error || "Unknown error occurred during refresh");
      }
    } catch (error) {
      console.error("Error refreshing matchups via API:", error);
      toast({
        title: "Error Refreshing Matchups",
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      });
      // Optionally attempt to fetch existing data even if API refresh failed
      // await fetchMatchupsFromSupabase();
    } finally {
      setIsRefreshingApi(false);
    }
  };

  // Pagination logic - use 'matchups' state directly (which now contains only latest)
  const pageCount = Math.ceil(matchups.length / PAGE_SIZE);
  const displayData = useMemo(() => {
      // Use matchups directly for pagination
      return matchups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  // Update dependency array
  }, [matchups, page]);

  // Helper function to convert Decimal odds to American odds
  const decimalToAmerican = (decimalOdds: number): string => {
    if (decimalOdds >= 2.0) {
      return `+${Math.round((decimalOdds - 1) * 100)}`;
    } else if (decimalOdds > 1.0) {
      return `${Math.round(-100 / (decimalOdds - 1))}`;
    } else {
      // Handle edge cases or invalid odds if necessary
      return "N/A"; // Or however you want to display invalid/push odds
    }
  };

  // Format odds for display using the conversion function
  const formatOdds = (odds: number | null): string => {
    if (odds === null || odds === undefined || odds <= 1) return "-"; // Handle null or odds indicating no payout
    return decimalToAmerican(odds);
  };

  const formatPlayerName = (name: string): string => {
      return name.split(",").reverse().join(" ").trim();
  }

  if (loading && matchups.length === 0) {
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
          <Button onClick={fetchMatchupsFromSupabase} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
             <h2 className="text-xl font-bold">3-Ball Matchups</h2>
             {currentEvent && <p className="text-sm text-gray-400">Event: {currentEvent}</p>}
          </div>
          <div className="flex items-center gap-3">
            {/* Bookmaker Buttons */}
            <Button
              variant={selectedBookmaker === "draftkings" ? "default" : "outline"}
              onClick={() => { setSelectedBookmaker("draftkings"); setPage(0); }}
              className={`text-sm ${selectedBookmaker === "draftkings" ? "filter-button-active" : "filter-button"}`}
            >
              DraftKings
            </Button>
            <Button
              variant={selectedBookmaker === "fanduel" ? "default" : "outline"}
              onClick={() => { setSelectedBookmaker("fanduel"); setPage(0); }}
              className={`text-sm ${selectedBookmaker === "fanduel" ? "filter-button-active" : "filter-button"}`}
            >
              FanDuel
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={triggerApiRefreshAndRefetch}
                disabled={isRefreshingApi || loading}
                className="flex items-center gap-2 bg-[#1e1e23] border-none h-9"
                title="Refresh odds from Data Golf API"
            >
                 {(isRefreshingApi || (loading && !lastUpdateTime)) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
             {/* Last Updated Timestamp - Add context */}
            {lastUpdateTime && !isRefreshingApi && (
              <span className="text-xs text-gray-400 whitespace-nowrap" title={`Data Golf feed last updated at ${new Date(lastUpdateTime).toLocaleString()}`}>
                DG Feed: {formatRelativeTime(lastUpdateTime)}
              </span>
            )}
            {isRefreshingApi && (
                 <span className="text-xs text-gray-500 whitespace-nowrap">Updating...</span>
            )}
          </div>
        </div>

        {displayData.length > 0 ? (
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <Table>
              <TableHeader className="bg-[#1e1e23]">
                <TableRow>
                  <TableHead className="text-white text-center">Players</TableHead>
                  {selectedBookmaker === 'fanduel' && (
                    <TableHead className="text-white text-center">FanDuel Odds</TableHead>
                  )}
                  {selectedBookmaker === 'draftkings' && (
                    <TableHead className="text-white text-center">DraftKings Odds</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayData.map((matchup) => (
                  <TableRow key={matchup.id} className="hover:bg-[#2a2a35]">
                    <TableCell>
                      <div>{formatPlayerName(matchup.p1_player_name)}</div>
                      <div>{formatPlayerName(matchup.p2_player_name)}</div>
                      <div>{formatPlayerName(matchup.p3_player_name)}</div>
                    </TableCell>
                    {selectedBookmaker === 'fanduel' && (
                      <TableCell className="text-center">
                        <div>{formatOdds(matchup.fanduel_p1_odds)}</div>
                        <div>{formatOdds(matchup.fanduel_p2_odds)}</div>
                        <div>{formatOdds(matchup.fanduel_p3_odds)}</div>
                      </TableCell>
                    )}
                    {selectedBookmaker === 'draftkings' && (
                      <TableCell className="text-center">
                        <div>{formatOdds(matchup.draftkings_p1_odds)}</div>
                        <div>{formatOdds(matchup.draftkings_p2_odds)}</div>
                        <div>{formatOdds(matchup.draftkings_p3_odds)}</div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-gray-400">No matchups found for the selected criteria{currentEvent ? ` for ${currentEvent}`: ""}.</p>
             {matchups.length === 0 && !loading && (
                <p className="text-sm text-gray-500 mt-2">Try running the data fetching API route first: /api/matchups/3ball</p>
            )}
          </div>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-center space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="bg-[#2a2a35] border-none hover:bg-[#34343f]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-gray-400">
              Page {page + 1} of {pageCount}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page === pageCount - 1}
              className="bg-[#2a2a35] border-none hover:bg-[#34343f]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

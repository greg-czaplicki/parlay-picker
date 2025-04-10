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
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

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

// Add type for skill ratings (can import if defined elsewhere)
type PlayerSkillRating = {
  dg_id: number;
  player_name: string;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  // Add other fields if needed by heatmap/tooltip
};

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

// Helper function to convert decimal odds to implied probability
function decimalToImpliedProbability(decimalOdds: number | null): number {
    if (decimalOdds === null || decimalOdds <= 1) return 0;
    return 1 / decimalOdds;
}

// Function to get dynamic highlight class based on probability difference magnitude
function getHighlightIntensityClass(probDiff: number): string {
    // Example scale: Higher diff -> more intense green
    if (probDiff >= 0.20) { // 20%+ diff
        return "bg-green-600/80"; // Most intense
    } else if (probDiff >= 0.15) { // 15-20% diff
        return "bg-green-700/70";
    } else if (probDiff >= 0.10) { // 10-15% diff
        return "bg-green-700/50";
    } else { // Below 10% (but still meeting threshold)
        return "bg-green-800/40"; // Least intense
    }
}

// Remove props from component definition
export default function MatchupsTable() {
  const [matchups, setMatchups] = useState<SupabaseMatchupRow[]>([]);
  const [skillRatingsMap, setSkillRatingsMap] = useState<Map<number, PlayerSkillRating>>(new Map()); // State for skills
  const [loadingMatchups, setLoadingMatchups] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(true); // Separate loading state
  const [isRefreshingApi, setIsRefreshingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel" | "draftkings">("fanduel");
  const [totalCount, setTotalCount] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  // Revert state back to probability difference
  const [probDiffThreshold, setProbDiffThreshold] = useState<number>(10); // Default to 10%

  // Combined loading state
  const loading = loadingMatchups || loadingSkills;

  useEffect(() => {
    fetchMatchupsFromSupabase();
    fetchSkillRatings(); // Fetch skills on mount too
  }, []);

  const fetchMatchupsFromSupabase = async () => {
    if (!isRefreshingApi) {
        setLoadingMatchups(true);
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
          setLoadingMatchups(false);
      }
    }
  };

  const fetchSkillRatings = async () => {
      setLoadingSkills(true);
      try {
          const { data, error } = await supabase
              .from("player_skill_ratings")
              .select("dg_id, player_name, sg_total, sg_ott, sg_app, sg_arg, sg_putt"); // Select needed fields

          if (error) throw error;

          const map = new Map<number, PlayerSkillRating>();
          (data || []).forEach(skill => {
              map.set(skill.dg_id, skill);
          });
          setSkillRatingsMap(map);

      } catch(error: any) {
          console.error("Error fetching skill ratings:", error);
          toast({ title: "Error loading player skills", description: error.message, variant: "destructive"});
          // Don't clear map, maybe previous data is still useful?
      } finally {
          setLoadingSkills(false);
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
        // Optional: await fetchSkillRatings(); // Re-fetch skills too?
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

  // Use matchups directly for display
  const displayData = matchups;

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

  // Calculate Percentiles based on players *in the current matchups*
  const matchupSkillPercentiles = useMemo(() => {
    if (matchups.length === 0 || skillRatingsMap.size === 0) return {};

    // Get unique player IDs from the matchups
    const playerIdsInMatchups = new Set<number>();
    matchups.forEach(m => {
        playerIdsInMatchups.add(m.p1_dg_id);
        playerIdsInMatchups.add(m.p2_dg_id);
        playerIdsInMatchups.add(m.p3_dg_id);
    });

    // Get skill ratings only for these players
    const relevantSkills: PlayerSkillRating[] = [];
    playerIdsInMatchups.forEach(id => {
        const skills = skillRatingsMap.get(id);
        if (skills) {
            relevantSkills.push(skills);
        }
    });

    if (relevantSkills.length === 0) return {};

    const calculatePercentiles = (values: (number | null)[]) => {
        // ... (same percentile calculation logic as before) ...
        const validValues = values.filter(v => v !== null) as number[];
        if (validValues.length === 0) return new Map<number, number>();
        const sortedValues = [...validValues].sort((a, b) => a - b);
        const percentileMap = new Map<number, number>();
        sortedValues.forEach((value, index) => {
            if (!percentileMap.has(value)) {
                percentileMap.set(value, index / sortedValues.length);
            }
        });
        return percentileMap;
    };

    return {
        sg_total: calculatePercentiles(relevantSkills.map(p => p.sg_total)),
        sg_ott: calculatePercentiles(relevantSkills.map(p => p.sg_ott)),
        sg_app: calculatePercentiles(relevantSkills.map(p => p.sg_app)),
        sg_arg: calculatePercentiles(relevantSkills.map(p => p.sg_arg)),
        sg_putt: calculatePercentiles(relevantSkills.map(p => p.sg_putt)),
    };

  }, [matchups, skillRatingsMap]); // Depends on matchups and the skill map

  // getHeatmapColor function (similar to PlayerTable, adjust keys/percentile source if needed)
  const getHeatmapColor = (value: number | null, statKey: keyof typeof matchupSkillPercentiles, isHigherBetter = true) => {
    const currentPercentiles = matchupSkillPercentiles as Record<string, Map<number, number>>;
    if (value === null || !currentPercentiles[statKey]) return "bg-gray-700/20"; // Neutral for null
    const percentileMap = currentPercentiles[statKey];
    const percentile = percentileMap.get(value);
    if (percentile === undefined) return "bg-gray-600/30"; // Fallback if not found
    const adjustedPercentile = isHigherBetter ? percentile : 1 - percentile;

    // Use a simpler scale for small squares?
    if (adjustedPercentile >= 0.80) return "bg-green-500"; // Top 20%
    else if (adjustedPercentile >= 0.60) return "bg-emerald-600"; // 60-80%
    else if (adjustedPercentile >= 0.40) return "bg-yellow-600"; // 40-60%
    else if (adjustedPercentile >= 0.20) return "bg-orange-600"; // 20-40%
    else return "bg-red-600"; // Bottom 20%
  };

  // Helper component for the heatmap square with tooltip
  const HeatmapSquare = ({ statValue, statKey, label }: { statValue: number | null, statKey: keyof typeof matchupSkillPercentiles, label: string }) => {
    const colorClass = getHeatmapColor(statValue, statKey);
    const valueString = statValue !== null ? statValue.toFixed(2) : 'N/A';
    return (
      <div
        title={`${label}: ${valueString}`}
        className={`w-2.5 h-2.5 rounded-sm inline-block ${colorClass}`}
      />
    );
  };

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
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">3-Ball Matchups</h2>
              {currentEvent && <p className="text-sm text-gray-400">Event: {currentEvent}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex items-center gap-3">
            <Button
                variant={selectedBookmaker === "draftkings" ? "default" : "outline"}
                onClick={() => { setSelectedBookmaker("draftkings"); }}
                className={`text-sm ${selectedBookmaker === "draftkings" ? "filter-button-active" : "filter-button"}`}
            >
              DraftKings
            </Button>
            <Button
                variant={selectedBookmaker === "fanduel" ? "default" : "outline"}
                onClick={() => { setSelectedBookmaker("fanduel"); }}
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
              {lastUpdateTime && !isRefreshingApi && (
                <span className="text-xs text-gray-400 whitespace-nowrap" title={`Data Golf feed last updated at ${new Date(lastUpdateTime).toLocaleString()}`}>
                  DG Feed: {formatRelativeTime(lastUpdateTime)}
                </span>
              )}
              {isRefreshingApi && (
                <span className="text-xs text-gray-500 whitespace-nowrap">Updating...</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-grow min-w-[200px]">
              <Label htmlFor="prob-slider" className="text-sm whitespace-nowrap">Min Prob Diff:</Label>
              <Slider
                id="prob-slider"
                min={0}
                max={30} // Back to 0-30 %
                step={1}
                value={[probDiffThreshold]}
                onValueChange={(value) => setProbDiffThreshold(value[0])}
                className="w-full max-w-[150px]"
              />
              <span className="text-sm font-medium w-8 text-right">{probDiffThreshold}%</span>
            </div>
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
                {displayData.map((matchup) => {
                  const p1_odds = selectedBookmaker === 'fanduel' ? matchup.fanduel_p1_odds : matchup.draftkings_p1_odds;
                  const p2_odds = selectedBookmaker === 'fanduel' ? matchup.fanduel_p2_odds : matchup.draftkings_p2_odds;
                  const p3_odds = selectedBookmaker === 'fanduel' ? matchup.fanduel_p3_odds : matchup.draftkings_p3_odds;

                  const prob1 = decimalToImpliedProbability(p1_odds);
                  const prob2 = decimalToImpliedProbability(p2_odds);
                  const prob3 = decimalToImpliedProbability(p3_odds);

                  const threshold = probDiffThreshold / 100;

                  // Determine highlighting and calculate the difference for highlighted player
                  let highlightP1 = false, highlightP2 = false, highlightP3 = false;
                  let p1Diff = 0, p2Diff = 0, p3Diff = 0;

                  if (prob1 > 0 && prob1 >= prob2 + threshold && prob1 >= prob3 + threshold) {
                      highlightP1 = true;
                      // Calculate the minimum difference to the other two
                      p1Diff = Math.min(prob1 - prob2, prob1 - prob3);
                  }
                  if (prob2 > 0 && prob2 >= prob1 + threshold && prob2 >= prob3 + threshold) {
                      highlightP2 = true;
                      p2Diff = Math.min(prob2 - prob1, prob2 - prob3);
                  }
                  if (prob3 > 0 && prob3 >= prob1 + threshold && prob3 >= prob2 + threshold) {
                      highlightP3 = true;
                      p3Diff = Math.min(prob3 - prob1, prob3 - prob2);
                  }

                  // Get intensity classes based on the calculated difference
                  const intensityClassP1 = highlightP1 ? getHighlightIntensityClass(p1Diff) : "";
                  const intensityClassP2 = highlightP2 ? getHighlightIntensityClass(p2Diff) : "";
                  const intensityClassP3 = highlightP3 ? getHighlightIntensityClass(p3Diff) : "";

                  // --- Add logic to find player with best SG: Total ---
                  const p1_sg_total = skillRatingsMap.get(matchup.p1_dg_id)?.sg_total ?? -Infinity;
                  const p2_sg_total = skillRatingsMap.get(matchup.p2_dg_id)?.sg_total ?? -Infinity;
                  const p3_sg_total = skillRatingsMap.get(matchup.p3_dg_id)?.sg_total ?? -Infinity;

                  const max_sg_total = Math.max(p1_sg_total, p2_sg_total, p3_sg_total);

                  // Check if max_sg_total is valid (not -Infinity)
                  const isValidMaxSg = max_sg_total > -Infinity;

                  const isBestSgP1 = isValidMaxSg && p1_sg_total === max_sg_total;
                  const isBestSgP2 = isValidMaxSg && p2_sg_total === max_sg_total;
                  const isBestSgP3 = isValidMaxSg && p3_sg_total === max_sg_total;
                  // ----------------------------------------------------

                  return (
                  <TableRow key={matchup.id} className="hover:bg-[#2a2a35]">
                    <TableCell>
                        {/* Player 1 */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                           {/* Always render container, hide icon conditionally */}
                           <span title={isBestSgP1 ? "Best SG: Total in Matchup" : ""} className={`inline-block w-[12px] ${isBestSgP1 ? 'opacity-100' : 'opacity-0'}`}>
                             <Award size={12} className="text-yellow-500 shrink-0" />
                            </span>
                           <span className={highlightP1 ? "font-semibold" : ""}>{formatPlayerName(matchup.p1_player_name)}</span>
                           {!loadingSkills && skillRatingsMap.has(matchup.p1_dg_id) && (
                             <>
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p1_dg_id)?.sg_total ?? null} statKey="sg_total" label="SG:Total" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p1_dg_id)?.sg_ott ?? null} statKey="sg_ott" label="SG:OTT" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p1_dg_id)?.sg_app ?? null} statKey="sg_app" label="SG:APP" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p1_dg_id)?.sg_arg ?? null} statKey="sg_arg" label="SG:ARG" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p1_dg_id)?.sg_putt ?? null} statKey="sg_putt" label="SG:PUTT" />
                              </>
                           )}
                          </div>
                         {/* Player 2 */}
                         <div className="flex items-center gap-1.5 mb-0.5">
                            {/* Always render container, hide icon conditionally */}
                           <span title={isBestSgP2 ? "Best SG: Total in Matchup" : ""} className={`inline-block w-[12px] ${isBestSgP2 ? 'opacity-100' : 'opacity-0'}`}>
                             <Award size={12} className="text-yellow-500 shrink-0" />
                           </span>
                           <span className={highlightP2 ? "font-semibold" : ""}>{formatPlayerName(matchup.p2_player_name)}</span>
                            {!loadingSkills && skillRatingsMap.has(matchup.p2_dg_id) && (
                             <>
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p2_dg_id)?.sg_total ?? null} statKey="sg_total" label="SG:Total" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p2_dg_id)?.sg_ott ?? null} statKey="sg_ott" label="SG:OTT" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p2_dg_id)?.sg_app ?? null} statKey="sg_app" label="SG:APP" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p2_dg_id)?.sg_arg ?? null} statKey="sg_arg" label="SG:ARG" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p2_dg_id)?.sg_putt ?? null} statKey="sg_putt" label="SG:PUTT" />
                              </>
                           )}
                      </div>
                         {/* Player 3 */}
                         <div className="flex items-center gap-1.5">
                            {/* Always render container, hide icon conditionally */}
                            <span title={isBestSgP3 ? "Best SG: Total in Matchup" : ""} className={`inline-block w-[12px] ${isBestSgP3 ? 'opacity-100' : 'opacity-0'}`}>
                             <Award size={12} className="text-yellow-500 shrink-0" />
                            </span>
                           <span className={highlightP3 ? "font-semibold" : ""}>{formatPlayerName(matchup.p3_player_name)}</span>
                           {!loadingSkills && skillRatingsMap.has(matchup.p3_dg_id) && (
                             <>
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p3_dg_id)?.sg_total ?? null} statKey="sg_total" label="SG:Total" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p3_dg_id)?.sg_ott ?? null} statKey="sg_ott" label="SG:OTT" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p3_dg_id)?.sg_app ?? null} statKey="sg_app" label="SG:APP" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p3_dg_id)?.sg_arg ?? null} statKey="sg_arg" label="SG:ARG" />
                                <HeatmapSquare statValue={skillRatingsMap.get(matchup.p3_dg_id)?.sg_putt ?? null} statKey="sg_putt" label="SG:PUTT" />
                              </>
                           )}
                      </div>
                    </TableCell>
                      {selectedBookmaker === 'fanduel' && (
                        <TableCell className="text-center">
                          <div className={intensityClassP1}>{formatOdds(matchup.fanduel_p1_odds)}</div>
                          <div className={intensityClassP2}>{formatOdds(matchup.fanduel_p2_odds)}</div>
                          <div className={intensityClassP3}>{formatOdds(matchup.fanduel_p3_odds)}</div>
                    </TableCell>
                      )}
                      {selectedBookmaker === 'draftkings' && (
                        <TableCell className="text-center">
                           <div className={intensityClassP1}>{formatOdds(matchup.draftkings_p1_odds)}</div>
                           <div className={intensityClassP2}>{formatOdds(matchup.draftkings_p2_odds)}</div>
                           <div className={intensityClassP3}>{formatOdds(matchup.draftkings_p3_odds)}</div>
                    </TableCell>
                      )}
                  </TableRow>
                  );
                })}
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
      </CardContent>
    </Card>
  );
}

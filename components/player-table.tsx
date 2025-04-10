"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
  type Row,
  type Column,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, ChevronUp, RefreshCw, Loader2, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

// Type for Season Skill Ratings
type PlayerSkillRating = {
  dg_id: number;
  player_name: string;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  driving_acc: number | null;
  driving_dist: number | null;
  data_golf_updated_at: string | null;
  updated_at: string;
}

// Type for Live Tournament Stats (from View)
type LiveTournamentStat = {
  dg_id: number;
  player_name: string;
  event_name: string;
  course_name: string;
  round_num: string; // "event_avg"
  sg_app: number | null;
  sg_ott: number | null;
  sg_putt: number | null;
  sg_t2g: number | null;
  sg_total: number | null;
  accuracy: number | null;
  distance: number | null;
  gir: number | null;
  prox_fw: number | null;
  scrambling: number | null;
  "position": string | null;
  thru: number | null;
  today: number | null;
  total: number | null;
  data_golf_updated_at: string | null;
  fetched_at: string | null; // from historical table, might be null if view definition changes
  sg_arg: number | null;
}

// Combined type for table display flexibility (optional, could use union)
type DisplayPlayer = Partial<PlayerSkillRating> & Partial<LiveTournamentStat> & { dg_id: number; player_name: string };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing in client-side environment variables.",
  );
}
const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return "";
  const now = new Date();
  const past = new Date(isoTimestamp);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 120) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  return `${diffInHours}h ago`;
}

// Helper function for Trend Indicator
function getTrendIndicator(diff: number | null): { icon: React.ReactNode, className: string, title: string } | null {
    if (diff === null || Math.abs(diff) < 0.1) { // Threshold for showing indicator (e.g., +/- 0.1 strokes)
        return null; // No significant trend or data missing
    }

    const roundedDiff = diff.toFixed(2);
    // Simple thresholds for color intensity
    if (diff > 0) { // Performing Better than Season
        const isLargeDiff = diff >= 0.5;
        return {
            icon: <ArrowUp size={12} />, // size={10} ?
            className: isLargeDiff ? "text-green-400" : "text-emerald-500",
            title: `Trend: +${roundedDiff} vs Season Avg`
        };
    } else { // Performing Worse than Season
        const isLargeDiff = Math.abs(diff) >= 0.5;
        return {
            icon: <ArrowDown size={12} />,
            className: isLargeDiff ? "text-red-500" : "text-orange-500",
            title: `Trend: ${roundedDiff} vs Season Avg`
        };
    }
}

export default function PlayerTable() {
  // Define sorting state separately, still needed for the table options
  const [sorting, setSorting] = useState<SortingState>([]);
  const [seasonSkills, setSeasonSkills] = useState<PlayerSkillRating[]>([]);
  const [seasonSkillsMap, setSeasonSkillsMap] = useState<Map<number, PlayerSkillRating>>(new Map()); // Map for lookup
  const [liveStats, setLiveStats] = useState<LiveTournamentStat[]>([]);
  const [loadingSeason, setLoadingSeason] = useState(true);
  const [loadingLive, setLoadingLive] = useState(true);
  const [isSyncingSkills, setIsSyncingSkills] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [lastSkillUpdate, setLastSkillUpdate] = useState<string | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(null);
  const [currentLiveEvent, setCurrentLiveEvent] = useState<string | null>(null);
  // State to toggle view
  const [dataView, setDataView] = useState<"season" | "tournament">("season");
  // Add state for round filter - default to event_avg
  const [roundFilter, setRoundFilter] = useState<string>("event_avg"); // Default to event_avg

  // Fetch both data types on mount
  useEffect(() => {
    fetchSeasonSkills();
    fetchLiveStats();
  }, [roundFilter]);

  const fetchSeasonSkills = async () => {
    setLoadingSeason(true);
    try {
      const { data, error } = await supabase
        .from("player_skill_ratings")
        .select("*")
        .order("sg_total", { ascending: false });

      if (error) throw error;
      const fetchedSkills = data || [];
      setSeasonSkills(fetchedSkills);
      // *** Populate the map ***
      const map = new Map<number, PlayerSkillRating>();
      fetchedSkills.forEach(skill => map.set(skill.dg_id, skill));
      setSeasonSkillsMap(map);
      // ***

      if (data && data.length > 0) {
        setLastSkillUpdate(data[0].data_golf_updated_at);
      } else {
        setLastSkillUpdate(null);
      }
    } catch (error) {
      console.error("Error fetching season skills:", error);
      toast({ title: "Error Fetching Season Skills", /* ... */ });
      setSeasonSkills([]);
      setLastSkillUpdate(null);
    } finally {
      setLoadingSeason(false);
    }
  };

  const fetchLiveStats = async () => {
    setLoadingLive(true);
    try {
      let query = supabase
        .from("latest_live_tournament_stats_view")
        .select("*");

      // Apply round filter
      if (roundFilter !== "latest") {
          query = query.eq('round_num', roundFilter);
      }
      // Else (if latest), don't filter by round_num, just order by time descending later?
      // The view already gives latest per player/event/round.
      // To get absolute latest *across rounds*, we might need different logic/view.
      // For now, assume 'latest' means highest round number or event_avg from the view.

      // Add ordering
      query = query.order("event_name", { ascending: false })
                   .order("total", { ascending: true });

      // If filter is 'latest', maybe add ordering by round_num desc?
      // This depends on how 'latest' should be interpreted when view has multiple rounds.
      // Let's stick to view's default of latest timestamp per round for now.

      const { data, error } = await query;

      if (error) throw error;
      setLiveStats(data || []);
      if (data && data.length > 0) {
        // Update state based on the fetched data
        // Need to handle which event/timestamp to show if multiple rounds exist in view data
        const latestRecord = data.reduce((latest, current) => 
            new Date(current.data_golf_updated_at ?? 0) > new Date(latest.data_golf_updated_at ?? 0) ? current : latest
        );
        setLastLiveUpdate(latestRecord.data_golf_updated_at);
        setCurrentLiveEvent(latestRecord.event_name);
      } else {
        setLastLiveUpdate(null);
        setCurrentLiveEvent(null);
        // If specific round filter has no data, maybe show message?
        if (roundFilter !== 'latest') {
           console.log(`No live stats found for round: ${roundFilter}`);
        }
      }
    } catch (error) {
       // ... error handling ...
    } finally {
      setLoadingLive(false);
    }
  };

  // Trigger for Season Skills Sync
  const triggerSkillSyncAndRefetch = async () => {
    setIsSyncingSkills(true);
    setLastSkillUpdate(null); // Clear timestamp while syncing
    try {
      // *** Add the actual fetch call ***
      const response = await fetch("/api/players/sync-skill-ratings");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Player Sync Complete",
          description: `Synced ${data.processedCount} player skill ratings.`,
        });
        // After successful API sync, re-fetch data for the table display
        await fetchSeasonSkills(); // Re-fetch season data
      } else {
        throw new Error(data.error || "Unknown error occurred during sync");
      }
    } catch (error) {
       console.error("Error syncing player ratings via API:", error);
       toast({
         title: "Error Syncing Skills",
         description: error instanceof Error ? error.message : "Failed to connect to the server",
         variant: "destructive",
       });
    } finally {
        setIsSyncingSkills(false);
    }
  };

  // Trigger for Live Stats Sync
  const triggerLiveSyncAndRefetch = async () => {
    console.log("@@@ triggerLiveSyncAndRefetch CALLED @@@");
    setIsSyncingLive(true);
    setLastLiveUpdate(null); // Clear timestamp while syncing
     try {
       // *** Add the actual fetch call ***
       const response = await fetch("/api/live-stats/sync");
       if (!response.ok) {
         const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }));
         throw new Error(errorData.error || `Server responded with status: ${response.status}`);
       }
       const data = await response.json();
       if (data.success) {
         toast({
           title: "Live Stats Sync Complete",
           description: `Synced ${data.processedCount} live player stats for ${data.eventName}.`,
         });
         // After successful API sync, re-fetch data for the table display
         await fetchLiveStats(); // Re-fetch live data
       } else {
         throw new Error(data.error || "Unknown error occurred during sync");
       }
    } catch (error) {
         console.error("Error syncing live stats via API:", error);
         toast({
           title: "Error Syncing Live Stats",
           description: error instanceof Error ? error.message : "Failed to connect to the server",
           variant: "destructive",
         });
    } finally {
        setIsSyncingLive(false);
    }
  };

  // Combine/Select data based on the current view and filter round for tournament view
  const displayPlayers: (PlayerSkillRating | LiveTournamentStat)[] = useMemo(() => {
    if (dataView === "season") {
      return seasonSkills;
    } else { // dataView === "tournament"
      // Remove logic for 'latest', just filter by roundFilter directly
      return liveStats.filter(p => p.round_num === roundFilter);
    }
  }, [dataView, seasonSkills, liveStats, roundFilter]);

  // Calculate percentiles dynamically based on the current view
  const statPercentiles = useMemo(() => {
    const playersToAnalyze = displayPlayers;
    if (playersToAnalyze.length === 0) return {};

    const calculatePercentiles = (values: (number | null)[]) => {
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

    // Define keys based on the view
    if (dataView === "season") {
        const skills = playersToAnalyze as PlayerSkillRating[];
        // Calculate season sg_t2g values first
        const seasonT2GValues = skills.map(p => 
            (typeof p.sg_ott === 'number' && typeof p.sg_app === 'number') 
            ? p.sg_ott + p.sg_app 
            : null
        );
        return {
            sg_total: calculatePercentiles(skills.map(p => p.sg_total)),
            sg_ott: calculatePercentiles(skills.map(p => p.sg_ott)),
            sg_app: calculatePercentiles(skills.map(p => p.sg_app)),
            sg_arg: calculatePercentiles(skills.map(p => p.sg_arg)),
            sg_putt: calculatePercentiles(skills.map(p => p.sg_putt)),
            sg_t2g: calculatePercentiles(seasonT2GValues), // Calculate percentiles for T2G
            driving_acc: calculatePercentiles(skills.map(p => p.driving_acc)),
            driving_dist: calculatePercentiles(skills.map(p => p.driving_dist)),
        };
    } else { // dataView === "tournament"
        const live = playersToAnalyze as LiveTournamentStat[];
        // Calculate live sg_t2g if not directly present but OTT/APP are
         const liveT2GValues = live.map(p => 
            (typeof p.sg_ott === 'number' && typeof p.sg_app === 'number') 
            ? p.sg_ott + p.sg_app 
            // If live feed *does* provide sg_t2g directly, prefer that:
            // : (typeof p.sg_t2g === 'number' ? p.sg_t2g : null)
            // For now, assuming we need to calculate it based on API providing OTT/APP reliably
            : null
        );
        return {
            sg_ott: calculatePercentiles(live.map(p => p.sg_ott)),
            sg_app: calculatePercentiles(live.map(p => p.sg_app)),
            sg_putt: calculatePercentiles(live.map(p => p.sg_putt)),
            sg_arg: calculatePercentiles(live.map(p => p.sg_arg)),
            sg_t2g: calculatePercentiles(liveT2GValues), // Use calculated live T2G for consistency if needed
            sg_total: calculatePercentiles(live.map(p => p.sg_total)),
            // ... other live stats ...
        };
    }
  }, [dataView, displayPlayers]);

  // getHeatmapColor function remains largely the same, but needs careful key usage
  const getHeatmapColor = (value: number | null, statKey: string, isHigherBetter = true) => {
    // Cast statPercentiles based on view or ensure keys are distinct
    const currentPercentiles = statPercentiles as Record<string, Map<number, number>>; 
    if (value === null || !currentPercentiles[statKey]) return "text-gray-500";
    const percentileMap = currentPercentiles[statKey];
    const percentile = percentileMap.get(value);
    if (percentile === undefined) return "text-gray-400";
    const adjustedPercentile = isHigherBetter ? percentile : 1 - percentile;
    // ... color logic ...
    if (adjustedPercentile >= 0.85) return "bg-green-700/70 text-green-100";
    else if (adjustedPercentile >= 0.60) return "bg-emerald-700/50 text-emerald-100";
    else if (adjustedPercentile >= 0.40) return "bg-gray-600/40 text-gray-200";
    else if (adjustedPercentile >= 0.15) return "bg-orange-700/50 text-orange-100";
    else return "bg-red-700/70 text-red-100";
  };

  // Make columns dynamic based on dataView
  const columns: ColumnDef<PlayerSkillRating | LiveTournamentStat>[] = useMemo(
    () => {
      const nameColumn: ColumnDef<PlayerSkillRating | LiveTournamentStat> = {
          accessorKey: "player_name",
          header: "NAME",
          cell: ({ row }) => {
            const name = row.original.player_name;
            const formattedName = name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
            return <div className="font-medium min-w-[150px]">{formattedName}</div>;
          },
      };

      // Define SG Columns with explicit types for row/column
      const sgPuttCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({
          accessorKey: "sg_putt",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG PUTT{isSeason ? "" : " (T)"}<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
          ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
              const value = isSeason ? (row.original as PlayerSkillRating).sg_putt : (row.original as LiveTournamentStat).sg_putt;
              const colorClass = getHeatmapColor(value, "sg_putt");
              // Add trend indicator only for tournament view
              let trend = null;
              if (!isSeason) {
                   const seasonValue = seasonSkillsMap.get(row.original.dg_id)?.sg_putt;
                   const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                   trend = getTrendIndicator(diff);
              }
              return (
                 <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{value?.toFixed(2) ?? 'N/A'}</span>
                     {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                 </div>
             );
          },
          meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      });
      const sgArgCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({ 
          accessorKey: "sg_arg",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
               <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG ARG{isSeason ? "" : " (T)"}<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
          ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
              const value = isSeason ? (row.original as PlayerSkillRating).sg_arg : (row.original as LiveTournamentStat).sg_arg;
              const colorClass = getHeatmapColor(value, "sg_arg");
              let trend = null;
              if (!isSeason) {
                   const seasonValue = seasonSkillsMap.get(row.original.dg_id)?.sg_arg;
                   const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                   trend = getTrendIndicator(diff);
              }
               return (
                 <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{value?.toFixed(2) ?? 'N/A'}</span>
                     {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                 </div>
             );
          },
          meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      });
       const sgAppCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({ 
          accessorKey: "sg_app",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG APP{isSeason ? "" : " (T)"}<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
          ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
              const value = isSeason ? (row.original as PlayerSkillRating).sg_app : (row.original as LiveTournamentStat).sg_app;
              const colorClass = getHeatmapColor(value, "sg_app");
               let trend = null;
              if (!isSeason) {
                   const seasonValue = seasonSkillsMap.get(row.original.dg_id)?.sg_app;
                   const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                   trend = getTrendIndicator(diff);
              }
               return (
                 <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{value?.toFixed(2) ?? 'N/A'}</span>
                     {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                 </div>
             );
          },
          meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      });
       const sgOttCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({ 
          accessorKey: "sg_ott",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG OTT{isSeason ? "" : " (T)"}<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
              const value = isSeason ? (row.original as PlayerSkillRating).sg_ott : (row.original as LiveTournamentStat).sg_ott;
              const colorClass = getHeatmapColor(value, "sg_ott");
               let trend = null;
              if (!isSeason) {
                   const seasonValue = seasonSkillsMap.get(row.original.dg_id)?.sg_ott;
                   const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                   trend = getTrendIndicator(diff);
              }
               return (
                 <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{value?.toFixed(2) ?? 'N/A'}</span>
                     {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                 </div>
             );
          },
          meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      });
       const sgT2gCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({
            accessorKey: "sg_t2g",
            header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG T2G{isSeason ? "" : " (T)"} <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
                let value: number | null;
                let trend = null;
                if (isSeason) {
                    const ott = (row.original as PlayerSkillRating).sg_ott;
                    const app = (row.original as PlayerSkillRating).sg_app;
                    value = (typeof ott === 'number' && typeof app === 'number') ? ott + app : null;
                } else {
                    value = (row.original as LiveTournamentStat).sg_t2g;
                    const seasonOtt = seasonSkillsMap.get(row.original.dg_id)?.sg_ott;
                    const seasonApp = seasonSkillsMap.get(row.original.dg_id)?.sg_app;
                    const seasonValue = (typeof seasonOtt === 'number' && typeof seasonApp === 'number') ? seasonOtt + seasonApp : null;
                    const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                    trend = getTrendIndicator(diff);
                }
                const colorClass = getHeatmapColor(value, "sg_t2g");
                return (
                    <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                        <span>{value?.toFixed(2) ?? 'N/A'}</span>
                        {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                    </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
            sortingFn: isSeason ? (rowA: Row<PlayerSkillRating | LiveTournamentStat>, rowB: Row<PlayerSkillRating | LiveTournamentStat>, columnId: string): number => {
                const ottA = (rowA.original as PlayerSkillRating).sg_ott;
                const appA = (rowA.original as PlayerSkillRating).sg_app;
                const t2gA = (typeof ottA === 'number' && typeof appA === 'number') ? ottA + appA : null;
                const ottB = (rowB.original as PlayerSkillRating).sg_ott;
                const appB = (rowB.original as PlayerSkillRating).sg_app;
                const t2gB = (typeof ottB === 'number' && typeof appB === 'number') ? ottB + appB : null;
                if (t2gA === null && t2gB === null) return 0;
                if (t2gA === null) return 1;
                if (t2gB === null) return -1;
                return t2gA - t2gB; // Return the number difference
            } : undefined
       });
       const sgTotalCol = (isSeason: boolean): ColumnDef<PlayerSkillRating | LiveTournamentStat> => ({ 
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG TOTAL{isSeason ? "" : " (T)"}<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
              const value = isSeason ? (row.original as PlayerSkillRating).sg_total : (row.original as LiveTournamentStat).sg_total;
              const colorClass = getHeatmapColor(value, "sg_total");
              let trend = null;
              if (!isSeason) {
                   const seasonValue = seasonSkillsMap.get(row.original.dg_id)?.sg_total;
                   const diff = (typeof value === 'number' && typeof seasonValue === 'number') ? value - seasonValue : null;
                   trend = getTrendIndicator(diff);
              }
               return (
                 <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{value?.toFixed(2) ?? 'N/A'}</span>
                     {!isSeason && <span title={trend?.title ?? ""} className={`inline-block w-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>{trend?.icon}</span>}
                 </div>
             );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      });


      if (dataView === "season") {
        const drivingAccCol = {
          accessorKey: "driving_acc",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Acc <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
            const value = (row.original as PlayerSkillRating).driving_acc;
            const colorClass = getHeatmapColor(value, "driving_acc", false); // isHigherBetter = false
            return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(3) ?? 'N/A'}</div>;
          },
        };
        const drivingDistCol = {
          accessorKey: "driving_dist",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Dist <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
            const value = (row.original as PlayerSkillRating).driving_dist;
            const colorClass = getHeatmapColor(value, "driving_dist");
            return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(1) ?? 'N/A'}</div>;
          },
        };
        return [
          nameColumn,
          // Reordered SG Columns
          sgPuttCol(true),
          sgArgCol(true),
          sgAppCol(true),
          sgOttCol(true),
          sgT2gCol(true),
          sgTotalCol(true),
          // Other season columns
          drivingAccCol,
          drivingDistCol,
        ];
      } else { // dataView === "tournament"
        const posCol = {
          accessorKey: "position",
          header: "POS",
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => <div className="text-center">{ (row.original as LiveTournamentStat).position ?? '-'}</div>,
          meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
        };
        const totalCol = {
          accessorKey: "total",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
                 const value = (row.original as LiveTournamentStat).total;
                 const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
                 return <div className="font-medium">{formatted}</div>;
             },
              meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        };
        const thruCol = {
          accessorKey: "thru",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>THRU <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => <div className="text-center">{(row.original as LiveTournamentStat).thru ?? '-'}</div>,
          meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
        };
        const rdCol = {
          accessorKey: "today",
          header: ({ column }: { column: Column<PlayerSkillRating | LiveTournamentStat, unknown> }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>RD <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
          cell: ({ row }: { row: Row<PlayerSkillRating | LiveTournamentStat> }) => {
                const value = (row.original as LiveTournamentStat).today;
                console.log(`Rendering RD for ${row.original.player_name}: raw value = ${value}`);
                const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
                 return <div className="font-medium">{formatted}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
        };
        return [
          posCol,
          nameColumn,
          totalCol,
          thruCol,
          rdCol,
          // Reordered SG Columns
          sgPuttCol(false),
          sgArgCol(false),
          sgAppCol(false),
          sgOttCol(false),
          sgT2gCol(false),
          sgTotalCol(false),
        ];
      }
    },
    [dataView, statPercentiles, seasonSkillsMap]
  );

  const table = useReactTable({
    data: displayPlayers,
    columns,
    // Define initial sorting based on dataView
    initialState: {
        get sorting() { // Use getter to dynamically access dataView
            if (dataView === 'tournament') {
                return [{ id: 'total', desc: false }]; // Sort by Total Ascending
            } else {
                return [{ id: 'sg_total', desc: true }]; // Default Season sort
            }
        }
    },
    // Manage sorting state
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const loading = loadingSeason || loadingLive; // Overall loading state

  // Round filter options - Remove 'latest'
  const roundOptions = ["1", "2", "3", "4", "event_avg"];

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
         {/* Header Section with Toggles and Sync Buttons */}
         <div className="flex justify-between items-center mb-4">
            {/* Title and View Toggle */}
            <div>
                <h2 className="text-xl font-bold">Player Stats</h2>
                <div className="mt-2 flex items-center gap-2">
                     <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="dataView" value="season" checked={dataView === 'season'} onChange={() => setDataView('season')} className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"/>
                        <span className="text-sm">Season Skills</span>
                     </label>
                     <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name="dataView" value="tournament" checked={dataView === 'tournament'} onChange={() => setDataView('tournament')} className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"/>
                        <span className="text-sm">Tournament Avg</span>
                     </label>
                </div>
                {dataView === 'tournament' && currentLiveEvent && (
                     <p className="text-xs text-gray-400 mt-1">Event: {currentLiveEvent}</p>
                )}
            </div>
            {/* Sync Buttons and Timestamps */}
            <div className="flex flex-col items-end gap-1">
                {/* Season Sync */}
                <div className="flex items-center gap-2">
                    {lastSkillUpdate && !isSyncingSkills && (
                        <span className="text-xs text-gray-400" title={`Data Golf skill file updated at ${new Date(lastSkillUpdate).toLocaleString()}`}>
                            Season Source: {formatRelativeTime(lastSkillUpdate)}
                        </span>
                    )}
                    {isSyncingSkills && <span className="text-xs text-gray-500">Syncing...</span>}
                    <Button variant="outline" size="sm" onClick={triggerSkillSyncAndRefetch} disabled={isSyncingSkills || isSyncingLive} className="h-7 px-2">
                        {isSyncingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1">Sync Skills</span>
                    </Button>
                </div>
                 {/* Live Sync */}
                 <div className="flex items-center gap-2">
                     {lastLiveUpdate && !isSyncingLive && (
                        <span className="text-xs text-gray-400" title={`Data Golf live stats file updated at ${new Date(lastLiveUpdate).toLocaleString()}`}>
                            Live Source: {formatRelativeTime(lastLiveUpdate)}
                         </span>
                     )}
                     {isSyncingLive && <span className="text-xs text-gray-500">Syncing...</span>}
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={triggerLiveSyncAndRefetch}
                        disabled={isSyncingSkills || isSyncingLive}
                        className="h-7 px-2"
                    >
                        {isSyncingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        <span className="ml-1">Sync Live</span>
                     </Button>
                 </div>
            </div>
        </div>

        {/* Add Round Filter Row */}
        {dataView === 'tournament' && (
            <div className="flex items-center gap-2 mb-4 border-t border-gray-700 pt-3 mt-3">
                 <span className="text-sm font-medium text-gray-300 mr-2">Round:</span>
                 {roundOptions.map((round) => (
                    <label key={round} className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name="roundFilter"
                            value={round}
                            checked={roundFilter === round}
                            onChange={() => setRoundFilter(round)}
                            className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"
                        />
                        <span className="text-sm capitalize">{round.replace("_", " ")}</span>
                    </label>
                 ))}
             </div>
        )}

        {/* Loading State */}
        {(loadingSeason || loadingLive) && displayPlayers.length === 0 ? (
             <div className="text-center py-8"> ... Loading ... </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-800">
             {/* Render the actual table using tanstack/react-table */}
             <Table>
               <TableHeader className="bg-[#1e1e23]">
                 {table.getHeaderGroups().map((headerGroup) => (
                   <TableRow key={headerGroup.id}>
                     {headerGroup.headers.map((header) => {
                       return (
                         <TableHead key={header.id} className={`text-white whitespace-nowrap px-3 py-2 text-xs sm:text-sm ${(header.column.columnDef.meta as any)?.headerClassName}`}>
                           {header.isPlaceholder
                             ? null
                             : flexRender(header.column.columnDef.header, header.getContext())}
                         </TableHead>
                       )
                     })}
                   </TableRow>
                 ))}
               </TableHeader>
               <TableBody>
                 {table.getRowModel().rows?.length ? (
                   table.getRowModel().rows.map((row) => (
                     <TableRow
                       key={row.original.dg_id} // Use dg_id for key
                       data-state={row.getIsSelected() && "selected"}
                       className="hover:bg-[#2a2a35]"
                     >
                       {row.getVisibleCells().map((cell) => (
                         <TableCell key={cell.id} className={`px-3 py-1.5 text-xs sm:text-sm ${(cell.column.columnDef.meta as any)?.cellClassName}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                         </TableCell>
                       ))}
                     </TableRow>
                   ))
                 ) : (
                   <TableRow>
                     <TableCell colSpan={columns.length} className="h-24 text-center">
                       No player data found for the selected view.
                     </TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>
          </div>
        )}
        {/* Heatmap legend might need conditional display/update */}
      </CardContent>
    </Card>
  )
}

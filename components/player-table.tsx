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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PlayerSkillRating, LiveTournamentStat, DisplayPlayer, TrendIndicator } from "@/types/definitions"

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

// Update HeatmapSquare to use Tooltip
// const HeatmapSquare = ({ statValue, statKey, label }: { statValue: number | null, statKey: keyof typeof matchupSkillPercentiles, label: string }) => {
//     const colorClass = getHeatmapColor(statValue, statKey);
//     const valueString = statValue !== null ? statValue.toFixed(2) : 'N/A';
//     return (
//         <Tooltip>
//             <TooltipTrigger asChild>
//                 <div
//                     className={`w-2.5 h-2.5 rounded-sm inline-block ${colorClass}`}
//                 />
//             </TooltipTrigger>
//             <TooltipContent>
//                 <p>{label}: {valueString}</p>
//             </TooltipContent>
//         </Tooltip>
//     );
//   };

// Define props for PlayerTable
interface PlayerTableProps {
  initialSeasonSkills: PlayerSkillRating[];
  initialLiveStats: LiveTournamentStat[];
}

export default function PlayerTable({ initialSeasonSkills, initialLiveStats }: PlayerTableProps) {
  // Define sorting state separately, still needed for the table options
  const [sorting, setSorting] = useState<SortingState>([]);
  const [seasonSkills, setSeasonSkills] = useState<PlayerSkillRating[]>(initialSeasonSkills);
  const [liveStats, setLiveStats] = useState<LiveTournamentStat[]>(initialLiveStats);
  const [loadingSeason, setLoadingSeason] = useState(initialSeasonSkills.length === 0);
  const [loadingLive, setLoadingLive] = useState(initialLiveStats.length === 0);
  const [isSyncingSkills, setIsSyncingSkills] = useState(false);
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [seasonSkillsMap, setSeasonSkillsMap] = useState<Map<number, PlayerSkillRating>>(() => {
      // Initialize map from initial props
      const map = new Map<number, PlayerSkillRating>();
      initialSeasonSkills.forEach(skill => map.set(skill.dg_id, skill));
      return map;
  });
  const [lastSkillUpdate, setLastSkillUpdate] = useState<string | null>(() => 
      initialSeasonSkills.length > 0 ? initialSeasonSkills[0].data_golf_updated_at : null
  );
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(() => 
       initialLiveStats.length > 0 ? initialLiveStats[0].data_golf_updated_at : null
  );
  const [currentLiveEvent, setCurrentLiveEvent] = useState<string | null>(() => 
       initialLiveStats.length > 0 ? initialLiveStats[0].event_name : null
  );
  // State to toggle view - Default to tournament view
  const [dataView, setDataView] = useState<"season" | "tournament">("tournament");
  // Add state for round filter - default to event_avg
  const [roundFilter, setRoundFilter] = useState<string>("event_avg"); // Default to event_avg

  // Remove or modify initial data fetching useEffect
  /*
  useEffect(() => {
    // If initial props were empty, maybe fetch here? Or rely on sync buttons.
    if (initialSeasonSkills.length === 0) fetchSeasonSkills();
    if (initialLiveStats.length === 0) fetchLiveStats();
  }, []); // Run only once
  */
  // Keep useEffect that depends on roundFilter to re-fetch live stats when filter changes
   useEffect(() => {
     // Don't run on initial mount if we have initial data for the default filter
     if (roundFilter === 'event_avg' && initialLiveStats.length > 0) {
       // console.log("Skipping initial live fetch, got props");
       return; 
     }
     console.log(`Round filter changed to: ${roundFilter}, fetching live stats...`)
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

  // Combine/Select data AND pre-calculate trends for tournament view
  const displayPlayers: DisplayPlayer[] = useMemo(() => {
    if (dataView === "season") {
      return seasonSkills;
    } else { // dataView === "tournament"
      let targetRound = roundFilter;
      if (targetRound === 'latest') {
          targetRound = 'event_avg';
      }
      const filteredLiveStats = liveStats.filter(p => p.round_num === targetRound);

      // Pre-calculate trends
      return filteredLiveStats.map(livePlayer => {
          const seasonData = seasonSkillsMap.get(livePlayer.dg_id);
          const trends: Record<string, ReturnType<typeof getTrendIndicator>> = {};

          if (seasonData) {
              const sgKeys: (keyof PlayerSkillRating & keyof LiveTournamentStat)[] = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_total'];
              
              sgKeys.forEach(key => {
                  const liveValue = livePlayer[key];
                  const seasonValue = seasonData[key];
                  const diff = (typeof liveValue === 'number' && typeof seasonValue === 'number') ? liveValue - seasonValue : null;
                  trends[key] = getTrendIndicator(diff);
              });

              // Calculate T2G trend separately
              const liveT2G = livePlayer.sg_t2g;
              const seasonOtt = seasonData.sg_ott;
              const seasonApp = seasonData.sg_app;
              const seasonT2G = (typeof seasonOtt === 'number' && typeof seasonApp === 'number') ? seasonOtt + seasonApp : null;
              const diffT2G = (typeof liveT2G === 'number' && typeof seasonT2G === 'number') ? liveT2G - seasonT2G : null;
              trends['sg_t2g'] = getTrendIndicator(diffT2G);
          }
          
          return { ...livePlayer, trends }; // Attach trends object to player data
      });
    }
  }, [dataView, seasonSkills, liveStats, roundFilter, seasonSkillsMap]); // Add seasonSkillsMap dependency

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
        return {
            sg_ott: calculatePercentiles(live.map(p => p.sg_ott)),
            sg_app: calculatePercentiles(live.map(p => p.sg_app)),
            sg_putt: calculatePercentiles(live.map(p => p.sg_putt)),
            sg_arg: calculatePercentiles(live.map(p => p.sg_arg)),
            sg_t2g: calculatePercentiles(live.map(p => p.sg_t2g)),
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

  // Revert to inline column definitions
  const columns: ColumnDef<DisplayPlayer>[] = useMemo(
    () => {
      if (dataView === "season") {
        return [
           // Season View Columns - Inline Definitions
          {
            accessorKey: "player_name",
            header: "NAME",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const name = row.original.player_name;
              const formattedName = name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
              return <div className="font-medium min-w-[150px]">{formattedName}</div>;
            },
          },
          {
            accessorKey: "sg_putt",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG PUTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_putt;
              const colorClass = getHeatmapColor(value, "sg_putt");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_arg",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG ARG<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_arg;
              const colorClass = getHeatmapColor(value, "sg_arg");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_app",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG APP<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_app;
              const colorClass = getHeatmapColor(value, "sg_app");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG OTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_ott;
              const colorClass = getHeatmapColor(value, "sg_ott");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
           {
            accessorKey: "sg_t2g",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG T2G<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const ott = row.original.sg_ott;
              const app = row.original.sg_app;
              const value = (typeof ott === 'number' && typeof app === 'number') ? ott + app : null;
              const colorClass = getHeatmapColor(value, "sg_t2g"); 
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
            sortingFn: (rowA: Row<DisplayPlayer>, rowB: Row<DisplayPlayer>, columnId: string): number => {
                const ottA = rowA.original.sg_ott;
                const appA = rowA.original.sg_app;
                const t2gA = (typeof ottA === 'number' && typeof appA === 'number') ? ottA + appA : null;

                const ottB = rowB.original.sg_ott;
                const appB = rowB.original.sg_app;
                const t2gB = (typeof ottB === 'number' && typeof appB === 'number') ? ottB + appB : null;

                if (t2gA === null && t2gB === null) return 0;
                if (t2gA === null) return 1; 
                if (t2gB === null) return -1;
                return t2gA - t2gB;
            }
          },
          {
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG TOTAL<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_total;
              const colorClass = getHeatmapColor(value, "sg_total");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "driving_acc",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Acc <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).driving_acc;
              const colorClass = getHeatmapColor(value, "driving_acc", false); // isHigherBetter = false
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(3) ?? 'N/A'}</div>;
            },
          },
          {
            accessorKey: "driving_dist",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Dist <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).driving_dist;
              const colorClass = getHeatmapColor(value, "driving_dist");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(1) ?? 'N/A'}</div>;
            },
          },
        ];
      } else { // dataView === "tournament"
        return [
          // Tournament View Columns - Inline Definitions
          {
            accessorKey: "position",
            header: "POS",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => <div className="text-center">{ (row.original as LiveTournamentStat).position ?? '-'}</div>,
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "player_name", // Re-add NAME here in order
            header: "NAME",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const name = row.original.player_name;
              const formattedName = name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
              return <div className="font-medium min-w-[150px]">{formattedName}</div>;
            },
          },
          {
            accessorKey: "total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as LiveTournamentStat).total;
              let colorClass = "text-white"; // Default
              if (typeof value === 'number') {
                  if (value < 0) colorClass = "text-red-400";
                  else if (value === 0) colorClass = "text-green-400";
              }
              const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
              // Apply colorClass
              return <div className={`font-medium ${colorClass}`}>{formatted}</div>;
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "thru",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>THRU <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const thruValue = (row.original as LiveTournamentStat).thru;
              const position = (row.original as LiveTournamentStat).position; // Get position for F, CUT, WD check
              let displayThru = thruValue ?? '-';
              if (position === 'F' || thruValue === 18) {
                  displayThru = 'F';
              } else if (position === 'CUT') {
                  displayThru = 'CUT';
              } else if (position === 'WD') {
                  displayThru = 'WD';
              }
              // If it's not F, CUT, WD, and thruValue exists, show the number
              else if (typeof thruValue === 'number') {
                  displayThru = thruValue.toString();
              }
              // Otherwise it remains '-'
              return <div className="text-center">{displayThru}</div>;
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "today",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>RD <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as LiveTournamentStat).today;
               let colorClass = "text-white"; // Default
               if (typeof value === 'number') {
                   if (value < 0) colorClass = "text-red-400";
                   else if (value === 0) colorClass = "text-green-400";
               }
              const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
               // Apply colorClass
               return <div className={`font-medium ${colorClass}`}>{formatted}</div>;
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_putt",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG PUTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_putt;
                const trend = row.original.trends?.sg_putt;
                const colorClass = getHeatmapColor(liveValue, "sg_putt");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_arg",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG ARG<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_arg;
                const trend = row.original.trends?.sg_arg;
                const colorClass = getHeatmapColor(liveValue, "sg_arg");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_app",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG APP<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_app;
                const trend = row.original.trends?.sg_app;
                const colorClass = getHeatmapColor(liveValue, "sg_app");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG OTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_ott;
                const trend = row.original.trends?.sg_ott;
                const colorClass = getHeatmapColor(liveValue, "sg_ott");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_t2g",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG T2G<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_t2g;
                const trend = row.original.trends?.sg_t2g;
                const colorClass = getHeatmapColor(liveValue, "sg_t2g");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG TOTAL<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
                const liveValue = (row.original as LiveTournamentStat).sg_total;
                const trend = row.original.trends?.sg_total;
                const colorClass = getHeatmapColor(liveValue, "sg_total");
                return (
                   <div className={`flex items-center justify-end gap-1 font-medium rounded-md px-2 py-1 ${colorClass}`}>
                     <span>{liveValue?.toFixed(2) ?? 'N/A'}</span>
                     <Tooltip>
                       <TooltipTrigger asChild>
                         <span className={`inline-block w-[12px] h-[12px] ${trend ? 'opacity-100' : 'opacity-0'} ${trend?.className ?? ""}`}>
                           {trend?.icon}
                         </span>
                       </TooltipTrigger>
                       {trend && <TooltipContent><p>{trend.title}</p></TooltipContent>}
                     </Tooltip>
                   </div>
                );
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
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
    <TooltipProvider>
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
                          <span className="text-sm">Current</span>
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
    </TooltipProvider>
  )
}

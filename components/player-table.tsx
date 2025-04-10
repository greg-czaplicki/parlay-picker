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
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react"
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

export default function PlayerTable() {
  // Define sorting state separately, still needed for the table options
  const [sorting, setSorting] = useState<SortingState>([]);
  const [seasonSkills, setSeasonSkills] = useState<PlayerSkillRating[]>([]);
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

  // Fetch both data types on mount
  useEffect(() => {
    fetchSeasonSkills();
    fetchLiveStats();
  }, []);

  const fetchSeasonSkills = async () => {
    setLoadingSeason(true);
    try {
      const { data, error } = await supabase
        .from("player_skill_ratings")
        .select("*")
        .order("sg_total", { ascending: false });

      if (error) throw error;
      setSeasonSkills(data || []);
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
    console.log("@@@ fetchLiveStats CALLED @@@");
    setLoadingLive(true);
    try {
      const { data, error } = await supabase
        .from("latest_live_tournament_stats_view")
        .select("*", {
          // Add head: true and count: 'exact' if needed, but focus on cache for now
          // Try forcing no cache on the read
          // Note: Standard Supabase JS client might not directly support fetch options like cache.
          // This might require lower-level fetch or acknowledging potential slight delays.
          // For now, let's assume standard behavior and see if recreating view helps.
          // If issue persists, we might need RPC or direct table query with JS filtering.
        })
        // Removed: .eq('round_num', 'event_avg')
        .order("event_name", { ascending: false })
        .order("total", { ascending: true });

      if (error) throw error;
      setLiveStats(data || []);
      if (data && data.length > 0) {
        // Update state based on the fetched data (could be any round now)
        setLastLiveUpdate(data[0].data_golf_updated_at);
        setCurrentLiveEvent(data[0].event_name);
      } else {
        // ... handle no live data ...
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

  // Combine/Select data based on the current view
  // Use a more robust type guard or mapping if merging later
  const displayPlayers: (PlayerSkillRating | LiveTournamentStat)[] = useMemo(() => {
    return dataView === "season" ? seasonSkills : liveStats;
  }, [dataView, seasonSkills, liveStats]);

  // Calculate percentiles dynamically based on the current view
  const statPercentiles = useMemo(() => {
    const playersToAnalyze = dataView === "season" ? seasonSkills : liveStats;
    if (playersToAnalyze.length === 0) return {};

    // Type guard to check if an object is PlayerSkillRating
    const isSkillRating = (p: any): p is PlayerSkillRating => dataView === 'season';
    // Type guard to check if an object is LiveTournamentStat
    const isLiveStat = (p: any): p is LiveTournamentStat => dataView === 'tournament';

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
        return {
            sg_total: calculatePercentiles(skills.map(p => p.sg_total)),
            sg_ott: calculatePercentiles(skills.map(p => p.sg_ott)),
            sg_app: calculatePercentiles(skills.map(p => p.sg_app)),
            sg_arg: calculatePercentiles(skills.map(p => p.sg_arg)),
            sg_putt: calculatePercentiles(skills.map(p => p.sg_putt)),
            driving_acc: calculatePercentiles(skills.map(p => p.driving_acc)),
            driving_dist: calculatePercentiles(skills.map(p => p.driving_dist)),
        };
    } else { // dataView === "tournament"
        const live = playersToAnalyze as LiveTournamentStat[];
        return {
            sg_ott: calculatePercentiles(live.map(p => p.sg_ott)),
            sg_app: calculatePercentiles(live.map(p => p.sg_app)),
            sg_putt: calculatePercentiles(live.map(p => p.sg_putt)),
            sg_t2g: calculatePercentiles(live.map(p => p.sg_t2g)),
            sg_total: calculatePercentiles(live.map(p => p.sg_total)),
            accuracy: calculatePercentiles(live.map(p => p.accuracy)),
            distance: calculatePercentiles(live.map(p => p.distance)),
            gir: calculatePercentiles(live.map(p => p.gir)),
            scrambling: calculatePercentiles(live.map(p => p.scrambling)),
            sg_arg: calculatePercentiles(live.map(p => p.sg_arg)),
        };
    }
  }, [dataView, seasonSkills, liveStats]); // Recalculate when view or data changes

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

      if (dataView === "season") {
        return [
          nameColumn,
          // Season Skill Columns with Heatmap
          {
            accessorKey: "sg_total",
            header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG: Total <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
            cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).sg_total;
              const colorClass = getHeatmapColor(value, "sg_total");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG: OTT <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).sg_ott;
              const colorClass = getHeatmapColor(value, "sg_ott");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
          },
          {
            accessorKey: "sg_app",
             header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG: APP <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).sg_app;
              const colorClass = getHeatmapColor(value, "sg_app");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
          },
           {
            accessorKey: "sg_arg",
             header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG: ARG <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).sg_arg;
              const colorClass = getHeatmapColor(value, "sg_arg");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
          },
          {
            accessorKey: "sg_putt",
             header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG: PUTT <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).sg_putt;
              const colorClass = getHeatmapColor(value, "sg_putt");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
            },
          },
            {
            accessorKey: "driving_acc",
             header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Acc <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).driving_acc;
              const colorClass = getHeatmapColor(value, "driving_acc", false); // isHigherBetter = false
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(3) ?? 'N/A'}</div>;
            },
          },
          {
            accessorKey: "driving_dist",
             header: ({ column }) => (
                 <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Driving Dist <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" /></div>
            ),
             cell: ({ row }) => {
              const value = (row.original as PlayerSkillRating).driving_dist;
              const colorClass = getHeatmapColor(value, "driving_dist");
              return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(1) ?? 'N/A'}</div>;
            },
          },
        ];
      } else { // dataView === "tournament"
        return [
          {
            accessorKey: "position",
            header: "POS",
            cell: ({ row }) => <div className="text-center">{ (row.original as LiveTournamentStat).position ?? '-'}</div>,
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          nameColumn,
          {
            accessorKey: "total",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).total;
                 const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
                 return <div className="font-medium">{formatted}</div>;
             },
              meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "thru",
            header: ({ column }) => (
                 <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>THRU <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => <div className="text-center">{(row.original as LiveTournamentStat).thru ?? '-'}</div>,
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
           {
            accessorKey: "today",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>RD <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                const value = (row.original as LiveTournamentStat).today;
                console.log(`Rendering RD for ${row.original.player_name}: raw value = ${value}`);
                const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-';
                 return <div className="font-medium">{formatted}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
           {
            accessorKey: "sg_putt",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG PUTT <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_putt;
                 const colorClass = getHeatmapColor(value, "sg_putt");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
              meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
           {
            accessorKey: "sg_arg",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG ARG <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_arg;
                 const colorClass = getHeatmapColor(value, "sg_arg");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
              meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
           {
            accessorKey: "sg_app",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG APP <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_app;
                 const colorClass = getHeatmapColor(value, "sg_app");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG OTT <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_ott;
                 const colorClass = getHeatmapColor(value, "sg_ott");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_t2g",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG T2G <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_t2g;
                 const colorClass = getHeatmapColor(value, "sg_t2g");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_total",
            header: ({ column }) => (
                 <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>SG TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" /></div>
            ),
            cell: ({ row }) => {
                 const value = (row.original as LiveTournamentStat).sg_total;
                 const colorClass = getHeatmapColor(value, "sg_total");
                 return <div className={`font-medium rounded-md px-2 py-1 ${colorClass}`}>{value?.toFixed(2) ?? 'N/A'}</div>;
             },
             meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
        ];
      }
    },
    [dataView, statPercentiles]
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

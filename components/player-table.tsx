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
  const [sorting, setSorting] = useState<SortingState>([{ id: "sg_total", desc: true }])
  const [players, setPlayers] = useState<PlayerSkillRating[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshingApi, setIsRefreshingApi] = useState(false)
  const [lastDataGolfUpdate, setLastDataGolfUpdate] = useState<string | null>(null)

  useEffect(() => {
    fetchPlayersFromSupabase()
  }, [])

  const fetchPlayersFromSupabase = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("player_skill_ratings")
        .select("*")
        .order("sg_total", { ascending: false });

      if (error) throw error;

      setPlayers(data || []);
      if (data && data.length > 0) {
        setLastDataGolfUpdate(data[0].data_golf_updated_at);
      } else {
        setLastDataGolfUpdate(null);
      }

    } catch (error) {
      console.error("Error fetching players from Supabase:", error);
      toast({
        title: "Error Fetching Players",
        description: error instanceof Error ? error.message : "Failed to load player data",
        variant: "destructive",
      });
      setPlayers([]);
      setLastDataGolfUpdate(null);
    } finally {
      setLoading(false)
    }
  }

  const triggerPlayerSyncAndRefetch = async () => {
    setIsRefreshingApi(true)
    setLastDataGolfUpdate(null);
    try {
      const response = await fetch("/api/players/sync-skill-ratings")
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
        await fetchPlayersFromSupabase();
      } else {
        throw new Error(data.error || "Unknown error occurred during sync");
      }
    } catch (error) {
      console.error("Error syncing player ratings via API:", error);
      toast({
        title: "Error Syncing Players",
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      });
    } finally {
      setIsRefreshingApi(false)
    }
  }

  const statPercentiles = useMemo(() => {
    if (players.length === 0) return {}

    const calculatePercentiles = (values: (number | null)[]) => {
      const validValues = values.filter(v => v !== null) as number[];
      if (validValues.length === 0) return new Map<number, number>();
      const sortedValues = [...validValues].sort((a, b) => a - b)
      const percentileMap = new Map<number, number>()
      sortedValues.forEach((value, index) => {
        if (!percentileMap.has(value)) {
           percentileMap.set(value, index / sortedValues.length)
        }
      })
      return percentileMap
    }

    return {
      sg_total: calculatePercentiles(players.map((p) => p.sg_total)),
      sg_ott: calculatePercentiles(players.map((p) => p.sg_ott)),
      sg_app: calculatePercentiles(players.map((p) => p.sg_app)),
      sg_arg: calculatePercentiles(players.map((p) => p.sg_arg)),
      sg_putt: calculatePercentiles(players.map((p) => p.sg_putt)),
      driving_acc: calculatePercentiles(players.map((p) => p.driving_acc)),
      driving_dist: calculatePercentiles(players.map((p) => p.driving_dist)),
    }
  }, [players])

  const getHeatmapColor = (value: number | null, statKey: keyof typeof statPercentiles, isHigherBetter = true) => {
    if (value === null || !statPercentiles[statKey]) return "text-gray-500";
    const percentileMap = statPercentiles[statKey];
    const percentile = percentileMap.get(value);

    if (percentile === undefined) return "text-gray-400";

    const adjustedPercentile = isHigherBetter ? percentile : 1 - percentile
    if (adjustedPercentile < 0.2) return "bg-red-950/30 text-red-400";
    else if (adjustedPercentile < 0.4) return "bg-orange-950/30 text-orange-400";
    else if (adjustedPercentile < 0.6) return "bg-yellow-950/30 text-yellow-400";
    else if (adjustedPercentile < 0.8) return "bg-emerald-950/30 text-emerald-400";
    else return "bg-green-950/30 text-green-400";
  }

  const columns: ColumnDef<PlayerSkillRating>[] = useMemo(
    () => [
      {
        accessorKey: "player_name",
        header: "Name",
        cell: ({ row }) => {
          const name = row.getValue("player_name") as string
          const formattedName = name.includes(",") ? name.split(",").reverse().join(" ").trim() : name
          return <div className="font-medium min-w-[150px]">{formattedName}</div>
        },
      },
      {
        accessorKey: "sg_total",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: Total
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("sg_total") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "sg_total");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sg_ott",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: OTT
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("sg_ott") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "sg_ott");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sg_app",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: APP
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("sg_app") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "sg_app");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sg_arg",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: ARG
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("sg_arg") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "sg_arg");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sg_putt",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: PUTT
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("sg_putt") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "sg_putt");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "driving_acc",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Driving Acc
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("driving_acc") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "driving_acc", false);
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(3)}</div>
        },
      },
      {
        accessorKey: "driving_dist",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Driving Dist
              {column.getIsSorted() === "asc" ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : column.getIsSorted() === "desc" ? (
                <ChevronDown className="ml-2 h-4 w-4" />
              ) : (
                <ArrowUpDown className="ml-2 h-4 w-4" />
              )}
            </div>
          )
        },
        cell: ({ row }) => {
          const value = row.getValue("driving_dist") as number | null;
          if (value === null) return <div className="text-right text-gray-500">N/A</div>;
          const colorClass = getHeatmapColor(value, "driving_dist");
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(1)}</div>
        },
      },
    ],
    [statPercentiles],
  )

  const table = useReactTable({
    data: players,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  })

  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">Player Skill Ratings</h2>
            {lastDataGolfUpdate && !isRefreshingApi && (
                <p className="text-sm text-gray-400 mt-1" title={`Data Golf skill file updated at ${new Date(lastDataGolfUpdate).toLocaleString()}`}>
                    DG Source: {formatRelativeTime(lastDataGolfUpdate)}
                 </p>
            )}
            {isRefreshingApi && <p className="text-sm text-gray-500 mt-1">Syncing...</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerPlayerSyncAndRefetch}
            disabled={isRefreshingApi || loading}
            className="flex items-center gap-2 bg-[#1e1e23] border-none"
          >
            {isRefreshingApi ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRefreshingApi ? "Syncing..." : "Sync Skills"}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p>Loading player data...</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-gray-800">
            <Table>
              <TableHeader className="bg-[#1e1e23]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className="text-white">
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
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                      className="hover:bg-[#2a2a35]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No players found. Try refreshing the data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        {players.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-gray-400">Heatmap Legend:</span>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-red-950/30 border border-red-400"></div>
              <span className="text-red-400">Very Poor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-orange-950/30 border border-orange-400"></div>
              <span className="text-orange-400">Poor</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-yellow-950/30 border border-yellow-400"></div>
              <span className="text-yellow-400">Average</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-emerald-950/30 border border-emerald-400"></div>
              <span className="text-emerald-400">Good</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-green-950/30 border border-green-400"></div>
              <span className="text-green-400">Excellent</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

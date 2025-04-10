"use client"

import { useState, useEffect, useMemo } from "react"
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

type Player = {
  id: string
  name: string
  sgTotal: number
  sgTeeToGreen: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
  drivingAccuracy?: number
  drivingDistance?: number
}

export default function PlayerTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "sgTotal", desc: true }])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>("")

  // Fetch player data
  useEffect(() => {
    fetchPlayers()
  }, [])

  const fetchPlayers = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/players")
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`)
      }
      const data = await response.json()
      if (data.success) {
        setPlayers(data.players)
        setLastUpdated(new Date().toLocaleString())
      } else {
        toast({
          title: "Error fetching players",
          description: data.error || "Unknown error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching players:", error)
      toast({
        title: "Error fetching players",
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshPlayerStats = async () => {
    setRefreshing(true)
    try {
      await fetchPlayers()
      toast({
        title: "Player stats refreshed",
        description: "Successfully fetched latest player stats",
      })
    } catch (error) {
      console.error("Error refreshing player stats:", error)
      toast({
        title: "Error refreshing player stats",
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  // Pre-calculate percentiles for each stat category
  const statPercentiles = useMemo(() => {
    if (players.length === 0) return {}

    const calculatePercentiles = (values: number[]) => {
      const sortedValues = [...values].sort((a, b) => a - b)
      const percentileMap = new Map<number, number>()

      sortedValues.forEach((value, index) => {
        percentileMap.set(value, index / sortedValues.length)
      })

      return percentileMap
    }

    return {
      sgTotal: calculatePercentiles(players.map((p) => p.sgTotal)),
      sgTeeToGreen: calculatePercentiles(players.map((p) => p.sgTeeToGreen)),
      sgApproach: calculatePercentiles(players.map((p) => p.sgApproach)),
      sgAroundGreen: calculatePercentiles(players.map((p) => p.sgAroundGreen)),
      sgPutting: calculatePercentiles(players.map((p) => p.sgPutting)),
      drivingAccuracy: calculatePercentiles(
        players.filter((p) => p.drivingAccuracy !== undefined).map((p) => p.drivingAccuracy!),
      ),
      drivingDistance: calculatePercentiles(
        players.filter((p) => p.drivingDistance !== undefined).map((p) => p.drivingDistance!),
      ),
    }
  }, [players])

  // Optimized function to get heatmap color based on pre-calculated percentiles
  const getHeatmapColor = (value: number, statKey: keyof typeof statPercentiles, isHigherBetter = true) => {
    if (!statPercentiles[statKey]) return ""

    const percentile = statPercentiles[statKey].get(value) || 0
    const adjustedPercentile = isHigherBetter ? percentile : 1 - percentile

    // Color scale from red (poor) to yellow (average) to green (excellent)
    if (adjustedPercentile < 0.2) {
      return "bg-red-950/30 text-red-400" // Very poor
    } else if (adjustedPercentile < 0.4) {
      return "bg-orange-950/30 text-orange-400" // Poor
    } else if (adjustedPercentile < 0.6) {
      return "bg-yellow-950/30 text-yellow-400" // Average
    } else if (adjustedPercentile < 0.8) {
      return "bg-emerald-950/30 text-emerald-400" // Good
    } else {
      return "bg-green-950/30 text-green-400" // Excellent
    }
  }

  const columns: ColumnDef<Player>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => {
          const name = row.getValue("name") as string
          // Format name from "Last, First" to "First Last"
          const formattedName = name.includes(",") ? name.split(",").reverse().join(" ").trim() : name
          return <div className="font-medium">{formattedName}</div>
        },
      },
      {
        accessorKey: "sgTotal",
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
          const value: number = row.getValue("sgTotal")
          const colorClass = getHeatmapColor(value, "sgTotal")
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sgTeeToGreen",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: Off-the-Tee
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
          const value: number = row.getValue("sgTeeToGreen")
          const colorClass = getHeatmapColor(value, "sgTeeToGreen")
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sgApproach",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: Approach
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
          const value: number = row.getValue("sgApproach")
          const colorClass = getHeatmapColor(value, "sgApproach")
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sgAroundGreen",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: Around-Green
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
          const value: number = row.getValue("sgAroundGreen")
          const colorClass = getHeatmapColor(value, "sgAroundGreen")
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "sgPutting",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              SG: Putting
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
          const value: number = row.getValue("sgPutting")
          const colorClass = getHeatmapColor(value, "sgPutting")
          return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(2)}</div>
        },
      },
      {
        accessorKey: "drivingAccuracy",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Driving Accuracy
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
          const value: number | undefined = row.getValue("drivingAccuracy")
          if (value !== undefined) {
            const colorClass = getHeatmapColor(value, "drivingAccuracy")
            return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(3)}</div>
          }
          return <div className="text-right text-gray-500">N/A</div>
        },
      },
      {
        accessorKey: "drivingDistance",
        header: ({ column }) => {
          return (
            <div
              className="flex items-center cursor-pointer"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Driving Distance
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
          const value: number | undefined = row.getValue("drivingDistance")
          if (value !== undefined) {
            const colorClass = getHeatmapColor(value, "drivingDistance")
            return <div className={`text-right font-medium rounded-md px-2 py-1 ${colorClass}`}>{value.toFixed(1)}</div>
          }
          return <div className="text-right text-gray-500">N/A</div>
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
            <h2 className="text-xl font-bold">Player Stats</h2>
            {lastUpdated && <p className="text-sm text-gray-400 mt-1">Last updated: {lastUpdated}</p>}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPlayerStats}
            disabled={refreshing}
            className="flex items-center gap-2 bg-[#1e1e23] border-none"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Refreshing..." : "Refresh Stats"}
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

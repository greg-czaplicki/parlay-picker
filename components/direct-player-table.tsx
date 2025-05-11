"use client"

import { useState } from "react"
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
import { ArrowUpDown, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { useDirectPlayerStatsQuery } from '@/hooks/use-direct-player-stats-query'

export default function DirectPlayerTable() {
  const [sorting, setSorting] = useState<SortingState>([{ id: "sgTotal", desc: true }])
  const { data: players = [], isLoading, isError, error, refetch } = useDirectPlayerStatsQuery()

  // Show error toast if error occurs
  if (isError && error) {
    toast({
      title: "Error fetching players",
      description: error.message,
      variant: "destructive",
    })
  }

  const columns: ColumnDef<typeof players[0]>[] = [
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
        return <div className="text-right font-medium">{value.toFixed(2)}</div>
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
        return <div className="text-right font-medium">{value.toFixed(2)}</div>
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
        return <div className="text-right font-medium">{value.toFixed(2)}</div>
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
        return <div className="text-right font-medium">{value.toFixed(2)}</div>
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
        return <div className="text-right font-medium">{value.toFixed(2)}</div>
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
        return value !== undefined ? (
          <div className="text-right font-medium">{value.toFixed(3)}</div>
        ) : (
          <div className="text-right text-gray-500">N/A</div>
        )
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
        return value !== undefined ? (
          <div className="text-right font-medium">{value.toFixed(1)}</div>
        ) : (
          <div className="text-right text-gray-500">N/A</div>
        )
      },
    },
  ]

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
            <h2 className="text-xl font-bold">Player Stats (Direct from DataGolf API)</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); }}
            disabled={isLoading}
            className="flex items-center gap-2 bg-[#1e1e23] border-none"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Refreshing..." : "Refresh Stats"}
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading player data directly from DataGolf API...</p>
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
      </CardContent>
    </Card>
  )
}

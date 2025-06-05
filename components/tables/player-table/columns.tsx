"use client"

import { useMemo } from "react"
import { type ColumnDef, type Row, type Column } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { StatCell } from "./stat-cell"
import { formatPlayerName } from "@/lib/utils"
// import type { DisplayPlayer, PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"

interface UseColumnsProps<T> {
  dataView: "season" | "tournament"
  getHeatmapColor: (value: number | null, statKey: string, isHigherBetter?: boolean) => string
}

export function useColumns<T>({ dataView, getHeatmapColor }: UseColumnsProps<T>): ColumnDef<T>[] {
  const columns: ColumnDef<T>[] = useMemo(
    () => {
      if (dataView === "season") {
        return [
          {
            accessorKey: "player_name",
            header: "NAME",
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const name = row.original.player_name
              return <div className="font-medium min-w-[150px]">{formatPlayerName(name)}</div>
            },
          },
          {
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                SG: Total <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.sg_total
              const colorClass = getHeatmapColor(value, "sg_total")
              return <StatCell value={value} colorClass={colorClass} precision={3} />
            },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                SG: OTT <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.sg_ott
              const colorClass = getHeatmapColor(value, "sg_ott")
              return <StatCell value={value} colorClass={colorClass} precision={3} />
            },
          },
          {
            accessorKey: "sg_app",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                SG: APP <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.sg_app
              const colorClass = getHeatmapColor(value, "sg_app")
              return <StatCell value={value} colorClass={colorClass} precision={3} />
            },
          },
          {
            accessorKey: "sg_arg",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                SG: ARG <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.sg_arg
              const colorClass = getHeatmapColor(value, "sg_arg")
              return <StatCell value={value} colorClass={colorClass} precision={3} />
            },
          },
          {
            accessorKey: "sg_putt",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                SG: PUTT <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.sg_putt
              const colorClass = getHeatmapColor(value, "sg_putt")
              return <StatCell value={value} colorClass={colorClass} precision={3} />
            },
          },
          {
            accessorKey: "driving_accuracy",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                Driving Acc <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.driving_accuracy
              const colorClass = getHeatmapColor(value, "driving_accuracy", true)
              return <StatCell value={value} colorClass={colorClass} precision={1} isPercentage={true} />
            },
          },
          {
            accessorKey: "driving_distance",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="flex items-center cursor-pointer w-full"
              >
                Driving Dist <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </button>
            ),
            meta: { headerClassName: 'pl-3', cellClassName: 'pl-3' },
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = row.original.driving_distance
              const colorClass = getHeatmapColor(value, "driving_distance")
              return <StatCell value={value} colorClass={colorClass} precision={1} />
            },
          },
        ] as ColumnDef<T>[]
      } else {
        return [
          {
            accessorKey: "position",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                POS <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => (
              <div className="text-center px-1 py-1 truncate">{(row.original as any)?.position ?? '-'}</div>
            ),
            meta: { headerClassName: 'text-center', cellClassName: 'text-center score-cell' },
          },
          {
            accessorKey: "player_name",
            header: "NAME",
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const name = row.original.player_name
              return <div className="font-medium px-1 py-1 truncate">{formatPlayerName(name)}</div>
            },
            meta: { cellClassName: 'player-name-cell' },
          },
          {
            accessorKey: "total",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="text-right cursor-pointer flex items-center justify-end w-full"
              >
                TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = (row.original as LiveTournamentStat).total || 0
              let colorClass = "text-white"
              if (typeof value === 'number') {
                if (value < 0) colorClass = "text-red-400"
                else if (value === 0) colorClass = "text-green-400"
              }
              const formatted = value === 0 ? 'E' : value > 0 ? `+${value}` : value.toString() ?? '-'
              return <div className={`font-medium px-4 py-1 ${colorClass}`}>{formatted}</div>
            },
            sortingFn: (rowA, rowB, columnId) => {
              const a = (rowA.original as any).total ?? 0
              const b = (rowB.original as any).total ?? 0
              return a - b
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center score-cell' },
          },
          {
            accessorKey: "thru",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                THRU <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const thruValue = (row.original as LiveTournamentStat).thru
              // @ts-expect-error: dynamic property access
              const position = (row.original as LiveTournamentStat).position
              let displayThru = thruValue ?? '-'
              if (position === 'F' || thruValue === 18) {
                displayThru = 'F'
              } else if (position === 'CUT') {
                displayThru = 'CUT'
              } else if (position === 'WD') {
                displayThru = 'WD'
              } else if (typeof thruValue === 'number') {
                displayThru = thruValue.toString()
              }
              return <div className="text-center px-1 py-1 truncate">{displayThru}</div>
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center thru-cell' },
          },
          {
            accessorKey: "today",
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                RD <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              // @ts-expect-error: dynamic property access
              const value = (row.original as LiveTournamentStat).today
              let colorClass = "text-white"
              if (typeof value === 'number') {
                if (value < 0) colorClass = "text-red-400"
                else if (value === 0) colorClass = "text-green-400"
              }
              const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-'
              return <div className={`font-medium px-4 py-1 text-center ${colorClass}`}>{formatted}</div>
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center round-cell' },
          },
          {
            accessorKey: 'sg_ott',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: OTT <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_ott
              const colorClass = getHeatmapColor(value, 'sg_ott')
              return <StatCell value={value} colorClass={colorClass} precision={2} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-ott-cell' },
          },
          {
            accessorKey: 'sg_app',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: APP <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_app
              const colorClass = getHeatmapColor(value, 'sg_app')
              return <StatCell value={value} colorClass={colorClass} precision={2} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-app-cell' },
          },
          {
            accessorKey: 'sg_arg',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: ARG <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_arg
              const colorClass = getHeatmapColor(value, 'sg_arg')
              return <StatCell value={value} colorClass={colorClass} precision={2} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-arg-cell' },
          },
          {
            accessorKey: 'sg_putt',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: PUTT <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_putt
              const colorClass = getHeatmapColor(value, 'sg_putt')
              return <StatCell value={value} colorClass={colorClass} precision={2} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-putt-cell' },
          },
          {
            accessorKey: 'sg_t2g',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: T2G <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_t2g
              const colorClass = getHeatmapColor(value, 'sg_t2g')
              return <StatCell value={value} colorClass={colorClass} precision={2} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-t2g-cell' },
          },
          {
            accessorKey: 'sg_total',
            header: ({ column }: { column: Column<T, unknown> }) => (
              <button 
                onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                className="text-center cursor-pointer flex items-center justify-center w-full"
              >
                SG: TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </button>
            ),
            cell: ({ row }: { row: Row<T> }) => {
              const value = (row.original as any).sg_total
              const seasonValue = (row.original as any).season_sg_total
              const colorClass = getHeatmapColor(value, 'sg_total')
              return (
                <div className="flex flex-col items-center justify-center">
                  <StatCell value={value} colorClass={colorClass} precision={2} />
                  {typeof seasonValue === 'number' && (
                    <span className="text-xs text-muted-foreground mt-0.5" title="Season SG Total">
                      Season: {seasonValue.toFixed(2)}
                    </span>
                  )}
                </div>
              )
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center sg-total-cell' },
          },
        ] as ColumnDef<T>[]
      }
    },
    [dataView, getHeatmapColor]
  )

  return columns
}
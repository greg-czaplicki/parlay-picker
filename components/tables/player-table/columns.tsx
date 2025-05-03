"use client"

import { useMemo } from "react"
import { type ColumnDef, type Row, type Column } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { StatCell } from "./stat-cell"
import { formatPlayerName } from "@/lib/utils"
import type { DisplayPlayer, PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"

interface UseColumnsProps {
  dataView: "season" | "tournament"
  getHeatmapColor: (value: number | null, statKey: string, isHigherBetter?: boolean) => string
}

export function useColumns({ dataView, getHeatmapColor }: UseColumnsProps) {
  const columns: ColumnDef<DisplayPlayer>[] = useMemo(
    () => {
      if (dataView === "season") {
        return [
          {
            accessorKey: "player_name",
            header: "NAME",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const name = row.original.player_name
              return <div className="font-medium min-w-[150px]">{formatPlayerName(name)}</div>
            },
          },
          {
            accessorKey: "sg_putt",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG PUTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_putt
              const colorClass = getHeatmapColor(value, "sg_putt")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_arg",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG ARG<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_arg
              const colorClass = getHeatmapColor(value, "sg_arg")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_app",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG APP<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_app
              const colorClass = getHeatmapColor(value, "sg_app")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG OTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_ott
              const colorClass = getHeatmapColor(value, "sg_ott")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
          },
          {
            accessorKey: "sg_t2g",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG T2G<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const ott = row.original.sg_ott
              const app = row.original.sg_app
              const value = (typeof ott === 'number' && typeof app === 'number') ? ott + app : null
              const colorClass = getHeatmapColor(value, "sg_t2g")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
            sortingFn: (rowA: Row<DisplayPlayer>, rowB: Row<DisplayPlayer>) => {
              const ottA = rowA.original.sg_ott
              const appA = rowA.original.sg_app
              const t2gA = (typeof ottA === 'number' && typeof appA === 'number') ? ottA + appA : null

              const ottB = rowB.original.sg_ott
              const appB = rowB.original.sg_app
              const t2gB = (typeof ottB === 'number' && typeof appB === 'number') ? ottB + appB : null

              if (t2gA === null && t2gB === null) return 0
              if (t2gA === null) return 1
              if (t2gB === null) return -1
              return t2gA - t2gB
            }
          },
          {
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG TOTAL<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).sg_total
              const colorClass = getHeatmapColor(value, "sg_total")
              return <StatCell value={value} colorClass={colorClass} />
            },
            meta: { 
              headerClassName: 'text-right', 
              cellClassName: 'text-right',
              // Add custom styles that will be applied inline
              customStyles: { 
                cell: { borderRight: '6px solid #6b7280' },
                header: { borderRight: '6px solid #6b7280' } 
              }
            },
          },
          {
            accessorKey: "driving_acc",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Driving Acc <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </div>
            ),
            meta: { 
              headerClassName: 'pl-3', 
              cellClassName: 'pl-3',
              customStyles: {
                cell: { backgroundColor: '#2a2a38' },
                header: { backgroundColor: '#2a2a38' }
              }
            },
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).driving_acc
              const colorClass = getHeatmapColor(value, "driving_acc", false)
              return <StatCell value={value} colorClass={colorClass} precision={1} isPercentage={true} />
            },
          },
          {
            accessorKey: "driving_dist",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="flex items-center cursor-pointer" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Driving Dist <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
              </div>
            ),
            meta: { 
              headerClassName: 'pl-3', 
              cellClassName: 'pl-3',
              customStyles: {
                cell: { backgroundColor: '#2a2a38' },
                header: { backgroundColor: '#2a2a38' }
              }
            },
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as PlayerSkillRating).driving_dist
              const colorClass = getHeatmapColor(value, "driving_dist")
              return <StatCell value={value} colorClass={colorClass} precision={1} />
            },
          },
        ]
      } else {
        return [
          {
            accessorKey: "position",
            header: "POS",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => (
              <div className="text-center px-1 py-1 truncate">{(row.original as LiveTournamentStat).position ?? '-'}</div>
            ),
            meta: { headerClassName: 'text-center', cellClassName: 'text-center score-cell' },
          },
          {
            accessorKey: "player_name",
            header: "NAME",
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const name = row.original.player_name
              return <div className="font-medium px-1 py-1 truncate">{formatPlayerName(name)}</div>
            },
            meta: { cellClassName: 'player-name-cell' },
          },
          {
            accessorKey: "total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-right cursor-pointer flex items-center justify-end" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                TOTAL <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const value = (row.original as LiveTournamentStat).total
              let colorClass = "text-white"
              if (typeof value === 'number') {
                if (value < 0) colorClass = "text-red-400"
                else if (value === 0) colorClass = "text-green-400"
              }
              const formatted = value === 0 ? 'E' : value && value > 0 ? `+${value}` : value?.toString() ?? '-'
              return <div className={`font-medium px-4 py-1 ${colorClass}`}>{formatted}</div>
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center score-cell' },
          },
          {
            accessorKey: "thru",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                THRU <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const thruValue = (row.original as LiveTournamentStat).thru
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
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                RD <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
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
            accessorKey: "sg_putt",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG PUTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_putt
              const trend = row.original.trends?.sg_putt
              const colorClass = getHeatmapColor(liveValue, "sg_putt")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "sg_arg",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG ARG<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_arg
              const trend = row.original.trends?.sg_arg
              const colorClass = getHeatmapColor(liveValue, "sg_arg")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "sg_app",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG APP<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_app
              const trend = row.original.trends?.sg_app
              const colorClass = getHeatmapColor(liveValue, "sg_app")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "sg_ott",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG OTT<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_ott
              const trend = row.original.trends?.sg_ott
              const colorClass = getHeatmapColor(liveValue, "sg_ott")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "sg_t2g",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG T2G<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_t2g
              const trend = row.original.trends?.sg_t2g
              const colorClass = getHeatmapColor(liveValue, "sg_t2g")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
          {
            accessorKey: "sg_total",
            header: ({ column }: { column: Column<DisplayPlayer, unknown> }) => (
              <div className="text-center cursor-pointer flex items-center justify-center" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                SG TOTAL<ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
              </div>
            ),
            cell: ({ row }: { row: Row<DisplayPlayer> }) => {
              const liveValue = (row.original as LiveTournamentStat).sg_total
              const trend = row.original.trends?.sg_total
              const colorClass = getHeatmapColor(liveValue, "sg_total")
              return <StatCell value={liveValue} colorClass={colorClass} trend={trend} />
            },
            meta: { headerClassName: 'text-center', cellClassName: 'text-center' },
          },
        ]
      }
    },
    [dataView, getHeatmapColor]
  )

  return columns
}
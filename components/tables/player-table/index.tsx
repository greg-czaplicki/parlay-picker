"use client"

import { useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TestColors } from "./test-colors"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from "@tanstack/react-table"
import { useColumns } from "./columns"
import { SyncControls } from "./sync-controls"
import { usePlayerData } from "@/hooks/use-player-data"
import type { PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"

interface PlayerTableProps {
  initialSeasonSkills: PlayerSkillRating[]
  initialLiveStats: LiveTournamentStat[]
}

export default function PlayerTable({ initialSeasonSkills, initialLiveStats }: PlayerTableProps) {
  const [dataView, setDataView] = useState<"season" | "tournament">("tournament")
  const [roundFilter, setRoundFilter] = useState<string>("event_avg")

  const {
    sorting,
    setSorting,
    displayPlayers,
    loading,
    isSyncingSkills,
    isSyncingLive,
    lastSkillUpdate,
    lastLiveUpdate,
    currentLiveEvent,
    getHeatmapColor,
    triggerSkillSyncAndRefetch,
    triggerLiveSyncAndRefetch
  } = usePlayerData({
    initialSeasonSkills,
    initialLiveStats,
    dataView,
    roundFilter
  })

  const columns = useColumns({ dataView, getHeatmapColor })

  const table = useReactTable({
    data: displayPlayers,
    columns,
    initialState: {
      get sorting() {
        if (dataView === 'tournament') {
          return [{ id: 'total', desc: false }]
        } else {
          return [{ id: 'sg_total', desc: true }]
        }
      }
    },
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Round filter options
  const roundOptions = ["1", "2", "3", "4", "event_avg"]

  return (
    <div>
      <Card className="glass-card">
        <CardContent className="p-6">
          {/* Header Section with Toggles and Sync Buttons */}
          <div className="flex justify-between items-center mb-4">
            {/* Title and View Toggle */}
            <div>
              <h2 className="text-xl font-bold">Player Stats</h2>
              <div className="mt-2 flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="radio" 
                    name="dataView" 
                    value="season" 
                    checked={dataView === 'season'} 
                    onChange={() => setDataView('season')} 
                    className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"
                  />
                  <span className="text-sm">Season Skills</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input 
                    type="radio" 
                    name="dataView" 
                    value="tournament" 
                    checked={dataView === 'tournament'} 
                    onChange={() => setDataView('tournament')} 
                    className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"
                  />
                  <span className="text-sm">Current</span>
                </label>
              </div>
              {dataView === 'tournament' && currentLiveEvent && (
                <p className="text-xs text-gray-400 mt-1">Event: {currentLiveEvent}</p>
              )}
            </div>
            
            {/* Sync Buttons and Timestamps */}
            <SyncControls
              lastSkillUpdate={lastSkillUpdate}
              lastLiveUpdate={lastLiveUpdate}
              isSyncingSkills={isSyncingSkills}
              isSyncingLive={isSyncingLive}
              currentLiveEvent={currentLiveEvent}
              onSyncSkills={triggerSkillSyncAndRefetch}
              onSyncLive={triggerLiveSyncAndRefetch}
            />
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
          {loading && displayPlayers.length === 0 ? (
            <div className="text-center py-8">... Loading ...</div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              {/* Super simple fixed-width table */}
              <Table 
                style={{ 
                  borderCollapse: 'collapse', 
                  borderSpacing: 0,
                  tableLayout: 'fixed',
                  width: '100%'
                }}
                className="border-collapse"
              >
                {/* Define column widths explicitly */}
                <colgroup>
                  {dataView === "season" ? 
                    <>
                      <col style={{ width: "170px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                    </> : 
                    <>
                      <col style={{ width: "50px" }} />
                      <col style={{ width: "170px" }} />
                      <col style={{ width: "60px" }} />
                      <col style={{ width: "50px" }} />
                      <col style={{ width: "50px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                      <col style={{ width: "75px" }} />
                    </>
                  }
                </colgroup>
                <TableHeader className="bg-[#1e1e23]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id}
                          style={{ padding: "4px 8px" }}
                          className={`text-white whitespace-nowrap text-xs sm:text-sm ${(header.column.columnDef.meta as any)?.headerClassName}`}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.original.dg_id}
                        data-state={row.getIsSelected() && "selected"}
                        style={{ border: 'none', margin: 0, padding: 0 }}
                        className="hover:bg-[#2a2a35] border-0"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell 
                            key={cell.id}
                            style={{ 
                              padding: 0, 
                              border: '1px solid rgba(75, 85, 99, 0.15)',
                              borderCollapse: 'collapse'
                            }}
                            className={`p-0 text-xs sm:text-sm ${(cell.column.columnDef.meta as any)?.cellClassName}`}
                          >
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
        </CardContent>
      </Card>
    </div>
  )
}
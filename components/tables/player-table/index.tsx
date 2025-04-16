"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
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
  const [dataView, setDataView] = useState<"season" | "tournament">("season")
  const [roundFilter, setRoundFilter] = useState<string>("event_avg")
  const [currentEventEnded, setCurrentEventEnded] = useState<boolean | null>(null) // null = loading
  const [eventOptions, setEventOptions] = useState<{ event_id: number, event_name: string }[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const eventOptionsLoaded = useRef(false)

  useEffect(() => {
    let mounted = true;
    async function checkEventOngoing() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) {
        if (mounted) setCurrentEventEnded(true)
        return
      }
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const today = new Date().toISOString().split('T')[0]
      // Find an event where start_date <= today <= end_date
      const { data, error } = await supabase
        .from('tournaments')
        .select('event_name, start_date, end_date')
        .lte('start_date', today)
        .gte('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
      if (!mounted) return
      if (error || !data || data.length === 0) {
        setCurrentEventEnded(true)
        setDataView('season')
        return
      }
      setCurrentEventEnded(false)
      setDataView('tournament')
    }
    checkEventOngoing()
    return () => { mounted = false }
  }, [])

  // Fetch all events for this week (or next 7 days)
  useEffect(() => {
    async function fetchEventsForWeek() {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || !supabaseAnonKey) return
      const supabase = createClient(supabaseUrl, supabaseAnonKey)
      const today = new Date()
      const weekFromToday = new Date(today)
      weekFromToday.setDate(today.getDate() + 7)
      const todayStr = today.toISOString().split('T')[0]
      const weekStr = weekFromToday.toISOString().split('T')[0]
      // Find tournaments where any part of the event is in this week
      const { data, error } = await supabase
        .from('tournaments')
        .select('event_id, event_name, start_date, end_date')
        .lte('start_date', weekStr)
        .gte('end_date', todayStr)
        .order('start_date', { ascending: true })
      if (!error && data) {
        setEventOptions(data)
        if (!eventOptionsLoaded.current && data.length > 0) {
          setSelectedEventId(data[0].event_id)
          eventOptionsLoaded.current = true
        }
      }
    }
    fetchEventsForWeek()
  }, [])

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
    roundFilter,
    selectedEventId // pass to hook
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
              {/* Event selector if multiple events */}
              {eventOptions.length > 1 && (
                <div className="mt-2 mb-2">
                  <label className="text-sm mr-2">Event:</label>
                  <select
                    value={selectedEventId ?? ''}
                    onChange={e => setSelectedEventId(Number(e.target.value))}
                    className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
                  >
                    {eventOptions.map(ev => (
                      <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Only render radio group after async check completes */}
              {currentEventEnded !== null && (
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
                  {/* Only show Current radio if event is not ended */}
                  {!currentEventEnded && (
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
                  )}
                </div>
              )}
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
                          style={{ 
                            padding: "4px 8px",
                            ...(header.column.columnDef.meta as any)?.customStyles?.header
                          }}
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
                              borderTopWidth: 1,
                              borderRightWidth: 1,
                              borderBottomWidth: 1,
                              borderLeftWidth: 1,
                              borderTopStyle: 'solid',
                              borderRightStyle: 'solid',
                              borderBottomStyle: 'solid',
                              borderLeftStyle: 'solid',
                              borderTopColor: 'rgba(75, 85, 99, 0.15)',
                              borderRightColor: 'rgba(75, 85, 99, 0.15)',
                              borderBottomColor: 'rgba(75, 85, 99, 0.15)',
                              borderLeftColor: 'rgba(75, 85, 99, 0.15)',
                              borderCollapse: 'collapse',
                              // Only allow customStyles to override individual border sides, not any border shorthand
                              ...(cell.column.columnDef.meta && cell.column.columnDef.meta.customStyles && cell.column.columnDef.meta.customStyles.cell
                                ? Object.fromEntries(Object.entries(cell.column.columnDef.meta.customStyles.cell).filter(([k]) => !k.startsWith('border') || [
                                  'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
                                  'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
                                  'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'
                                ].includes(k)))
                                : {})
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
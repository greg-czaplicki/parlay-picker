"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
} from "@tanstack/react-table"
import { useColumns } from "./columns"
import { usePlayerTableQuery } from "@/hooks/use-player-table-query"
import { useInitializePlayerView } from "@/hooks/use-initialize-player-view"
import type { PlayerSkillRating, LiveTournamentStat, PgaTourPlayerStats } from "@/types/definitions"

interface PlayerTableProps {
  initialSeasonSkills: PlayerSkillRating[]
  initialLiveStats: LiveTournamentStat[]
  initialPgaTourStats?: PgaTourPlayerStats[]
}

// Heatmap classes for SG columns
const HEATMAP_CLASSES = [
  'heatmap-bg-0', // strong red
  'heatmap-bg-1', // orange
  'heatmap-bg-2', // yellow/peach
  'heatmap-bg-3', // light yellow (neutral)
  'heatmap-bg-4', // light green
  'heatmap-bg-5', // green
  'heatmap-bg-6', // strong green
];

export default function PlayerTable({ 
  initialSeasonSkills, 
  initialLiveStats, 
  initialPgaTourStats = [] 
}: PlayerTableProps) {
  console.log('PlayerTable render');
  const [roundFilter, setRoundFilter] = useState<string>("event_avg")
  const [dataSource, setDataSource] = useState<'data_golf' | 'pga_tour'>('pga_tour') // Default to PGA Tour data
  
  // Use custom hook to manage view state and event selection
  const {
    dataView,
    setDataView,
    selectedEventId,
    setSelectedEventId,
    eventOptions,
    currentEventEnded
  } = useInitializePlayerView()

  // Use new React Query hook for all data
  const {
    seasonSkills,
    seasonSkillsLoading,
    seasonSkillsError,
    liveStats,
    liveStatsLoading,
    liveStatsError,
    pgaTourStats,
    pgaTourStatsLoading,
    pgaTourStatsError
  } = usePlayerTableQuery({
    eventId: selectedEventId,
    dataView,
    dataSource,
    roundFilter,
    eventOptions
  })
  console.log('usePlayerTableQuery', { seasonSkills, liveStats, pgaTourStats });

  // Round filter options
  const roundOptions = ["1", "2", "3", "4", "event_avg"]

  // Memoized getHeatmapColor function for season (stub)
  const getHeatmapColor = useCallback(
    (value: number | null, statKey: string, isHigherBetter: boolean = true) => {
      return ""
    },
    []
  )

  // Call useColumns directly at the top level for both views
  const seasonPlayers = useMemo(() => (seasonSkills ?? []) as PlayerSkillRating[], [seasonSkills])
  const seasonColumns = useColumns<PlayerSkillRating>({ dataView: 'season', getHeatmapColor, data: seasonPlayers })

  // Tournament heatmap logic
  const SG_COLUMNS = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_t2g', 'sg_total'];
  const sgStats = useMemo(() => {
    const stats: Record<string, { softMax: number }> = {};
    SG_COLUMNS.forEach(col => {
      const values = (liveStats ?? []).map((p: any) => Math.abs(Number(p[col]) || 0)).filter(v => !isNaN(v));
      if (values.length) {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.floor(0.9 * (sorted.length - 1));
        stats[col] = { softMax: sorted[idx] };
      } else {
        stats[col] = { softMax: 1 };
      }
    });
    return stats;
  }, [liveStats]);
  const getTournamentHeatmapColor = useCallback((value: number | null, statKey: string) => {
    if (!SG_COLUMNS.includes(statKey) || value == null) return '';
    const softMax = sgStats[statKey]?.softMax || 1;
    const norm = Math.max(-1, Math.min(1, value / softMax));
    const idx = Math.round(((norm + 1) / 2) * 6);
    return HEATMAP_CLASSES[idx];
  }, [sgStats]);
  const tournamentPlayers = useMemo(() => (liveStats ?? []) as LiveTournamentStat[], [liveStats])
  const tournamentColumns = useColumns<LiveTournamentStat>({ dataView: 'tournament', getHeatmapColor: getTournamentHeatmapColor, data: tournamentPlayers })

  let columns, displayPlayers, loading, table
  if (dataView === 'season') {
    columns = seasonColumns
    displayPlayers = seasonPlayers
    loading = seasonSkillsLoading
    table = useReactTable<PlayerSkillRating>({
      data: displayPlayers,
      columns,
      initialState: {
        get sorting() {
          return [{ id: 'sg_total', desc: true }]
        }
      },
      state: {
        sorting: [],
      },
      onSortingChange: () => {},
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    })
  } else {
    columns = tournamentColumns
    displayPlayers = tournamentPlayers
    loading = liveStatsLoading
    table = useReactTable<LiveTournamentStat>({
      data: displayPlayers,
      columns,
      initialState: {
        get sorting() {
          return [{ id: 'total', desc: false }]
        }
      },
      state: {
        sorting: [],
      },
      onSortingChange: () => {},
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
    })
  }

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
                    onChange={e => {
                      if (typeof window !== 'undefined') {
                        try {
                          localStorage.removeItem('gpp_live_stats_cache_v1');
                        } catch {}
                      }
                      setSelectedEventId(Number(e.target.value))
                    }}
                    className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
                  >
                    {eventOptions.map(ev => (
                      <option key={ev.dg_id} value={ev.dg_id}>{ev.name}</option>
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
          {loading && displayPlayers.length === 0 ? (
            <div className="text-center py-8">... Loading ...</div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-gray-800">
              {/* Super simple fixed-width table */}
              {dataView === 'season' ? (
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
                    <col style={{ width: "170px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "75px" }} />
                  </colgroup>
                  <TableHeader className="bg-[#1e1e23]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead 
                            key={header.id}
                            style={{ 
                              padding: "4px 8px",
                              ...(header.column.columnDef.meta && (header.column.columnDef.meta as any).customStyles && (header.column.columnDef.meta as any).customStyles.header
                                ? (header.column.columnDef.meta as any).customStyles.header
                                : {})
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
                    {table.getRowModel().rows.map((row) => {
                      return (
                        <TableRow
                          key={row.id}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell 
                              key={cell.id}
                              style={{
                                padding: 0,
                                ...(cell.column.columnDef.meta && (cell.column.columnDef.meta as any).customStyles && (cell.column.columnDef.meta as any).customStyles.cell
                                  ? Object.fromEntries(Object.entries((cell.column.columnDef.meta as any).customStyles.cell).filter(([k]) => !k.startsWith('border') || [
                                    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
                                    'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
                                    'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'
                                  ].includes(k)))
                                  : {})
                              }}
                              className={`p-0 text-xs sm:text-sm ${(cell.column.columnDef.meta as any)?.cellClassName}`}
                            >
                              {flexRender(cell.column.columnDef.cell as any, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              ) : (
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
                  </colgroup>
                  <TableHeader className="bg-[#1e1e23]">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead 
                            key={header.id}
                            style={{ 
                              padding: "4px 8px",
                              ...(header.column.columnDef.meta && (header.column.columnDef.meta as any).customStyles && (header.column.columnDef.meta as any).customStyles.header
                                ? (header.column.columnDef.meta as any).customStyles.header
                                : {})
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
                    {table.getRowModel().rows.map((row) => {
                      return (
                        <TableRow
                          key={row.id}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell 
                              key={cell.id}
                              style={{
                                padding: 0,
                                ...(cell.column.columnDef.meta && (cell.column.columnDef.meta as any).customStyles && (cell.column.columnDef.meta as any).customStyles.cell
                                  ? Object.fromEntries(Object.entries((cell.column.columnDef.meta as any).customStyles.cell).filter(([k]) => !k.startsWith('border') || [
                                    'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth',
                                    'borderTopStyle','borderRightStyle','borderBottomStyle','borderLeftStyle',
                                    'borderTopColor','borderRightColor','borderBottomColor','borderLeftColor'
                                  ].includes(k)))
                                  : {})
                              }}
                              className={`p-0 text-xs sm:text-sm ${(cell.column.columnDef.meta as any)?.cellClassName}`}
                            >
                              {flexRender(cell.column.columnDef.cell as any, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
'use client'
import { useState, useMemo, useCallback, Suspense } from 'react'
import { useSeasonPlayersQuery } from '@/hooks/use-season-players-query'
import { useColumns } from './columns'
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { PlayerTablePresentation } from './player-table-presentation'
import { PlayerTableFilters } from './player-table-filters'
import { PlayerTableSkeleton } from './player-table-skeleton'

/**
 * SeasonPlayerTableContainer
 *
 * Displays the season-long player stats table. Handles data source selection (DataGolf or PGA Tour).
 * Uses Suspense for loading states and a skeleton loader for UX.
 * Renders PlayerTableFilters and PlayerTablePresentation.
 */
export function SeasonPlayerTableContainer() {
  const [dataSource, setDataSource] = useState<'data_golf' | 'pga_tour'>('pga_tour')
  const { data: seasonStats } = useSeasonPlayersQuery({ dataSource })

  const getHeatmapColor = useCallback(() => '', [])
  const columns = useColumns<any>({ dataView: 'season', getHeatmapColor })
  const displayPlayers = useMemo(() => seasonStats ?? [], [seasonStats])

  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: [] },
    onSortingChange: () => {},
    initialState: {
      get sorting() {
        return [{ id: 'sg_total', desc: true }]
      }
    },
  })

  return (
    <Suspense fallback={<PlayerTableSkeleton rows={10} columns={8} />}>
      <div>
        <PlayerTableFilters
          dataView="season"
          dataSource={dataSource}
          setDataSource={setDataSource}
        />
        <PlayerTablePresentation
          table={table}
        />
      </div>
    </Suspense>
  )
} 
'use client'
import { useState, useMemo, useCallback, Suspense, memo } from 'react'
import { useSeasonPlayersQuery } from '@/hooks/use-season-players-query'
import { useColumns } from './columns'
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { PlayerTablePresentation } from './player-table-presentation'
import { PlayerTableFilters } from './player-table-filters'
import { PlayerTableSkeleton } from './player-table-skeleton'

/**
 * SeasonPlayerTableContainer
 *
 * Displays the season-long player stats table with pagination for performance.
 * Uses Suspense for loading states and a skeleton loader for UX.
 * Renders PlayerTableFilters and PlayerTablePresentation.
 */
function SeasonPlayerTableContainerComponent() {
  // All state hooks - consistent order
  const [dataSource, setDataSource] = useState<'data_golf' | 'pga_tour'>('pga_tour')
  const [currentPage, setCurrentPage] = useState(0)
  
  // Constants  
  const limit = 50
  const offset = currentPage * limit

  // Data fetching
  const { data: seasonStats } = useSeasonPlayersQuery({ 
    dataSource, 
    limit, 
    offset 
  })

  // Simple callbacks
  const getHeatmapColor = useCallback(() => '', [])
  
  const handleDataSourceChange = useCallback((newDataSource: 'data_golf' | 'pga_tour') => {
    setDataSource(newDataSource)
    setCurrentPage(0)
  }, [])

  const handlePrevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(0, prev - 1))
  }, [])

  const handleNextPage = useCallback(() => {
    if (seasonStats && seasonStats.length === limit) {
      setCurrentPage(prev => prev + 1)
    }
  }, [seasonStats, limit])

  // Simple memoized values
  const columns = useColumns({ dataView: 'season', getHeatmapColor })
  const displayPlayers = seasonStats ?? []

  // Direct useReactTable call - no complex memoization
  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      sorting: [{ id: 'sg_total', desc: true }]
    },
  })

  // Simple computed values
  const canGoPrev = currentPage > 0
  const canGoNext = seasonStats && seasonStats.length === limit
  const currentRange = `${offset + 1}-${offset + (seasonStats?.length || 0)}`
  const currentPageNumber = currentPage + 1

  return (
    <Suspense fallback={<PlayerTableSkeleton rows={10} columns={8} />}>
      <div>
        <PlayerTableFilters
          dataView="season"
          dataSource={dataSource}
          setDataSource={handleDataSourceChange}
        />
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-400">
            Showing {currentRange} players
          </div>
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={!canGoPrev}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-gray-300">
              Page {currentPageNumber}
            </span>
            <button
              onClick={handleNextPage}
              disabled={!canGoNext}
              className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        <PlayerTablePresentation table={table} />
      </div>
    </Suspense>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const SeasonPlayerTableContainer = memo(SeasonPlayerTableContainerComponent) 
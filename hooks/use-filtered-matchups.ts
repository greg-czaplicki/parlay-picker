import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMatchupsQuery, MatchupRow } from './use-matchups-query'
import { FilterService } from '@/filters/filter-service'
import { FilterOptions } from '@/filters/types'
import { useDebounce } from './use-debounce'
import { queryKeys } from '@/lib/query-keys'

interface UseFilteredMatchupsOptions {
  filterIds?: string[]
  filterOptions?: Record<string, FilterOptions>
  debounceMs?: number
  enableCaching?: boolean
}

interface FilteredMatchupsResult {
  data: MatchupRow[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  originalCount: number
  filteredCount: number
  appliedFilters: string[]
  lastUpdateTime: string | null
  performance: {
    filterTime: number
    cacheHit: boolean
  }
}

export function useFilteredMatchups(
  eventId: number | null,
  matchupType: "2ball" | "3ball",
  roundNum?: number | null,
  options: UseFilteredMatchupsOptions = {}
): FilteredMatchupsResult {
  const {
    filterIds = [],
    filterOptions = {},
    debounceMs = 300,
    enableCaching = true,
  } = options

  // Debounce filter changes to prevent excessive processing
  const debouncedFilterIds = useDebounce(filterIds, debounceMs)
  const debouncedFilterOptions = useDebounce(filterOptions, debounceMs)

  // Get base matchups data
  const baseQuery = useMatchupsQuery(eventId, matchupType, roundNum)

  // Create cache key for filtered results
  const cacheKey = useMemo(() => {
    return [
      'filtered-matchups',
      eventId,
      matchupType,
      roundNum,
      debouncedFilterIds.join(','),
      JSON.stringify(debouncedFilterOptions),
    ]
  }, [eventId, matchupType, roundNum, debouncedFilterIds, debouncedFilterOptions])

  // Query for filtered results with caching
  const filteredQuery = useQuery({
    queryKey: cacheKey,
    queryFn: async () => {
      const startTime = performance.now()
      const filterService = FilterService.getInstance()

      if (!baseQuery.data || debouncedFilterIds.length === 0) {
        return {
          data: baseQuery.data || [],
          originalCount: baseQuery.data?.length || 0,
          filteredCount: baseQuery.data?.length || 0,
          appliedFilters: [],
          performance: {
            filterTime: 0,
            cacheHit: false,
          },
        }
      }

      let filteredData = baseQuery.data
      let appliedFilters: string[] = []

      // Apply filters sequentially
      for (const filterId of debouncedFilterIds) {
        const filter = filterService.getFilterById(filterId)
        if (filter) {
          const options = debouncedFilterOptions[filterId] || {}
          const result = filter.applyFilter(filteredData, options)
          filteredData = result.filtered
          appliedFilters.push(filterId)
        }
      }

      const endTime = performance.now()

      return {
        data: filteredData,
        originalCount: baseQuery.data.length,
        filteredCount: filteredData.length,
        appliedFilters,
        performance: {
          filterTime: endTime - startTime,
          cacheHit: false,
        },
      }
    },
    enabled: !!baseQuery.data && !baseQuery.isLoading,
    staleTime: enableCaching ? 1000 * 60 * 2 : 0, // 2 minutes cache
    gcTime: enableCaching ? 1000 * 60 * 10 : 0, // 10 minutes garbage collection
  })

  // Memoize the final result
  const result = useMemo(() => {
    if (baseQuery.isLoading) {
      return {
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        originalCount: 0,
        filteredCount: 0,
        appliedFilters: [],
        lastUpdateTime: null,
        performance: { filterTime: 0, cacheHit: false },
      }
    }

    if (baseQuery.isError) {
      return {
        data: undefined,
        isLoading: false,
        isError: true,
        error: baseQuery.error,
        originalCount: 0,
        filteredCount: 0,
        appliedFilters: [],
        lastUpdateTime: null,
        performance: { filterTime: 0, cacheHit: false },
      }
    }

    const queryResult = filteredQuery.data || {
      data: baseQuery.data || [],
      originalCount: baseQuery.data?.length || 0,
      filteredCount: baseQuery.data?.length || 0,
      appliedFilters: [],
      performance: { filterTime: 0, cacheHit: false },
    }

    return {
      data: queryResult.data,
      isLoading: filteredQuery.isLoading,
      isError: filteredQuery.isError,
      error: filteredQuery.error,
      originalCount: queryResult.originalCount,
      filteredCount: queryResult.filteredCount,
      appliedFilters: queryResult.appliedFilters,
      lastUpdateTime: baseQuery.lastUpdateTime,
      performance: {
        ...queryResult.performance,
        cacheHit: !filteredQuery.isFetching && !!filteredQuery.data,
      },
    }
  }, [baseQuery, filteredQuery])

  return result
} 
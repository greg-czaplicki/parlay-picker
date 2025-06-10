import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRecommendedPicksQuery, Player } from './use-recommended-picks-query'
import { FilterService } from '@/filters/filter-service'
import { FilterOptions } from '@/filters/types'
import { useDebounce } from './use-debounce'

interface UseFilteredPlayersOptions {
  filterIds?: string[]
  filterOptions?: Record<string, FilterOptions>
  debounceMs?: number
  enableCaching?: boolean
  bookmaker?: string
  oddsGapPercentage?: number
  limit?: number
  sharedMatchupsData?: any[]
}

interface FilteredPlayersResult {
  data: Player[] | undefined
  isLoading: boolean
  isError: boolean
  error: Error | null
  originalCount: number
  filteredCount: number
  appliedFilters: string[]
  performance: {
    filterTime: number
    cacheHit: boolean
  }
}

export function useFilteredPlayers(
  eventId: number | null,
  matchupType: "2ball" | "3ball",
  roundNum?: number | null,
  options: UseFilteredPlayersOptions = {}
): FilteredPlayersResult {
  const {
    filterIds = [],
    filterOptions = {},
    debounceMs = 300,
    enableCaching = true,
    bookmaker = "fanduel",
    oddsGapPercentage = 40,
    limit = 10,
    sharedMatchupsData,
  } = options

  // Debounce filter changes to prevent excessive processing
  const debouncedFilterIds = useDebounce(filterIds, debounceMs)
  const debouncedFilterOptions = useDebounce(filterOptions, debounceMs)

  // Get base player recommendations data - ALWAYS call this hook, but disable when we have shared data
  const baseQuery = useRecommendedPicksQuery(
    sharedMatchupsData ? null : eventId, // Pass null when we have shared data to disable the query
    matchupType, 
    bookmaker, 
    oddsGapPercentage, 
    limit, 
    roundNum
  )

  // Use shared data if provided, otherwise use the query result
  // Always call useMemo to avoid Rules of Hooks violations
  const basePlayersData = useMemo(() => {
    // If we have shared data, transform it to Player format
    if (sharedMatchupsData && sharedMatchupsData.length > 0) {
      let result: Player[] = [];
      for (const matchup of sharedMatchupsData) {
        if (!matchup || typeof matchup !== 'object') continue;
        
        if (matchupType === "3ball") {
          if (!matchup.player1_name || !matchup.player2_name || !matchup.player3_name) continue;
          result.push(
            {
              dg_id: matchup.player1_dg_id || 0,
              name: matchup.player1_name,
              odds: matchup.odds1,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: matchup.uuid,
              eventName: matchup.event_name,
              roundNum: matchup.round_num
            },
            {
              dg_id: matchup.player2_dg_id || 0,
              name: matchup.player2_name,
              odds: matchup.odds2,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: matchup.uuid,
              eventName: matchup.event_name,
              roundNum: matchup.round_num
            },
            {
              dg_id: matchup.player3_dg_id || 0,
              name: matchup.player3_name,
              odds: matchup.odds3,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: matchup.uuid,
              eventName: matchup.event_name,
              roundNum: matchup.round_num
            }
          );
        } else {
          // 2ball
          if (!matchup.player1_name || !matchup.player2_name) continue;
          result.push(
            {
              dg_id: matchup.player1_dg_id || 0,
              name: matchup.player1_name,
              odds: matchup.odds1,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: matchup.uuid,
              eventName: matchup.event_name,
              roundNum: matchup.round_num
            },
            {
              dg_id: matchup.player2_dg_id || 0,
              name: matchup.player2_name,
              odds: matchup.odds2,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: matchup.uuid,
              eventName: matchup.event_name,
              roundNum: matchup.round_num
            }
          );
        }
      }
      return result;
    }
    
    // Otherwise use query data
    return baseQuery.data || [];
  }, [sharedMatchupsData, matchupType, baseQuery.data]);

  // Create cache key for filtered results
  const cacheKey = useMemo(() => {
    return [
      'filtered-players',
      eventId,
      matchupType,
      roundNum,
      bookmaker,
      oddsGapPercentage,
      limit,
      debouncedFilterIds.join(','),
      JSON.stringify(debouncedFilterOptions),
    ]
  }, [
    eventId, 
    matchupType, 
    roundNum, 
    bookmaker, 
    oddsGapPercentage, 
    limit,
    debouncedFilterIds, 
    debouncedFilterOptions
  ])

  // Apply filters with performance tracking
  const { data: filteredPlayers, performance: filterPerformance } = useMemo((): {
    data: Player[]
    performance: { filterTime: number; cacheHit: boolean }
  } => {
    const startTime = typeof window !== 'undefined' ? window.performance.now() : Date.now()
    
    // Use basePlayersData instead of baseQuery.data
    if (!basePlayersData || basePlayersData.length === 0) {
      return {
        data: [],
        performance: { filterTime: 0, cacheHit: false }
      }
    }

    // If no filters, return original data
    if (debouncedFilterIds.length === 0) {
      return {
        data: basePlayersData,
        performance: { 
          filterTime: typeof window !== 'undefined' ? window.performance.now() - startTime : Date.now() - startTime, 
          cacheHit: false 
        }
      }
    }

    // Apply filters using the FilterService instance
    const filterService = FilterService.getInstance()
    let filteredData = basePlayersData
    
    // Apply filters sequentially
    for (const filterId of debouncedFilterIds) {
      const filter = filterService.getFilterById(filterId)
      if (filter) {
        const options = debouncedFilterOptions[filterId] || {}
        const result = filter.applyFilter(filteredData, options)
        filteredData = result.filtered
      }
    }

    return {
      data: filteredData,
      performance: { 
        filterTime: typeof window !== 'undefined' ? window.performance.now() - startTime : Date.now() - startTime, 
        cacheHit: false 
      }
    }
  }, [basePlayersData, debouncedFilterIds, debouncedFilterOptions])

  // Calculate loading and error states
  const isLoading = sharedMatchupsData ? false : baseQuery.isLoading;
  const isError = sharedMatchupsData ? false : baseQuery.isError;
  const error = sharedMatchupsData ? null : baseQuery.error;

  return {
    data: filteredPlayers,
    isLoading,
    isError,
    error,
    originalCount: basePlayersData?.length || 0,
    filteredCount: filteredPlayers?.length || 0,
    appliedFilters: debouncedFilterIds,
    performance: filterPerformance,
  }
} 
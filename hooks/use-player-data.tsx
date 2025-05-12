"use client"

import { useState } from "react"
import { useSeasonPlayersQuery } from './use-season-players-query'
import { useInTournamentPlayersQuery } from './use-in-tournament-players-query'
import { usePlayerStatsQuery } from './use-player-stats-query'
import { useQuery } from '@tanstack/react-query'

interface UsePlayerDataProps {
  dataView: 'season' | 'tournament'
  dataSource: 'data_golf' | 'pga_tour'
  roundFilter: string
  selectedEventId?: number | null
  eventOptions: Array<{ event_id: number, event_name: string }>
  playerIds?: number[] // for usePlayerStatsQuery if needed
}

export function usePlayerData({
  dataView,
  dataSource,
  roundFilter,
  selectedEventId,
  eventOptions,
  playerIds = []
}: UsePlayerDataProps) {
  // UI state only
  const [sorting, setSorting] = useState<any>([])

  // Data fetching via React Query hooks
  const seasonQuery = dataView === 'season'
    ? useSeasonPlayersQuery({ dataSource })
    : null

  const tournamentQuery = dataView === 'tournament' && selectedEventId
    ? useInTournamentPlayersQuery({ eventId: selectedEventId, round: roundFilter, eventOptions })
    : null

  // Optionally, fetch player stats for a specific event/round/player set
  const playerStatsQuery = dataView === 'tournament' && selectedEventId && playerIds.length > 0
    ? usePlayerStatsQuery(selectedEventId, Number(roundFilter), playerIds)
    : null

  // Compose display data
  let displayPlayers: any[] = []
  let isLoading = false
  let isError = false
  let error: Error | null = null

  if (dataView === 'season' && seasonQuery) {
    displayPlayers = seasonQuery.data || []
    isLoading = seasonQuery.isLoading
    isError = seasonQuery.isError
    error = seasonQuery.error as Error | null
  } else if (dataView === 'tournament' && tournamentQuery) {
    displayPlayers = tournamentQuery.data || []
    isLoading = tournamentQuery.isLoading
    isError = tournamentQuery.isError
    error = tournamentQuery.error as Error | null
  } else if (playerStatsQuery) {
    displayPlayers = playerStatsQuery.data || []
    isLoading = playerStatsQuery.isLoading
    isError = playerStatsQuery.isError
    error = playerStatsQuery.error
  }

  // Return only UI state and fetched data
  return {
    displayPlayers,
    isLoading,
    isError,
    error,
    sorting,
    setSorting,
  }
}

export function useTournamentSchedule() {
  return useQuery({
    queryKey: ['tournamentSchedule'],
    queryFn: async () => {
      const res = await fetch('/api/schedule/sync')
      const data = await res.json()
      if (!data.success || !data.processedCount) {
        throw new Error(data.error || 'Failed to fetch schedule')
      }
      return data
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 30, // 30 days
  })
}
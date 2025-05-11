import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface DirectPlayer {
  id: string
  name: string
  sgTotal: number
  sgTeeToGreen: number
  sgApproach: number
  sgAroundGreen: number
  sgPutting: number
  drivingAccuracy?: number
  drivingDistance?: number
}

export function useDirectPlayerStatsQuery() {
  return useQuery<DirectPlayer[], Error>({
    queryKey: queryKeys.playerData.direct(),
    queryFn: async () => {
      const response = await fetch('/api/direct-player-stats')
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'API returned success: false')
      return data.players as DirectPlayer[]
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
} 
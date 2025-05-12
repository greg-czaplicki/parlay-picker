import { useQuery } from '@tanstack/react-query'

export interface TopGolfer {
  name: string
  matchup: string
  odds: number
  valueRating: number
  confidenceScore: number
  bookmaker: string
}

export function useTopGolfersQuery(matchupType: string, activeFilter: string) {
  return useQuery<TopGolfer[], Error>({
    queryKey: ['topGolfers', matchupType, activeFilter],
    queryFn: async () => {
      const url = `/api/top-golfers?type=${matchupType}&filter=${encodeURIComponent(activeFilter)}&limit=10`
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`)
      const data = await response.json()
      if (!data.success) throw new Error(data.error || 'Failed to fetch top golfers')
      return data.topGolfers
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  })
} 
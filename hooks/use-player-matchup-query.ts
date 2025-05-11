import { useQuery } from '@tanstack/react-query'
import { findPlayerMatchup, PlayerMatchupData } from '@/app/actions/matchups'

export function usePlayerMatchupQuery(playerName: string) {
  return useQuery<PlayerMatchupData | null, Error>({
    queryKey: ['playerMatchup', playerName],
    queryFn: async () => {
      if (!playerName) return null
      const { matchup, error } = await findPlayerMatchup(playerName)
      if (error) throw new Error(error)
      return matchup
    },
    enabled: !!playerName,
    staleTime: 1000 * 60, // 1 minute
  })
} 
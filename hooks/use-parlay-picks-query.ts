import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useParlayPicksQuery(parlayId: number) {
  return useQuery({
    queryKey: queryKeys.parlays.detail(parlayId),
    queryFn: async () => {
      const res = await fetch(`/api/parlay-picks?parlay_id=${parlayId}`)
      if (!res.ok) throw new Error('Failed to fetch picks')
      const data = await res.json()
      return data.picks
    },
    enabled: !!parlayId,
  })
} 
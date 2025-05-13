import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useParlaysQuery(userId: string) {
  return useQuery({
    queryKey: queryKeys.parlays.list({ user_id: userId }),
    queryFn: async () => {
      const res = await fetch(`/api/parlays?user_id=${userId}`)
      if (!res.ok) throw new Error('Failed to fetch parlays')
      const data = await res.json()
      return data.parlays
    },
    enabled: !!userId,
  })
} 
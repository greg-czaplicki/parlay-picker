import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface UpdateParlayPickInput {
  id: number
  [key: string]: any
}

export function useUpdateParlayPickMutation(parlayId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateParlayPickInput) => {
      const res = await fetch('/api/parlay-picks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to update pick')
      const data = await res.json()
      return data.pick
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parlays.detail(parlayId) })
    },
  })
} 
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface CreateParlayPickInput {
  parlay_id: number
  [key: string]: any
}

export function useCreateParlayPickMutation(parlayId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateParlayPickInput) => {
      const res = await fetch('/api/parlay-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to add pick')
      const data = await res.json()
      return data.pick
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parlays.detail(parlayId) })
    },
  })
} 
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

interface CreateParlayInput {
  name: string
  user_id: string
  amount: number
  odds: number
  payout: number
  round_num: number | null
  picks: Array<{
    matchup_id?: number
    picked_player_dg_id: number
    picked_player_name: string
  }>
}

export function useCreateParlayMutation(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateParlayInput) => {
      const res = await fetch('/api/parlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to create parlay')
      const data = await res.json()
      return data.parlay
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parlays.list({ user_id: userId }) })
    },
  })
} 
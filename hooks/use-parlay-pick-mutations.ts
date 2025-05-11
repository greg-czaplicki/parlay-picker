import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addParlayPick, removeParlayPick, deleteParlay, ParlayPick, ParlayWithPicks } from '@/app/actions/matchups'

/**
 * Mutation hook to add a parlay pick. Expects an object matching Omit<ParlayPick, 'id' | 'created_at'>.
 */
export function useAddParlayPickMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pickData: Omit<ParlayPick, 'id' | 'created_at'>) => {
      return addParlayPick(pickData)
    },
    onSuccess: () => {
      // Invalidate relevant queries (e.g., parlay picks)
      queryClient.invalidateQueries({ queryKey: ['parlayPicks'] })
    },
  })
}

/**
 * Mutation hook to remove a parlay pick by its pickId.
 */
export function useRemoveParlayPickMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (pickId: number) => {
      return removeParlayPick(pickId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parlayPicks'] })
    },
  })
}

/**
 * Mutation hook to delete a parlay by its parlayId.
 */
export function useDeleteParlayMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (parlayId: number) => {
      return deleteParlay(parlayId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parlays'] })
    },
  })
} 
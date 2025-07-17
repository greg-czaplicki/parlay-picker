"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function ManualIngestButton({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    setIsLoading(true)
    
    try {
      // Add cache-busting timestamp to bypass Vercel edge cache
      const timestamp = Date.now()
      const response = await fetch(`/api/matchups/refresh?_t=${timestamp}&_v=${Math.random()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Force bypass cache with these headers
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'X-Vercel-Skip-Cache': '1' // Vercel-specific header to skip edge cache
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh odds: ${response.statusText}`)
      }

      const result = await response.json()
      
      // Clear all cached data to ensure fresh fetch
      queryClient.removeQueries({ queryKey: queryKeys.matchups.all() })
      queryClient.removeQueries({ queryKey: queryKeys.recommendedPicks.all() })
      queryClient.removeQueries({ queryKey: queryKeys.oddsFreshness() })
      
      // Invalidate all matchup and related queries to force refetch
      await Promise.all([
        // Invalidate all matchup queries
        queryClient.invalidateQueries({ queryKey: queryKeys.matchups.all() }),
        // Invalidate recommended picks
        queryClient.invalidateQueries({ queryKey: queryKeys.recommendedPicks.all() }),
        // Invalidate odds freshness
        queryClient.invalidateQueries({ queryKey: queryKeys.oddsFreshness() }),
        // Invalidate current week events in case new events appeared
        queryClient.invalidateQueries({ queryKey: queryKeys.currentWeekEvents() }),
      ])

      // Force refetch with cache bypass for current data
      await queryClient.refetchQueries({ 
        queryKey: queryKeys.matchups.all(),
        type: 'active' // Only refetch active queries
      })
      
      toast({
        title: "🎯 Odds Refreshed!",
        description: `Updated ${result.inserted || 0} matchups from all tours. Fresh odds are now available!`,
        duration: 4000,
      })

      // No need to reload page - React Query cache invalidation handles the refresh

    } catch (error: any) {
      console.error('Manual ingest failed:', error)
      toast({
        title: "❌ Refresh Failed",
        description: error.message || "Failed to refresh odds. Please try again.",
        variant: "destructive",
        duration: 4000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleRefresh}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className={className}
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Refreshing...' : 'Refresh Odds'}
    </Button>
  )
} 
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/use-toast'

export function ManualIngestButton({ className }: { className?: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/matchups/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh odds: ${response.statusText}`)
      }

      const result = await response.json()
      
      toast({
        title: "🎯 Odds Refreshed!",
        description: `Updated ${result.inserted || 0} matchups from all tours`,
        duration: 3000,
      })

      // Refresh the page to show updated data
      window.location.reload()

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
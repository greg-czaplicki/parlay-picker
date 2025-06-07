"use client"

import { useOddsFreshness } from '@/hooks/use-odds-freshness'
import { Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OddsFreshnessIndicator({ className }: { className?: string }) {
  const { data, isLoading, error } = useOddsFreshness()

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Checking odds...</span>
      </div>
    )
  }

  if (error || !data?.success) {
    return (
      <div className={cn("flex items-center gap-1.5 text-sm text-red-500", className)}>
        <AlertCircle className="h-3 w-3" />
        <span>Odds status unavailable</span>
      </div>
    )
  }

  if (!data.lastUpdated) {
    return (
      <div className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}>
        <Clock className="h-3 w-3" />
        <span>No odds data</span>
      </div>
    )
  }

  // Format time display
  const getTimeDisplay = () => {
    if (data.isRecent) {
      return "Current"
    }
    
    if (data.minutesAgo < 60) {
      return `Updated ${data.minutesAgo}m ago`
    }
    
    const hoursAgo = Math.floor(data.minutesAgo / 60)
    if (hoursAgo < 24) {
      return `Updated ${hoursAgo}h ago`
    }
    
    const daysAgo = Math.floor(hoursAgo / 24)
    return `Updated ${daysAgo}d ago`
  }

  // Get status color and icon
  const getStatusInfo = () => {
    if (data.isRecent) {
      return {
        color: "text-green-500",
        icon: <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      }
    } else if (data.minutesAgo <= 60) {
      return {
        color: "text-yellow-500", 
        icon: <Clock className="h-3 w-3" />
      }
    } else {
      return {
        color: "text-red-500",
        icon: <AlertCircle className="h-3 w-3" />
      }
    }
  }

  const { color, icon } = getStatusInfo()

  return (
    <div className={cn("flex items-center gap-1.5 text-sm", color, className)}>
      {icon}
      <span className="font-medium">{getTimeDisplay()}</span>
    </div>
  )
} 
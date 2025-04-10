"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

interface SyncControlsProps {
  lastSkillUpdate: string | null
  lastLiveUpdate: string | null
  isSyncingSkills: boolean
  isSyncingLive: boolean
  currentLiveEvent: string | null
  onSyncSkills: () => void
  onSyncLive: () => void
}

export function SyncControls({
  lastSkillUpdate,
  lastLiveUpdate,
  isSyncingSkills,
  isSyncingLive,
  currentLiveEvent,
  onSyncSkills,
  onSyncLive
}: SyncControlsProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {/* Season Sync */}
      <div className="flex items-center gap-2">
        {lastSkillUpdate && !isSyncingSkills && (
          <span 
            className="text-xs text-gray-400" 
            title={`Data Golf skill file updated at ${new Date(lastSkillUpdate).toLocaleString()}`}
          >
            Season Source: {formatRelativeTime(lastSkillUpdate)}
          </span>
        )}
        {isSyncingSkills && <span className="text-xs text-gray-500">Syncing...</span>}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSyncSkills} 
          disabled={isSyncingSkills || isSyncingLive} 
          className="h-7 px-2"
        >
          {isSyncingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Sync Skills</span>
        </Button>
      </div>
      
      {/* Live Sync */}
      <div className="flex items-center gap-2">
        {lastLiveUpdate && !isSyncingLive && (
          <span 
            className="text-xs text-gray-400" 
            title={`Data Golf live stats file updated at ${new Date(lastLiveUpdate).toLocaleString()}`}
          >
            Live Source: {formatRelativeTime(lastLiveUpdate)}
          </span>
        )}
        {isSyncingLive && <span className="text-xs text-gray-500">Syncing...</span>}
        <Button
          variant="outline"
          size="sm"
          onClick={onSyncLive}
          disabled={isSyncingSkills || isSyncingLive}
          className="h-7 px-2"
        >
          {isSyncingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Sync Live</span>
        </Button>
      </div>
    </div>
  )
}
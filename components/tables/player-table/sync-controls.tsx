"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { formatRelativeTime } from "@/lib/utils"

interface SyncControlsProps {
  lastSkillUpdate: string | null
  lastPgaTourUpdate?: string | null
  lastLiveUpdate: string | null
  isSyncingSkills: boolean
  isSyncingPgaTour?: boolean
  isSyncingLive: boolean
  currentLiveEvent: string | null
  dataSource?: 'data_golf' | 'pga_tour'
  onSyncSkills: () => void
  onSyncPgaTour?: () => void
  onSyncLive: () => void
  onChangeDataSource?: (source: 'data_golf' | 'pga_tour') => void
}

export function SyncControls({
  lastSkillUpdate,
  lastPgaTourUpdate,
  lastLiveUpdate,
  isSyncingSkills,
  isSyncingPgaTour = false,
  isSyncingLive,
  currentLiveEvent,
  dataSource = "data_golf",
  onSyncSkills,
  onSyncPgaTour,
  onSyncLive,
  onChangeDataSource
}: SyncControlsProps) {
  // Get the active update timestamp based on data source
  const activeUpdateTimestamp = dataSource === 'pga_tour' ? lastPgaTourUpdate : lastSkillUpdate;
  const isAnySyncing = isSyncingSkills || isSyncingPgaTour || isSyncingLive;
  
  return (
    <div className="flex flex-col items-end gap-1">
      {/* Data Source Toggle - Only shown in Season view */}
      {onChangeDataSource && dataSource && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-400">Season Stats Source:</span>
          <div className="flex bg-gray-800 rounded-md p-0.5">
            <Button 
              variant={dataSource === 'data_golf' ? 'subtle' : 'ghost'}
              size="xs"
              onClick={() => onChangeDataSource('data_golf')}
              disabled={isAnySyncing}
              className={`h-6 px-2 text-xs ${dataSource === 'data_golf' ? 'bg-gray-700' : ''}`}
            >
              DataGolf
            </Button>
            <Button 
              variant={dataSource === 'pga_tour' ? 'subtle' : 'ghost'}
              size="xs"
              onClick={() => onChangeDataSource('pga_tour')}
              disabled={isAnySyncing}
              className={`h-6 px-2 text-xs ${dataSource === 'pga_tour' ? 'bg-gray-700' : ''}`}
            >
              PGA Tour
            </Button>
          </div>
        </div>
      )}
      
      {/* Season/Historical Stats Sync */}
      <div className="flex items-center gap-2">
        {activeUpdateTimestamp && !isAnySyncing && (
          <span 
            className="text-xs text-gray-400" 
            title={`${dataSource === 'pga_tour' ? 'PGA Tour' : 'Data Golf'} stats updated at ${new Date(activeUpdateTimestamp).toLocaleString()}`}
          >
            {onChangeDataSource ? 'Season' : 'Historical'} Stats: {formatRelativeTime(activeUpdateTimestamp)}
          </span>
        )}
        {(isSyncingSkills || isSyncingPgaTour) && (
          <span className="text-xs text-gray-500">Syncing...</span>
        )}
        
        {/* Only show appropriate sync button based on context */}
        {onChangeDataSource ? (
          /* Season view - show either DataGolf or PGA Tour sync button */
          dataSource === 'data_golf' ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSyncSkills} 
              disabled={isAnySyncing} 
              className="h-7 px-2"
            >
              {isSyncingSkills ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Sync DG Skills</span>
            </Button>
          ) : onSyncPgaTour ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSyncPgaTour} 
              disabled={isAnySyncing} 
              className="h-7 px-2"
            >
              {isSyncingPgaTour ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Sync PGA Stats</span>
            </Button>
          ) : null
        ) : (
          /* Tournament view - only show PGA Tour sync button */
          onSyncPgaTour && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSyncPgaTour} 
              disabled={isAnySyncing} 
              className="h-7 px-2"
            >
              {isSyncingPgaTour ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Sync PGA Stats</span>
            </Button>
          )
        )}
      </div>
      
      {/* Live Sync */}
      <div className="flex items-center gap-2">
        {lastLiveUpdate && !isSyncingLive && (
          <span 
            className="text-xs text-gray-400" 
            title={`Data Golf live stats file updated at ${new Date(lastLiveUpdate).toLocaleString()}`}
          >
            Tournament Data: {formatRelativeTime(lastLiveUpdate)}
          </span>
        )}
        {isSyncingLive && <span className="text-xs text-gray-500">Syncing...</span>}
        <Button
          variant="outline"
          size="sm"
          onClick={onSyncLive}
          disabled={isAnySyncing}
          className="h-7 px-2"
        >
          {isSyncingLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1">Sync Tournament</span>
        </Button>
      </div>
    </div>
  )
}
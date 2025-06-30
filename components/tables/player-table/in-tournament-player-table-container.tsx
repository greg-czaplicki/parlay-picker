'use client'
import { useState, useMemo, useCallback, Suspense } from 'react'
import { useInTournamentPlayersQuery } from '@/hooks/use-in-tournament-players-query'
import { useInitializePlayerView } from '@/hooks/use-initialize-player-view'
import { useLastCompletedEvent } from '@/lib/queries'
import { useColumns } from './columns'
import { getCoreRowModel, getSortedRowModel, useReactTable, SortingState } from '@tanstack/react-table'
import { PlayerTablePresentation } from './player-table-presentation'
import { PlayerTableFilters } from './player-table-filters'
import { PlayerTableSkeleton } from './player-table-skeleton'
import { generateHeatmapColors, GOLF_STAT_CONFIGS } from '@/lib/utils/heatmap'

/**
 * InTournamentPlayerTableContainer
 *
 * Displays the in-tournament player stats table. If a live event is active, shows live stats.
 * If no event is active, shows the most recent completed event's results as a fallback.
 * Uses Suspense for loading states and a skeleton loader for UX.
 *
 * - Uses useInitializePlayerView to determine event context
 * - Uses useLastCompletedEvent for fallback
 * - Renders PlayerTableFilters and PlayerTablePresentation
 */
export function InTournamentPlayerTableContainer() {
  const [roundFilter, setRoundFilter] = useState<string>('live')
  const {
    selectedEventId,
    setSelectedEventId,
    eventOptions,
    eventsLoading
  } = useInitializePlayerView()
  const { data: lastEvent, isLoading: lastEventLoading } = useLastCompletedEvent()

  // If still loading events, show skeleton
  if (eventsLoading || (eventOptions.length === 0 && lastEventLoading)) {
    return <PlayerTableSkeleton rows={10} columns={8} />
  }

  // If there is an active event, show live stats as before
  if (eventOptions.length > 0 && selectedEventId) {
    return (
      <Suspense fallback={<PlayerTableSkeleton rows={10} columns={8} />}>
        <div className="space-y-6">
          <div className="glass-card p-6">
            <PlayerTableFilters
              dataView="tournament"
              roundFilter={roundFilter}
              setRoundFilter={setRoundFilter}
              eventOptions={eventOptions}
              selectedEventId={selectedEventId}
              setSelectedEventId={setSelectedEventId}
            />
          </div>
          <div className="glass-card">
            <LiveStatsTable eventId={selectedEventId} roundFilter={roundFilter} eventOptions={eventOptions} />
          </div>
        </div>
      </Suspense>
    )
  }

  // If no active event, show last completed event's results
  if (lastEvent) {
    return (
      <Suspense fallback={<PlayerTableSkeleton rows={10} columns={8} />}>
        <div className="space-y-6">
          <div className="glass-card p-4">
            <div className="text-muted-foreground">
              No live event. Showing results from <span className="text-foreground font-semibold">{lastEvent.event_name}</span> (ended {lastEvent.end_date}).
            </div>
          </div>
          <div className="glass-card">
            <LastEventStatsTable eventId={lastEvent.event_id} eventName={lastEvent.event_name} />
          </div>
        </div>
      </Suspense>
    )
  }

  // Fallback
  return <PlayerTableSkeleton rows={10} columns={8} />
}


function getPercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// Helper function to check if any player in the dataset has SG data
function hasSGData<T>(data: T[]): boolean {
  if (!data || data.length === 0) return false
  
  const sgFields = ['sg_total', 'sg_ott', 'sg_app', 'sg_arg', 'sg_putt', 'sg_t2g']
  
  return data.some(player => 
    sgFields.some(field => {
      const value = (player as any)[field]
      return value !== null && value !== undefined && !isNaN(Number(value))
    })
  )
}

/**
 * LiveStatsTable
 *
 * Renders the player table for the current live event.
 * @param eventId - The active event's ID
 * @param roundFilter - The selected round filter
 * @param eventOptions - List of event options for lookup
 */
function LiveStatsTable({ eventId, roundFilter, eventOptions }: { eventId: number; roundFilter: string; eventOptions: { event_id: number; event_name: string }[] }) {
  const { data: liveStats } = useInTournamentPlayersQuery({
    eventId,
    round: roundFilter,
    eventOptions
  })

  // Restore all rows for performance
  const displayPlayers = useMemo(() => liveStats ?? [], [liveStats]);

  // Updated heatmap logic to use season stats color scheme
  const SG_COLUMNS = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_t2g', 'sg_total'];
  
  const getHeatmapColor = useCallback((value: number | null, statKey: string) => {
    if (!SG_COLUMNS.includes(statKey) || value == null) return { className: '', style: undefined };
    
    // Get all values for this stat to calculate percentiles
    const allValues = (liveStats ?? []).map((p: any) => {
      const val = Number(p[statKey]);
      return isNaN(val) ? null : val;
    });
    
    // Use the season stats heatmap system
    const config = GOLF_STAT_CONFIGS[statKey] || GOLF_STAT_CONFIGS.higher_better;
    const colors = generateHeatmapColors(allValues, config);
    const index = allValues.findIndex(v => v === value);
    
    return index >= 0 ? colors[index] : { className: '', style: undefined };
  }, [liveStats]);
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor, data: displayPlayers });

  // Enable sorting - default sort by total score
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total', desc: false }
  ]);

  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: false,
  });
  
  // Check if SG data is available for this tournament
  const hasSG = hasSGData(displayPlayers);
  
  return (
    <div>
      {!hasSG && displayPlayers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400 mb-4">
          📊 Strokes Gained statistics are not yet available for this tournament. Only scoring data is shown.
        </div>
      )}
      <PlayerTablePresentation table={table} caption="" />
    </div>
  );
}

/**
 * LastEventStatsTable
 *
 * Renders the player table for the most recent completed event.
 * @param eventId - The last event's ID
 * @param eventName - The last event's name
 */
function LastEventStatsTable({ eventId, eventName }: { eventId: number; eventName: string }) {
  const eventOptions = [{ event_id: eventId, event_name: eventName }];
  const { data: stats } = useInTournamentPlayersQuery({
    eventId,
    round: 'event_avg',
    eventOptions
  });

  // Restore all rows for performance
  const displayPlayers = useMemo(() => stats ?? [], [stats]);

  // Updated heatmap logic to use season stats color scheme
  const SG_COLUMNS = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_t2g', 'sg_total'];
  
  const getHeatmapColor = useCallback((value: number | null, statKey: string) => {
    if (!SG_COLUMNS.includes(statKey) || value == null) return { className: '', style: undefined };
    
    // Get all values for this stat to calculate percentiles
    const allValues = (stats ?? []).map((p: any) => {
      const val = Number(p[statKey]);
      return isNaN(val) ? null : val;
    });
    
    // Use the season stats heatmap system
    const config = GOLF_STAT_CONFIGS[statKey] || GOLF_STAT_CONFIGS.higher_better;
    const colors = generateHeatmapColors(allValues, config);
    const index = allValues.findIndex(v => v === value);
    
    return index >= 0 ? colors[index] : { className: '', style: undefined };
  }, [stats]);
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor, data: displayPlayers });

  // Enable sorting - default sort by total score
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'total', desc: false }
  ]);

  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: false,
  });
  
  // Check if SG data is available for this tournament
  const hasSG = hasSGData(displayPlayers);
  
  return (
    <div>
      {!hasSG && displayPlayers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400 mb-4">
          📊 Strokes Gained statistics are not yet available for this tournament. Only scoring data is shown.
        </div>
      )}
      <PlayerTablePresentation table={table} caption="" />
    </div>
  );
} 
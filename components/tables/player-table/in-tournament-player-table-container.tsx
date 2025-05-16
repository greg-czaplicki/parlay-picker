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
        <div>
          <PlayerTableFilters
            dataView="tournament"
            roundFilter={roundFilter}
            setRoundFilter={setRoundFilter}
            eventOptions={eventOptions}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
          />
          <LiveStatsTable eventId={selectedEventId} roundFilter={roundFilter} eventOptions={eventOptions} />
        </div>
      </Suspense>
    )
  }

  // If no active event, show last completed event's results
  if (lastEvent) {
    return (
      <Suspense fallback={<PlayerTableSkeleton rows={10} columns={8} />}>
        <div>
          <div className="mb-4 p-2 bg-muted text-muted-foreground rounded">
            No live event. Showing results from <b>{lastEvent.event_name}</b> (ended {lastEvent.end_date}).
          </div>
          <LastEventStatsTable eventId={lastEvent.event_id} eventName={lastEvent.event_name} />
        </div>
      </Suspense>
    )
  }

  // Fallback
  return <PlayerTableSkeleton rows={10} columns={8} />
}

const HEATMAP_CLASSES = [
  'heatmap-bg-0', // strong red
  'heatmap-bg-1', // orange
  'heatmap-bg-2', // yellow/peach
  'heatmap-bg-3', // light yellow (neutral)
  'heatmap-bg-4', // light green
  'heatmap-bg-5', // green
  'heatmap-bg-6', // strong green
];

function getPercentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
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

  // Restore heatmap logic and SG columns
  // Strokes gained columns to heatmap
  const SG_COLUMNS = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_t2g', 'sg_total'];
  // Compute 90th percentile of absolute values for each SG column (soft max)
  const sgStats = useMemo(() => {
    const stats: Record<string, { softMax: number }> = {};
    SG_COLUMNS.forEach(col => {
      const values = (liveStats ?? []).map((p: any) => Math.abs(Number(p[col]) || 0)).filter(v => !isNaN(v));
      if (values.length) {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.floor(0.9 * (sorted.length - 1));
        stats[col] = { softMax: sorted[idx] };
      } else {
        stats[col] = { softMax: 1 };
      }
    });
    return stats;
  }, [liveStats]);
  const getHeatmapColor = useCallback((value: number | null, statKey: string) => {
    if (!SG_COLUMNS.includes(statKey) || value == null) return '';
    const softMax = sgStats[statKey]?.softMax || 1;
    const norm = Math.max(-1, Math.min(1, value / softMax));
    // 7-band diverging palette
    const idx = Math.round(((norm + 1) / 2) * 6);
    return HEATMAP_CLASSES[idx];
  }, [sgStats]);
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor });

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
  return <PlayerTablePresentation table={table} caption="" />;
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

  // Restore heatmap logic and SG columns
  const SG_COLUMNS = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_t2g', 'sg_total'];
  const sgStats = useMemo(() => {
    const result: Record<string, { softMax: number }> = {};
    SG_COLUMNS.forEach(col => {
      const values = (stats ?? []).map((p: any) => Math.abs(Number(p[col]) || 0)).filter((v: number) => !isNaN(v));
      if (values.length) {
        const sorted = [...values].sort((a, b) => a - b);
        const idx = Math.floor(0.9 * (sorted.length - 1));
        result[col] = { softMax: sorted[idx] };
      } else {
        result[col] = { softMax: 1 };
      }
    });
    return result;
  }, [stats]);
  const getHeatmapColor = useCallback((value: number | null, statKey: string) => {
    if (!SG_COLUMNS.includes(statKey) || value == null) return '';
    const softMax = sgStats[statKey]?.softMax || 1;
    const norm = Math.max(-1, Math.min(1, value / softMax));
    const idx = Math.round(((norm + 1) / 2) * 6);
    return HEATMAP_CLASSES[idx];
  }, [sgStats]);
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor });

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
  return <PlayerTablePresentation table={table} caption="" />;
} 
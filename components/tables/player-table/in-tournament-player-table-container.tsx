'use client'
import { useState, useMemo, useCallback, Suspense } from 'react'
import { useInTournamentPlayersQuery } from '@/hooks/use-in-tournament-players-query'
import { useInitializePlayerView } from '@/hooks/use-initialize-player-view'
import { useLastCompletedEvent } from '@/lib/queries'
import { useColumns } from './columns'
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
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
  const [roundFilter, setRoundFilter] = useState<string>('event_avg')
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
  const getHeatmapColor = useCallback(() => '', [])
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor })
  const displayPlayers = useMemo(() => liveStats ?? [], [liveStats])
  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: [] },
    onSortingChange: () => {},
    initialState: {
      get sorting() {
        return [{ id: 'total', desc: false }]
      }
    },
  })
  return <PlayerTablePresentation table={table} caption="Live In-Tournament Player Stats" />
}

/**
 * LastEventStatsTable
 *
 * Renders the player table for the most recent completed event.
 * @param eventId - The last event's ID
 * @param eventName - The last event's name
 */
function LastEventStatsTable({ eventId, eventName }: { eventId: number; eventName: string }) {
  // We need to pass a fake eventOptions array so the hook can find the event name
  const eventOptions = [{ event_id: eventId, event_name: eventName }]
  const { data: stats } = useInTournamentPlayersQuery({
    eventId,
    round: 'event_avg',
    eventOptions
  })
  const getHeatmapColor = useCallback(() => '', [])
  const columns = useColumns<any>({ dataView: 'tournament', getHeatmapColor })
  const displayPlayers = useMemo(() => stats ?? [], [stats])
  const table = useReactTable({
    data: displayPlayers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting: [] },
    onSortingChange: () => {},
    initialState: {
      get sorting() {
        return [{ id: 'total', desc: false }]
      }
    },
  })
  return <PlayerTablePresentation table={table} caption="Last Tournament Results" />
} 
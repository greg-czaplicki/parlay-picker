import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase'
import { queryKeys } from '@/lib/query-keys'

export type EventType = 'main' | 'opposite' | 'euro' | null

export interface Tournament {
  event_id: number
  event_name: string
  start_date: string | null
  end_date: string | null
  tour?: string
}

export interface DisplayEvent {
  event_id: number
  event_name: string
  dates: string
  eventType: EventType
  tour?: string
}

function formatTournamentDates(startDateStr: string | null, endDateStr: string | null): string {
  if (!startDateStr || !endDateStr) return 'Dates TBC'
  try {
    const startDate = new Date(startDateStr + 'T00:00:00')
    const endDate = new Date(endDateStr + 'T00:00:00')
    const startMonth = startDate.toLocaleString('default', { month: 'short' })
    const endMonth = endDate.toLocaleString('default', { month: 'short' })
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    const year = startDate.getFullYear()
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
    }
  } catch {
    return 'Invalid Dates'
  }
}

async function fetchActiveEvents(): Promise<DisplayEvent[]> {
  const supabase = createBrowserClient()
  // Calculate Monday and Sunday of current week
  const currentDate = new Date()
  const dayOfWeek = currentDate.getDay()
  const monday = new Date(currentDate)
  monday.setDate(currentDate.getDate() - ((dayOfWeek + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const mondayStr = monday.toISOString().split('T')[0]
  const sundayStr = sunday.toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('tournaments_v2')
    .select('event_id, event_name, start_date, end_date, tour')
    .lte('start_date', sundayStr)
    .gte('end_date', mondayStr)
    .order('tour', { ascending: true })
    .order('event_id', { ascending: true })
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return []
  // Identify PGA events
  const pgaEvents = data.filter((t: Tournament) => t.tour === 'pga' || !t.tour)
  let mainEventId = -1
  if (pgaEvents.length > 0) {
    const lowestIdPgaEvent = pgaEvents.reduce((lowest, current) =>
      current.event_id < lowest.event_id ? current : lowest, pgaEvents[0])
    mainEventId = lowestIdPgaEvent.event_id
  }
  // Map and type events
  let eventsWithTypes: DisplayEvent[] = data.map((tournament: Tournament) => {
    let eventType: EventType = null
    if (tournament.tour === 'euro') {
      eventType = 'euro'
    } else if (tournament.tour === 'opp') {
      eventType = 'opposite'
    } else if (tournament.tour === 'pga' || !tournament.tour) {
      if (tournament.event_id === mainEventId) {
        eventType = 'main'
      } else {
        eventType = 'opposite'
      }
    }
    return {
      event_id: tournament.event_id,
      event_name: tournament.event_name,
      dates: formatTournamentDates(tournament.start_date, tournament.end_date),
      eventType,
      tour: tournament.tour
    }
  })
  eventsWithTypes.sort((a, b) => {
    if (a.eventType === 'main') return -1
    if (b.eventType === 'main') return 1
    if (a.eventType === 'opposite') return -1
    if (b.eventType === 'opposite') return 1
    if (a.eventType === 'euro') return -1
    if (b.eventType === 'euro') return 1
    return a.event_id - b.event_id
  })
  return eventsWithTypes
}

export function useActiveEventsQuery() {
  return useQuery<DisplayEvent[], Error>({
    queryKey: queryKeys.currentWeekEvents(),
    queryFn: fetchActiveEvents,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
} 
import { useMutation } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'

export interface DashboardDebugEvent {
  event_id: number
  event_name: string
  start_date: string
  end_date: string
}

export interface DashboardDebugMatchup {
  event_id: number
  event_name: string
  count: number
  sample: any[]
}

export interface DashboardDebugDirectMatch {
  [eventId: number]: {
    stringMatch: { success: boolean; matches: number }
    numericMatch: { success: boolean; matches: number }
    nameMatch: { success: boolean; matches: number }
  }
}

export interface DashboardDebugResults {
  events: DashboardDebugEvent[]
  directMatches: DashboardDebugDirectMatch
  matchups2Ball: DashboardDebugMatchup[]
  matchups3Ball: DashboardDebugMatchup[]
}

async function runDashboardDebugDiagnostics(): Promise<DashboardDebugResults> {
  // Step 1: Fetch current week events
  const supabase = createBrowserClient()
  const today = new Date()
  const mondayStr = new Date(today.setDate(today.getDate() - today.getDay() + 1)).toISOString().split('T')[0]
  const sundayStr = new Date(today.setDate(today.getDate() + 6)).toISOString().split('T')[0]

  const { data: eventsData, error: eventsError } = await supabase
    .from('tournaments_v2')
    .select('event_id, event_name, start_date, end_date')
    .lte('start_date', sundayStr)
    .gte('end_date', mondayStr)

  if (eventsError) throw new Error(`Error fetching events: ${eventsError.message}`)
  const events = eventsData || []

  // Step 2: Direct database queries
  const directMatches: DashboardDebugDirectMatch = {}
  for (const event of events) {
    // 2a. String comparison
    const { data: stringMatch, error: stringError } = await supabase
      .from('latest_two_ball_matchups')
      .select('id')
      .eq('event_id', event.event_id.toString())
      .limit(1)
    // 2b. Numeric comparison
    const { data: numericMatch, error: numericError } = await supabase
      .from('latest_two_ball_matchups')
      .select('id')
      .eq('event_id', parseInt(event.event_id.toString(), 10))
      .limit(1)
    // 2c. Name match
    const { data: nameMatch, error: nameError } = await supabase
      .from('latest_two_ball_matchups')
      .select('id')
      .ilike('event_name', `%${event.event_name}%`)
      .limit(1)
    directMatches[event.event_id] = {
      stringMatch: { success: !stringError, matches: stringMatch?.length || 0 },
      numericMatch: { success: !numericError, matches: numericMatch?.length || 0 },
      nameMatch: { success: !nameError, matches: nameMatch?.length || 0 },
    }
  }

  // Step 3: Fetch matchups from API endpoints
  const matchups2Ball: DashboardDebugMatchup[] = []
  const matchups3Ball: DashboardDebugMatchup[] = []
  for (const event of events) {
    // 3a. 2-ball
    const response2Ball = await fetch(`/api/matchups/2ball?eventId=${event.event_id}`)
    const data2Ball = await response2Ball.json()
    if (data2Ball.success) {
      matchups2Ball.push({
        event_id: event.event_id,
        event_name: event.event_name,
        count: data2Ball.matchups?.length || 0,
        sample: data2Ball.matchups?.slice(0, 2) || [],
      })
    }
    // 3b. 3-ball
    const response3Ball = await fetch(`/api/matchups/3ball?eventId=${event.event_id}`)
    const data3Ball = await response3Ball.json()
    if (data3Ball.success) {
      matchups3Ball.push({
        event_id: event.event_id,
        event_name: event.event_name,
        count: data3Ball.matchups?.length || 0,
        sample: data3Ball.matchups?.slice(0, 2) || [],
      })
    }
  }

  return { events, directMatches, matchups2Ball, matchups3Ball }
}

export function useDashboardDebugDiagnostics() {
  return useMutation<DashboardDebugResults, Error, void>({
    mutationKey: ['dashboardDebugDiagnostics'],
    mutationFn: runDashboardDebugDiagnostics,
  })
} 
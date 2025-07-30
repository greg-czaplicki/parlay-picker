// Greg
// Custom hook for fetching current week events with React Query
// Usage:
// const { data, isLoading, isError, error } = useCurrentWeekEventsQuery()

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'

export interface Event {
  event_id: number;
  event_name: string;
  start_date: string;
  end_date: string;
}

function getCurrentWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  }
}

async function fetchCurrentWeekEvents(): Promise<Event[]> {
  const supabase = createBrowserClient();
  const { monday, sunday } = getCurrentWeekRange();
  const { data, error } = await supabase
    .from('tournaments')
    .select('dg_id, name, start_date, end_date')
    .lte('start_date', sunday)
    .gte('end_date', monday);
  if (error) throw error;
  
  // Map data to expected format for compatibility
  const events: Event[] = (data || []).map((t: any) => ({
    event_id: t.dg_id,
    event_name: t.name,
    start_date: t.start_date,
    end_date: t.end_date,
  }));
  
  return events;
}

// Add a query key for current week events if not present
if (!('currentWeekEvents' in queryKeys)) {
  // @ts-ignore
  queryKeys.currentWeekEvents = () => ['tournaments', 'currentWeek'] as const;
}

export function useCurrentWeekEventsQuery() {
  return useQuery<Event[], Error>({
    queryKey: [...queryKeys.currentWeekEvents(), 'v2-fresh'],
    queryFn: fetchCurrentWeekEvents,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
} 
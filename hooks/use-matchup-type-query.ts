// Greg
// Custom hook for detecting available matchup type for an event
// Usage:
// const { data: matchupType, isLoading, isError, error } = useMatchupTypeQuery(eventId)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'

export function useMatchupTypeQuery(eventId: number | null) {
  return useQuery<string | null, Error>({
    queryKey: queryKeys.matchupType(eventId),
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return null;
      const supabase = createBrowserClient();
      // Check for 3-ball matchups
      const { data: threeBall, error: err3 } = await supabase
        .from('latest_three_ball_matchups')
        .select('id')
        .eq('event_id', eventId)
        .limit(1);
      if (err3) throw err3;
      if (threeBall && threeBall.length > 0) return '3ball';
      // Check for 2-ball matchups
      const { data: twoBall, error: err2 } = await supabase
        .from('latest_two_ball_matchups')
        .select('id')
        .eq('event_id', eventId)
        .limit(1);
      if (err2) throw err2;
      if (twoBall && twoBall.length > 0) return '2ball';
      return null;
    },
  })
}

// Add a query key for matchup type if not present
if (!('matchupType' in queryKeys)) {
  // @ts-ignore
  queryKeys.matchupType = (eventId: number | null) => ['matchupType', eventId] as const;
} 
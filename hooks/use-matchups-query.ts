// Greg
// Custom hook for fetching matchups for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface MatchupRow {
  uuid: string;
  event_id: string;
  event_name?: string;
  round_num: number;
  created_at: string;
  player1_dg_id: number;
  player1_name: string;
  player2_dg_id: number;
  player2_name: string;
  player3_dg_id?: number | null;
  player3_name?: string | null;
  odds1: number | null;
  odds2: number | null;
  odds3?: number | null;
  tee_time?: string | null;
  type: string;
}

interface UseMatchupsQueryResult {
  data: MatchupRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastUpdateTime: string | null;
}

export function useMatchupsQuery(eventId: number | null, matchupType: "2ball" | "3ball", roundNum?: number | null): UseMatchupsQueryResult {
  const query = useQuery<MatchupRow[], Error>({
    queryKey: [
      ...queryKeys.matchups.byEventAndType(eventId ?? 0, matchupType),
      roundNum ?? 'allRounds',
    ],
    enabled: !!eventId,
    queryFn: async () => {
      let endpoint = eventId
        ? `/api/matchups?type=${matchupType}&event_id=${eventId}`
        : `/api/matchups?type=${matchupType}`;
      if (roundNum) endpoint += `&round_num=${roundNum}`;
      
      console.log(`Fetching matchups with endpoint: ${endpoint}`);
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      let matchupsData: MatchupRow[] = [];
      if (data && data.matchups && Array.isArray(data.matchups)) {
        matchupsData = data.matchups;
      }
      
      console.log(`Received ${matchupsData.length} matchups before filtering`);
      if (matchupsData.length > 0) {
        console.log(`First matchup: event_id=${matchupsData[0].event_id}, type=${matchupsData[0].type}, name=${matchupsData[0].event_name}`);
      }
      
      // Important: Use string comparison for event_id to avoid type coercion issues
      let filtered = matchupsData;
      if (eventId && matchupsData.length > 0) {
        // Convert both to strings for reliable comparison
        const eventIdStr = String(eventId);
        filtered = matchupsData.filter((m: any) => String(m.event_id) === eventIdStr);
        console.log(`Filtered to ${filtered.length} matchups for event_id ${eventIdStr}`);
        
        // If we're fetching 2ball matchups and have no results after filtering for this event,
        // log details about all 2ball matchups in the response to diagnose the issue
        if (matchupType === '2ball' && filtered.length === 0) {
          console.log('No 2ball matchups found for this event. Available 2ball matchups:');
          const all2BallMatchups = matchupsData.filter(m => m.type === '2ball');
          console.log(`Total 2ball matchups in response: ${all2BallMatchups.length}`);
          
          // Group them by event_id to see which events have 2ball matchups
          const eventGroups = all2BallMatchups.reduce((acc, m) => {
            const id = m.event_id;
            if (!acc[id]) acc[id] = { count: 0, name: m.event_name };
            acc[id].count++;
            return acc;
          }, {});
          
          console.log('2ball matchups by event:', eventGroups);
        }
      }
      return filtered;
    },
  });
  const lastUpdateTime = query.data && query.data.length > 0 ? query.data[0].created_at : null;
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    lastUpdateTime,
  };
} 
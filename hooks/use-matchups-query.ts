// Greg
// Custom hook for fetching matchups for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface MatchupRow {
  id: number;
  event_id: number;
  event_name?: string;
  round_num: number;
  created_at: string;
  player1_id: number;
  player1_name: string;
  player2_id: number;
  player2_name: string;
  player3_id?: number | null;
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
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      let matchupsData: MatchupRow[] = [];
      if (data && data.matchups && Array.isArray(data.matchups)) {
        matchupsData = data.matchups;
      }
      let filtered = matchupsData;
      if (eventId && matchupsData.length > 0) {
        const eventIdNum = Number(eventId);
        filtered = matchupsData.filter((m: any) => Number(m.event_id) === eventIdNum);
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
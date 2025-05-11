// Greg
// Custom hook for fetching matchups for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface MatchupRow {
  id: number;
  event_id?: number;
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id?: number;
  p3_player_name?: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  fanduel_p3_odds?: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  draftkings_p3_odds?: number | null;
  datagolf_p1_odds?: number | null;
  datagolf_p2_odds?: number | null;
  datagolf_p3_odds?: number | null;
  odds?: any;
}

interface UseMatchupsQueryResult {
  data: MatchupRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastUpdateTime: string | null;
}

export function useMatchupsQuery(eventId: number | null, matchupType: "2ball" | "3ball"): UseMatchupsQueryResult {
  const query = useQuery<MatchupRow[], Error>({
    queryKey: queryKeys.matchups.byEventAndType(eventId ?? 0, matchupType),
    enabled: !!eventId,
    queryFn: async () => {
      // Try debug endpoint first for DB check (optional fallback)
      const debugEndpoint = `/api/debug/db-check${eventId ? `?eventId=${eventId}` : ''}`;
      let dbCheck: any = null;
      try {
        const debugResponse = await fetch(debugEndpoint);
        dbCheck = await debugResponse.json();
      } catch {}

      // Main API endpoint
      const endpoint = eventId
        ? `/api/matchups/${matchupType}?eventId=${eventId}`
        : `/api/matchups/${matchupType}`;
      let data: any;
      try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(await response.text());
        data = await response.json();
        if (!data.success) throw new Error(data.error || 'API returned success: false');
      } catch (apiErr) {
        // Fallback to DB sample if available
        if (dbCheck && dbCheck.success && dbCheck.sampleMatchups && dbCheck.sampleMatchups.length > 0) {
          return dbCheck.sampleMatchups;
        }
        throw apiErr;
      }

      // Extract matchups array
      let matchupsData: MatchupRow[] = [];
      if (Array.isArray(data.matchups)) {
        matchupsData = data.matchups;
      } else if (Array.isArray(data.events)) {
        if (eventId) {
          const eventIdNum = Number(eventId);
          const selectedEvent = data.events.find((e: any) => Number(e.event_id) === eventIdNum);
          if (selectedEvent && Array.isArray(selectedEvent.matchups)) {
            matchupsData = selectedEvent.matchups;
          }
        } else {
          matchupsData = data.events.flatMap((e: any) => e.matchups || []);
        }
      }
      // Filter by eventId if needed
      let filtered = matchupsData;
      if (eventId && matchupsData.length > 0) {
        const eventIdNum = Number(eventId);
        filtered = matchupsData.filter((m: any) => Number(m.event_id) === eventIdNum);
      }
      return filtered;
    },
  });
  const lastUpdateTime = query.data && query.data.length > 0 ? query.data[0].data_golf_update_time : null;
  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    lastUpdateTime,
  };
} 
// Greg
// Custom hook for fetching matchups for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { MatchupRow } from '@/types/matchups'

// Interface for SG data attached to each player in a matchup
export interface PlayerSGData {
  // Season-long SG data (from player_skill_ratings)
  seasonSgTotal?: number | null;
  seasonSgPutt?: number | null;
  seasonSgArg?: number | null;
  seasonSgApp?: number | null;
  seasonSgOtt?: number | null;
  seasonDrivingAcc?: number | null;
  seasonDrivingDist?: number | null;
  
  // Tournament/Live SG data (from latest_live_tournament_stats_view)
  sgTotal?: number | null;
  sgPutt?: number | null;
  sgArg?: number | null;
  sgApp?: number | null;
  sgOtt?: number | null;
  sgT2g?: number | null;
  position?: string | null;
  total?: number | null;
  today?: number | null;
  thru?: number | null;
  eventName?: string | null;
  roundNum?: string | null;
}

// Enhanced MatchupRow with SG data
export interface EnhancedMatchupRow extends MatchupRow {
  // Enhanced SG data (added by API enhancement)
  player1_sg_data?: PlayerSGData;
  player2_sg_data?: PlayerSGData;
  player3_sg_data?: PlayerSGData;
  sg_data_enhanced?: boolean;
  season_sg_players?: number;
  tournament_sg_players?: number;
}

interface UseMatchupsQueryResult {
  data: EnhancedMatchupRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastUpdateTime: string | null;
}

export function useMatchupsQuery(eventId: number | null, matchupType: "2ball" | "3ball", roundNum?: number | null, fanDuelOnly: boolean = true): UseMatchupsQueryResult {
  const query = useQuery<EnhancedMatchupRow[], Error>({
    queryKey: [
      ...queryKeys.matchups.byEventAndType(eventId ?? 0, matchupType),
      roundNum ?? 'allRounds',
      fanDuelOnly ? 'fanDuelOnly' : 'allSportsbooks',
      'v2-schema', // Add this to bust cache with old UUID data
    ],
    enabled: !!eventId,
    staleTime: 30 * 1000, // Reduced from 2 minutes to 30 seconds for faster updates
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
    refetchOnReconnect: true, // Refetch when reconnecting
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    queryFn: async () => {
      console.log(`🔌 Fetching enhanced matchups: eventId=${eventId}, type=${matchupType}, round=${roundNum}`);
      
      // Add cache-busting timestamp when data might be stale
      const now = Date.now()
      const cacheParam = `&_t=${now}`
      
      let endpoint = eventId
        ? `/api/matchups?type=${matchupType}&event_id=${eventId}`
        : `/api/matchups?type=${matchupType}`;
      if (roundNum) endpoint += `&round_num=${roundNum}`;
      if (fanDuelOnly) endpoint += `&fanDuelOnly=true`;
      
      // Add cache-busting parameter
      endpoint += cacheParam;
      
      const response = await fetch(endpoint, {
        headers: {
          // Add cache-busting headers
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      let matchupsData: EnhancedMatchupRow[] = [];
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
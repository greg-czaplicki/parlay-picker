// Greg
// Custom hook for fetching matchups for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error, lastUpdateTime } = useMatchupsQuery(eventId, matchupType)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

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
  dg_odds1?: number | null;
  dg_odds2?: number | null;
  dg_odds3?: number | null;
  start_hole?: number | null;
  teetime?: string | null;
  tee_time?: string | null;
  type: string;
  
  // Enhanced SG data (added by API enhancement)
  player1_sg_data?: PlayerSGData;
  player2_sg_data?: PlayerSGData;
  player3_sg_data?: PlayerSGData;
  sg_data_enhanced?: boolean;
  season_sg_players?: number;
  tournament_sg_players?: number;
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
    staleTime: 2 * 60 * 1000, // 2 minutes - don't refetch for 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    queryFn: async () => {
      console.log(`🔌 Fetching enhanced matchups: eventId=${eventId}, type=${matchupType}, round=${roundNum}`);
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
      
      // Log SG data enhancement info
      const sgEnhanced = filtered.filter(m => m.sg_data_enhanced);
      console.log(`✅ Fetched ${filtered.length} matchups (${sgEnhanced.length} with SG data) for event ${eventId}`);
      
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
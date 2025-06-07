// Greg
// Custom hook for fetching player stats for a given event and round
// Usage:
// const { data, isLoading, isError, error } = usePlayerStatsQuery(eventId, roundNum, playerIds)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface PlayerStat {
  player_id: string; // uuid from API
  player_name?: string;
  event_name?: string;
  round_num?: number | string | null;
  position?: string | null;
  total?: number | null;
  today?: number | null;
  thru?: number | null;
  // Round-specific data
  current_round?: number | null;
  round_scores?: {
    R1: number | null;
    R2: number | null;
    R3: number | null;
    R4: number | null;
  } | null;
  sg_total?: number | null;
  sg_ott?: number | null;
  sg_app?: number | null;
  sg_arg?: number | null;
  sg_putt?: number | null;
  // Season stats
  season_sg_total?: number | null;
  season_sg_ott?: number | null;
  season_sg_app?: number | null;
  season_sg_arg?: number | null;
  season_sg_putt?: number | null;
}

interface UsePlayerStatsQueryResult {
  data: PlayerStat[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function usePlayerStatsQuery(eventId: number | null, roundNum: number, playerIds: string[]): UsePlayerStatsQueryResult {
  return useQuery<PlayerStat[], Error>({
    queryKey: queryKeys.playerData.live(eventId ?? 0, roundNum + ':' + playerIds.join(',')),
    enabled: !!eventId && playerIds.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({
        eventId: String(eventId),
        roundNum: String(roundNum),
        playerIds: playerIds.join(','),
      });
      const endpoint = `/api/player-stats?${params.toString()}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API returned success: false');
      return data.stats as PlayerStat[];
    },
  });
} 
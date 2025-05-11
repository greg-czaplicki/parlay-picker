// Greg
// Custom hook for fetching player stats for a given event and round
// Usage:
// const { data, isLoading, isError, error } = usePlayerStatsQuery(eventId, roundNum, playerIds)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface PlayerStat {
  player_id: number;
  event_id: number;
  round_num: number;
  stat_name: string;
  stat_value: number;
  // Add other fields as needed
  position?: string | null;
  total?: number | null;
  today?: number | null;
  thru?: number | null;
  player_name?: string;
  event_name?: string;
}

interface UsePlayerStatsQueryResult {
  data: PlayerStat[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function usePlayerStatsQuery(eventId: number | null, roundNum: number, playerIds: number[]): UsePlayerStatsQueryResult {
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
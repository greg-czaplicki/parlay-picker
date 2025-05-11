// Greg
// Custom hook for fetching and transforming recommended picks for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error } = useRecommendedPicksQuery(eventId, matchupType, bookmaker, oddsGapPercentage, limit)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export interface Player {
  id: number;
  name: string;
  odds: number;
  sgTotal: number;
  valueRating: number;
  confidenceScore: number;
  isRecommended: boolean;
  matchupId?: number;
  eventName?: string;
  roundNum?: number;
}

interface UseRecommendedPicksQueryResult {
  data: Player[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

export function useRecommendedPicksQuery(
  eventId: number | null,
  matchupType: "2ball" | "3ball",
  bookmaker?: string,
  oddsGapPercentage: number = 40,
  limit: number = 10
): UseRecommendedPicksQueryResult {
  return useQuery<Player[], Error>({
    queryKey: queryKeys.recommendedPicks.byEventAndType(eventId ?? 0, matchupType),
    enabled: !!eventId,
    queryFn: async () => {
      const endpoint = eventId
        ? `/api/matchups/${matchupType}?eventId=${eventId}`
        : `/api/matchups/${matchupType}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'API returned success: false');
      const matchupsFromApi = data.matchups || [];
      // Transform API response into Player[]
      const players: Player[] = [];
      for (const apiMatchup of matchupsFromApi) {
        if (!apiMatchup || typeof apiMatchup !== 'object') continue;
        if (matchupType === "3ball") {
          if (!apiMatchup.p1_player_name || !apiMatchup.p2_player_name || !apiMatchup.p3_player_name) continue;
          players.push(
            {
              id: apiMatchup.p1_dg_id || 0,
              name: apiMatchup.p1_player_name,
              odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p1_odds : apiMatchup.draftkings_p1_odds,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.p2_dg_id || 0,
              name: apiMatchup.p2_player_name,
              odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p2_odds : apiMatchup.draftkings_p2_odds,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.p3_dg_id || 0,
              name: apiMatchup.p3_player_name,
              odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p3_odds : apiMatchup.draftkings_p3_odds,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            }
          );
        } else {
          // 2ball
          if (!apiMatchup.p1_player_name || !apiMatchup.p2_player_name) continue;
          players.push(
            {
              id: apiMatchup.p1_dg_id || 0,
              name: apiMatchup.p1_player_name,
              odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p1_odds : apiMatchup.draftkings_p1_odds,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.p2_dg_id || 0,
              name: apiMatchup.p2_player_name,
              odds: bookmaker === "fanduel" ? apiMatchup.fanduel_p2_odds : apiMatchup.draftkings_p2_odds,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            }
          );
        }
      }
      // Optionally filter/sort by oddsGapPercentage, limit, etc. (add logic as needed)
      return players.slice(0, limit);
    },
  });
} 
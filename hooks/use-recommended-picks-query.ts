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
  matchupId: number;
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
  bookmaker: string = "fanduel",
  oddsGapPercentage: number = 40,
  limit: number = 10,
  roundNum?: number | null
): UseRecommendedPicksQueryResult {
  return useQuery<Player[], Error>({
    queryKey: [
      ...queryKeys.recommendedPicks.byEventAndType(eventId ?? 0, matchupType),
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
      let matchupsData: any[] = [];
      if (data && data.matchups && Array.isArray(data.matchups)) {
        matchupsData = data.matchups;
      }
      let players: Player[] = [];
      for (const apiMatchup of matchupsData) {
        if (!apiMatchup || typeof apiMatchup !== 'object') continue;
        if (matchupType === "3ball") {
          if (!apiMatchup.player1_name || !apiMatchup.player2_name || !apiMatchup.player3_name) continue;
          players.push(
            {
              id: apiMatchup.player1_id || 0,
              name: apiMatchup.player1_name,
              odds: apiMatchup.odds1,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.player2_id || 0,
              name: apiMatchup.player2_name,
              odds: apiMatchup.odds2,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.player3_id || 0,
              name: apiMatchup.player3_name,
              odds: apiMatchup.odds3,
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
          if (!apiMatchup.player1_name || !apiMatchup.player2_name) continue;
          players.push(
            {
              id: apiMatchup.player1_id || 0,
              name: apiMatchup.player1_name,
              odds: apiMatchup.odds1,
              sgTotal: 0,
              valueRating: 0,
              confidenceScore: 0,
              isRecommended: false,
              matchupId: apiMatchup.id,
              eventName: apiMatchup.event_name,
              roundNum: apiMatchup.round_num
            },
            {
              id: apiMatchup.player2_id || 0,
              name: apiMatchup.player2_name,
              odds: apiMatchup.odds2,
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
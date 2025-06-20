// Greg
// Custom hook for fetching and transforming recommended picks for a given event and matchup type
// Usage:
// const { data, isLoading, isError, error } = useRecommendedPicksQuery(eventId, matchupType, bookmaker, oddsGapPercentage, limit)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { usePlayerStatsQuery } from './use-player-stats-query'
import { useMemo, useEffect } from 'react'

export interface Player {
  dg_id: number; // canonical player identifier
  name: string;
  odds: number;
  sgTotal: number;
  seasonSgTotal?: number | null;
  
  // Individual SG category data (tournament)
  sgPutt?: number | null;
  sgApp?: number | null;
  sgArg?: number | null;
  sgOtt?: number | null;
  
  // Individual SG category data (season)
  season_sg_putt?: number | null;
  season_sg_app?: number | null;
  season_sg_arg?: number | null;
  season_sg_ott?: number | null;
  
  valueRating: number;
  confidenceScore: number;
  isRecommended: boolean;
  matchupId: number;
  eventName?: string;
  roundNum?: number;
  position?: string | null;
  total?: number | null;
  today?: number | null;
  thru?: number | null;
  // Heavy favorites filter only:
  oddsGapToNext?: number;
  nextBestPlayer?: string;
  nextBestOdds?: number;
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
  // Fetch matchups as before
  const matchupsQuery = useQuery<any[], Error>({
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
      return data.matchups || [];
    },
  });

  // Flatten matchups to player array
  const players: Player[] = useMemo(() => {
    const matchupsData = matchupsQuery.data || [];

    
    let result: Player[] = [];
    for (const apiMatchup of matchupsData) {
      if (!apiMatchup || typeof apiMatchup !== 'object') continue;
      

      
      if (matchupType === "3ball") {
        if (!apiMatchup.player1_name || !apiMatchup.player2_name || !apiMatchup.player3_name) continue;
        result.push(
          {
            dg_id: apiMatchup.player1_dg_id || 0,
            name: apiMatchup.player1_name,
            odds: apiMatchup.odds1,
            sgTotal: 0,
            valueRating: 0,
            confidenceScore: 0,
            isRecommended: false,
            matchupId: apiMatchup.uuid,
            eventName: apiMatchup.event_name,
            roundNum: apiMatchup.round_num
          },
          {
            dg_id: apiMatchup.player2_dg_id || 0,
            name: apiMatchup.player2_name,
            odds: apiMatchup.odds2,
            sgTotal: 0,
            valueRating: 0,
            confidenceScore: 0,
            isRecommended: false,
            matchupId: apiMatchup.uuid,
            eventName: apiMatchup.event_name,
            roundNum: apiMatchup.round_num
          },
          {
            dg_id: apiMatchup.player3_dg_id || 0,
            name: apiMatchup.player3_name,
            odds: apiMatchup.odds3,
            sgTotal: 0,
            valueRating: 0,
            confidenceScore: 0,
            isRecommended: false,
            matchupId: apiMatchup.uuid,
            eventName: apiMatchup.event_name,
            roundNum: apiMatchup.round_num
          }
        );
      } else {
        // 2ball
        if (!apiMatchup.player1_name || !apiMatchup.player2_name) continue;
        result.push(
          {
            dg_id: apiMatchup.player1_dg_id || 0,
            name: apiMatchup.player1_name,
            odds: apiMatchup.odds1,
            sgTotal: 0,
            valueRating: 0,
            confidenceScore: 0,
            isRecommended: false,
            matchupId: apiMatchup.uuid,
            eventName: apiMatchup.event_name,
            roundNum: apiMatchup.round_num
          },
          {
            dg_id: apiMatchup.player2_dg_id || 0,
            name: apiMatchup.player2_name,
            odds: apiMatchup.odds2,
            sgTotal: 0,
            valueRating: 0,
            confidenceScore: 0,
            isRecommended: false,
            matchupId: apiMatchup.uuid,
            eventName: apiMatchup.event_name,
            roundNum: apiMatchup.round_num
          }
        );
      }
    }
    

    
    return result;
  }, [matchupsQuery.data, matchupType]);

  // Extract player IDs for stats
  const playerIds = useMemo(() => players.map(p => p.dg_id).filter(Boolean), [players]);

  // Fetch player stats
  const statsQuery = usePlayerStatsQuery(eventId, roundNum ?? 1, playerIds.map(String));

  // Merge stats into players
  const mergedPlayers = useMemo(() => {
    if (!statsQuery.data) return players;
    // Build a map of dg_id -> all stats for that player
    const statsMap: Record<string, any> = {};
    for (const stat of statsQuery.data) {
      const key = String(stat.player_id);
      if (!statsMap[key]) statsMap[key] = {};
      statsMap[key].sgTotal = stat.sg_total;
      // Add season SG Total
      statsMap[key].seasonSgTotal = stat.season_sg_total;
      // Copy other fields as before
      statsMap[key].position = stat.position;
      statsMap[key].total = stat.total;
      statsMap[key].today = stat.today;
      statsMap[key].thru = stat.thru;
    }

    return players.map(player => {
      const stat = statsMap[String(player.dg_id)] || {};
              return {
          ...player,
          sgTotal: stat.sgTotal ?? player.sgTotal,
          seasonSgTotal: stat.seasonSgTotal ?? null,
          position: stat.position ?? player.position,
          total: stat.total ?? player.total,
          today: stat.today ?? player.today,
          thru: stat.thru ?? player.thru,
        };
    });
  }, [players, statsQuery.data]);

  return {
    data: mergedPlayers,
    isLoading: matchupsQuery.isLoading || statsQuery.isLoading,
    isError: matchupsQuery.isError || statsQuery.isError,
    error: matchupsQuery.error || statsQuery.error,
  };
} 
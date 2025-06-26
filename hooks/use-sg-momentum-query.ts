import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { SGMomentumApiResponse } from '@/lib/types/course-dna';

interface SGMomentumQueryParams {
  dgId?: number;
  eventName?: string;
  batch?: boolean;
  limit?: number;
}

/**
 * Hook to fetch SG momentum data for players in tournaments
 */
export function useSGMomentumQuery(
  params: SGMomentumQueryParams,
  options?: Omit<UseQueryOptions<SGMomentumApiResponse>, 'queryKey' | 'queryFn'>
) {
  const { dgId, eventName, batch = false, limit = 50 } = params;

  return useQuery({
    queryKey: queryKeys.sgMomentum.tournament(eventName, dgId, batch, limit),
    queryFn: async (): Promise<SGMomentumApiResponse> => {
      const searchParams = new URLSearchParams();
      
      if (dgId) searchParams.set('dgId', dgId.toString());
      if (eventName) searchParams.set('eventName', eventName);
      if (batch) searchParams.set('batch', 'true');
      if (limit) searchParams.set('limit', limit.toString());

      const response = await fetch(`/api/sg-momentum?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`SG Momentum API error: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!(eventName || batch), // Need either eventName or batch mode
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes for live data
    ...options
  });
}

/**
 * Hook specifically for batch momentum analysis across all active tournaments
 */
export function useActiveTournamentsMomentumQuery(
  limit: number = 100,
  options?: Omit<UseQueryOptions<SGMomentumApiResponse>, 'queryKey' | 'queryFn'>
) {
  return useSGMomentumQuery(
    { batch: true, limit },
    {
      staleTime: 3 * 60 * 1000, // 3 minutes for batch data
      refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
      ...options
    }
  );
}

/**
 * Hook for single player momentum analysis
 */
export function usePlayerMomentumQuery(
  dgId: number,
  eventName: string,
  options?: Omit<UseQueryOptions<SGMomentumApiResponse>, 'queryKey' | 'queryFn'>
) {
  return useSGMomentumQuery(
    { dgId, eventName },
    {
      staleTime: 1 * 60 * 1000, // 1 minute for single player
      refetchInterval: 3 * 60 * 1000, // Refetch every 3 minutes
      enabled: !!(dgId && eventName),
      ...options
    }
  );
}

/**
 * Hook for tournament-specific momentum analysis
 */
export function useTournamentMomentumQuery(
  eventName: string,
  limit: number = 50,
  options?: Omit<UseQueryOptions<SGMomentumApiResponse>, 'queryKey' | 'queryFn'>
) {
  return useSGMomentumQuery(
    { eventName, limit },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes for tournament data
      refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
      enabled: !!eventName,
      ...options
    }
  );
} 
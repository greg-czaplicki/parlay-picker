// Greg
// Custom hook for detecting available matchup type for an event
// Usage:
// const { data: matchupType, isLoading, isError, error } = useMatchupTypeQuery(eventId)

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createBrowserClient } from '@/lib/supabase'

export function useMatchupTypeQuery(eventId: number | null) {
  return useQuery<string | null, Error>({
    queryKey: [...queryKeys.matchupType(eventId), 'v2-schema'],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return null;
      const supabase = createBrowserClient();
      
      // First get the tournament UUID from dg_id
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id')
        .eq('dg_id', eventId)
        .single();
        
      if (tournamentError || !tournament) {
        console.log('Tournament not found for event_id:', eventId);
        return null;
      }
      
      // Check for 3-ball betting markets
      const { data: threeBall, error: err3 } = await supabase
        .from('betting_markets')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('market_subtype', '3ball')
        .limit(1);
      if (err3) throw err3;
      if (threeBall && threeBall.length > 0) return '3ball';
      
      // Check for 2-ball betting markets
      const { data: twoBall, error: err2 } = await supabase
        .from('betting_markets')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('market_subtype', '2ball')
        .limit(1);
      if (err2) throw err2;
      if (twoBall && twoBall.length > 0) return '2ball';
      
      return null;
    },
  })
}

// Add a query key for matchup type if not present
if (!('matchupType' in queryKeys)) {
  // @ts-ignore
  queryKeys.matchupType = (eventId: number | null) => ['matchupType', eventId] as const;
} 
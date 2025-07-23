import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase'

export function useCurrentRoundForEvent(eventId: number | null) {
  return useQuery<number, Error>({
    queryKey: ['currentRound', eventId, 'v2-schema'],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) throw new Error('No eventId provided');
      const supabase = createBrowserClient();
      
      // First get the tournament UUID from dg_id
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('id')
        .eq('dg_id', eventId)
        .single();
        
      if (tournamentError || !tournament) {
        console.log('Tournament not found for event_id:', eventId);
        return 1; // Default to round 1
      }
      
      // Get the highest round number from betting_markets
      const { data, error } = await supabase
        .from('betting_markets')
        .select('round_specific')
        .eq('tournament_id', tournament.id)
        .order('round_specific', { ascending: false })
        .limit(1)
        .single();
        
      if (error) {
        console.log('No betting markets found for tournament:', tournament.id);
        return 1; // Default to round 1
      }
      
      return data?.round_specific ? Number(data.round_specific) : 1;
    },
    staleTime: 60_000, // 1 minute
  });
} 
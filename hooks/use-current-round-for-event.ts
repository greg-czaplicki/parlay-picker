import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase'

export function useCurrentRoundForEvent(eventId: number | null) {
  return useQuery<number, Error>({
    queryKey: ['currentRound', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) throw new Error('No eventId provided');
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('matchups_v2')
        .select('round_num')
        .eq('event_id', eventId)
        .order('round_num', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data?.round_num ? Number(data.round_num) : 1;
    },
    staleTime: 60_000, // 1 minute
  });
} 
import ParlaysClient from './parlays-client';
import { createServerClient } from "@/lib/supabase";

export default async function ParlaysPage() {
  const supabase = createServerClient();
  // Get the max round_num from matchups for the current event
  const { data, error } = await supabase
    .from('matchups')
    .select('round_num')
    .order('round_num', { ascending: false })
    .limit(1)
    .single();
  const currentRound = data?.round_num || 1;
  return <ParlaysClient currentRound={currentRound} />;
}
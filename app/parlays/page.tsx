import ParlaysClient from './parlays-client';
import { createServerClient } from "@/lib/supabase";

// Enable dynamic rendering and disable static generation for this page
// This ensures fresh data on each request in production
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
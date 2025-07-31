import { createSupabaseClient, jsonSuccess } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = createSupabaseClient();
  
  try {
    // Get current date
    const today = new Date().toISOString().split('T')[0];
    
    // Get all tournaments
    const { data: allTournaments, error } = await supabase
      .from('tournaments')
      .select('event_id, event_name, start_date, end_date, tour')
      .order('start_date', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    // Check which ones should be active
    const activeTournaments = allTournaments?.filter(t => t.end_date >= today) || [];
    
    // Get some stats from live_tournament_stats
    const { data: liveStats } = await supabase
      .from('live_tournament_stats')
      .select('event_name, round_num')
      .limit(5);
    
    return jsonSuccess({
      today,
      totalTournaments: allTournaments?.length || 0,
      activeTournaments: activeTournaments.length,
      tournaments: allTournaments,
      sampleLiveStats: liveStats,
      message: `Found ${activeTournaments.length} active tournaments out of ${allTournaments?.length || 0} total`
    });
    
  } catch (error) {
    logger.error('Error checking active events:', error);
    throw error;
  }
}
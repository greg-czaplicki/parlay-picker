import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    
    // 1. Get current week events
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0,0,0,0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    
    const { data: currentEvents, error: eventsError } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, start_date, end_date')
      .lte('start_date', sunday.toISOString().split('T')[0])
      .gte('end_date', monday.toISOString().split('T')[0]);
    
    if (eventsError) {
      return Response.json({ error: `Events error: ${eventsError.message}` }, { status: 500 });
    }

    const events = currentEvents || [];
    console.log('Current week events:', events);

    // 2. For each event, check tournament activity and available data
    const debugResults = [];
    
    for (const event of events) {
      // Check if tournament is active
      const now = new Date();
      const tournamentStart = event.start_date ? new Date(event.start_date) : null;
      const tournamentEnd = event.end_date ? new Date(event.end_date) : null;
      const isActiveTournament = tournamentStart && tournamentEnd && 
                                 now >= tournamentStart && now <= tournamentEnd;

      // Check what data exists in live_tournament_stats
      const { data: liveStats, error: liveStatsError } = await supabase
        .from('live_tournament_stats')
        .select('dg_id, player_name, position, total, today, thru, data_golf_updated_at')
        .eq('event_name', event.event_name)
        .limit(5);

      debugResults.push({
        event_id: event.event_id,
        event_name: event.event_name,
        start_date: event.start_date,
        end_date: event.end_date,
        isActiveTournament,
        daysSinceStart: tournamentStart ? Math.floor((now.getTime() - tournamentStart.getTime()) / (1000 * 60 * 60 * 24)) : null,
        daysSinceEnd: tournamentEnd ? Math.floor((now.getTime() - tournamentEnd.getTime()) / (1000 * 60 * 60 * 24)) : null,
        liveStatsCount: liveStats?.length || 0,
        sampleLiveStats: liveStats?.slice(0, 3) || [],
        liveStatsError: liveStatsError?.message || null
      });
    }

    return Response.json({ 
      success: true,
      currentDate: new Date().toISOString(),
      weekRange: {
        monday: monday.toISOString().split('T')[0],
        sunday: sunday.toISOString().split('T')[0]
      },
      events: debugResults
    }, { status: 200 });

  } catch (err: any) {
    return Response.json({ error: err.message || String(err) }, { status: 500 });
  }
} 
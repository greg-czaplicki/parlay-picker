import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    const roundNum = searchParams.get('roundNum');
    const playerIds = searchParams.get('playerIds');

    if (!eventId || !roundNum || !playerIds) {
      return Response.json({ success: false, error: 'Missing required parameters: eventId, roundNum, playerIds' }, { status: 400 });
    }

    // Parse playerIds as array of numbers
    const playerIdArr = playerIds.split(',').map((id) => Number(id)).filter((id) => !isNaN(id));
    if (playerIdArr.length === 0) {
      return Response.json({ success: false, error: 'No valid playerIds provided' }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Lookup event_name from event_id using tournaments table
    const { data: eventRows, error: eventError } = await supabase
      .from('tournaments')
      .select('event_name')
      .eq('event_id', Number(eventId))
      .limit(1);
    if (eventError) {
      return Response.json({ success: false, error: eventError.message }, { status: 500 });
    }
    if (!eventRows || eventRows.length === 0) {
      return Response.json({ success: false, error: `No event_name found for event_id ${eventId}` }, { status: 404 });
    }
    const eventName = eventRows[0].event_name;
    if (!eventName) {
      return Response.json({ success: false, error: `event_name is null for event_id ${eventId}` }, { status: 404 });
    }

    // Query latest_live_tournament_stats_view for these players, event, and round
    const { data, error } = await supabase
      .from('latest_live_tournament_stats_view')
      .select(`
        dg_id,
        player_name,
        event_name,
        round_num,
        position,
        total,
        today,
        thru
      `)
      .eq('event_name', eventName)
      .eq('round_num', roundNum)
      .in('dg_id', playerIdArr);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    // Map dg_id to player_id in the response
    const stats = (data ?? []).map(row => ({ ...row, player_id: row.dg_id }));
    return Response.json({ success: true, stats }, { status: 200 });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
} 
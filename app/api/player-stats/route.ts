import { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/api-utils';

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY;

// Helper function to fetch from DataGolf in-play API
async function fetchFromDataGolf(tour: 'pga' | 'euro'): Promise<any[]> {
  if (!DATA_GOLF_API_KEY) return [];
  
  try {
    const inPlayUrl = `https://feeds.datagolf.com/preds/in-play?tour=${tour}&dead_heat=no&odds_format=percent&key=${DATA_GOLF_API_KEY}`;
    const response = await fetch(inPlayUrl, { 
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.ok) {
      const apiResponse = await response.json();
  
      return apiResponse.data || [];
    } else {
      console.warn(`DataGolf ${tour.toUpperCase()} API failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn(`Failed to fetch from DataGolf ${tour.toUpperCase()} API:`, error);
  }
  
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    const roundNum = searchParams.get('roundNum');
    const playerIds = searchParams.get('playerIds');

    if (!eventId || !roundNum || !playerIds) {
      return Response.json({ success: false, error: 'Missing required parameters: eventId, roundNum, playerIds' }, { status: 400 });
    }

    const playerIdArr = playerIds.split(',').map((id) => Number(id)).filter((id) => !isNaN(id));
    if (playerIdArr.length === 0) {
      return Response.json({ success: false, error: `No valid playerIds provided. Raw: ${playerIds}` }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Lookup event_name from event_id using tournaments table
    const { data: eventRows, error: eventError } = await supabase
      .from('tournaments')
      .select('event_name, start_date, end_date')
      .eq('event_id', Number(eventId))
      .limit(1);
    if (eventError) {
      return Response.json({ success: false, error: eventError.message }, { status: 500 });
    }
    if (!eventRows || eventRows.length === 0) {
      return Response.json({ success: false, error: `No event_name found for event_id ${eventId}` }, { status: 404 });
    }
    const { event_name: eventName, start_date, end_date } = eventRows[0];
    if (!eventName) {
      return Response.json({ success: false, error: `event_name is null for event_id ${eventId}` }, { status: 404 });
    }

    // Check if tournament has started by looking for Round 1 completion
    // Only show position/score data after first round is complete
    const { data: round1Check, error: round1Error } = await supabase
      .from('latest_live_tournament_stats_view')
      .select('round_num')
      .eq('event_name', eventName)
      .eq('round_num', '1')
      .limit(1);
    
    const hasRound1Data = round1Check && round1Check.length > 0;
    
    if (!hasRound1Data) {
      
      // Return clean player data with no position/score information
      const cleanStats = playerIdArr.map(playerId => ({
        player_id: playerId,
        dg_id: playerId,
        player_name: "", // We don't have names readily available, but that's ok
        event_name: null,
        round_num: null,
        position: null,
        total: null,
        today: null,
        thru: null,
        current_round: null,
        round_scores: {
          R1: null,
          R2: null,
          R3: null,
          R4: null
        },
        sg_total: null,
        sg_ott: null,
        sg_app: null,
        sg_arg: null,
        sg_putt: null,
        season_sg_total: null,
        season_sg_ott: null,
        season_sg_app: null,
        season_sg_arg: null,
        season_sg_putt: null
      }));
      
      return Response.json({ 
        success: true, 
        stats: cleanStats,
        message: `Tournament not active. Showing clean data to avoid stale tournament results.`
      });
    }

    // Fetch live position data from DataGolf - try both PGA and Euro tours
    const [pgaData, euroData] = await Promise.all([
      fetchFromDataGolf('pga'),
      fetchFromDataGolf('euro')
    ]);

    // Combine all live player data
    const allLivePlayerData = [...pgaData, ...euroData];

    // Create a map of live player data by dg_id
    const liveDataMap = new Map();
    allLivePlayerData.forEach(player => {
      if (player.dg_id) {
        liveDataMap.set(player.dg_id, player);
      }
    });

    // Only use Supabase fallback if this is an active tournament
    let allEventStats: any[] = [];
    if (hasRound1Data) {
      const { data: eventStatsData, error: allEventStatsError } = await supabase
        .from('latest_live_tournament_stats_view')
        .select(`
          dg_id,
          player_name,
          event_name,
          round_num,
          position,
          total,
          today,
          thru,
          sg_total,
          sg_ott,
          sg_app,
          sg_arg,
          sg_putt,
          data_golf_updated_at
        `)
        .eq('event_name', eventName)
        .in('dg_id', playerIdArr);
      
      if (allEventStatsError) {
        console.warn(`Failed to fetch Supabase event stats: ${allEventStatsError.message}`);
      } else {
        allEventStats = eventStatsData || [];
        
        // Check data freshness - if data is older than 6 hours, consider it stale
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const staleStats = allEventStats.filter(stat => {
          if (!stat.data_golf_updated_at) return true;
          const updateTime = new Date(stat.data_golf_updated_at);
          return updateTime < sixHoursAgo;
        });
        
        if (staleStats.length > 0) {
          console.warn(`Found ${staleStats.length} stale stats entries (older than 6 hours) for event ${eventName}`);
          // If more than half the data is stale, don't use any of it
          if (staleStats.length > allEventStats.length / 2) {
            console.warn(`Majority of data is stale, clearing event stats to avoid showing old tournament data`);
            allEventStats = [];
          }
        }
      }
    } else {

    }

    // Query season stats from player_season_stats
    const { data: seasonStats, error: seasonStatsError } = await supabase
      .from('player_season_stats')
      .select(`
        dg_id,
        player_name,
        sg_total,
        sg_ott,
        sg_app,
        sg_arg,
        sg_putt
      `)
      .in('dg_id', playerIdArr);
    if (seasonStatsError) {
      return Response.json({ success: false, error: seasonStatsError.message }, { status: 500 });
    }

    // Merge event and season stats by dg_id
    const seasonStatsMap = new Map();
    (seasonStats ?? []).forEach(row => {
      if (row.dg_id != null) seasonStatsMap.set(row.dg_id, row);
    });

    // For each player, find the row with the highest round_num <= requested roundNum
    function getLastCompletedRoundStat(stats: any[], roundNum: string) {
      // roundNum is a string, e.g., '1', '2', '3', '4'
      const num = Number(roundNum);
      // Filter out non-numeric round_num (e.g., 'event_avg')
      return stats
        .filter((r: any) => !isNaN(Number(r.round_num)) && Number(r.round_num) <= num)
        .sort((a: any, b: any) => Number(b.round_num) - Number(a.round_num))[0] || null;
    }

    const mergedStats = (playerIdArr).map(dg_id => {
      const playerStats = (allEventStats ?? []).filter(r => r.dg_id === dg_id);
      const eventRow = getLastCompletedRoundStat(playerStats, roundNum);
      const seasonRow = seasonStatsMap.get(dg_id) || null;
      const liveData = liveDataMap.get(dg_id) || null;
      
      // Use live data for position, scores, and player name if available
      // If no live data and tournament is not active, return null values to show dashes
      const position = liveData?.current_pos || (hasRound1Data ? eventRow?.position : null) || null;
      const total = liveData?.current_score ?? liveData?.total ?? (hasRound1Data ? eventRow?.total : null) ?? null;
      const today = liveData?.today ?? (hasRound1Data ? eventRow?.today : null) ?? null;
      const thru = liveData?.thru ?? (hasRound1Data ? eventRow?.thru : null) ?? null;
      const playerName = liveData?.player_name || eventRow?.player_name || seasonRow?.player_name || '';

      // Add individual round data and current round info
      const currentRound = liveData?.round || null;
      const roundScores = {
        R1: liveData?.R1 || null,
        R2: liveData?.R2 || null, 
        R3: liveData?.R3 || null,
        R4: liveData?.R4 || null
      };

      return {
        player_id: dg_id,
        dg_id,
        player_name: playerName,
        event_name: eventRow?.event_name || null,
        round_num: eventRow?.round_num || null,
        position: position,
        total: total,
        today: today,
        thru: thru,
        // Add round-specific data
        current_round: currentRound,
        round_scores: roundScores,
        sg_total: eventRow?.sg_total ?? null,
        sg_ott: eventRow?.sg_ott ?? null,
        sg_app: eventRow?.sg_app ?? null,
        sg_arg: eventRow?.sg_arg ?? null,
        sg_putt: eventRow?.sg_putt ?? null,
        // Season stats (always included, mapped to season_*)
        season_sg_total: seasonRow?.sg_total ?? null,
        season_sg_ott: seasonRow?.sg_ott ?? null,
        season_sg_app: seasonRow?.sg_app ?? null,
        season_sg_arg: seasonRow?.sg_arg ?? null,
        season_sg_putt: seasonRow?.sg_putt ?? null,
      };
    });


    return Response.json({ success: true, stats: mergedStats }, { status: 200 });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message || String(err) }, { status: 500 });
  }
} 
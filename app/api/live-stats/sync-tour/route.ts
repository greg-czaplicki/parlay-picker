import 'next-logger'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess, getQueryParams } from '@/lib/api-utils'
import { z } from 'zod'

// Define interfaces for the Data Golf API response
interface LivePlayerData {
  dg_id: number;
  player_name: string;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  position?: string | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  round?: number | null;
}

interface DataGolfLiveStatsResponse {
  course_name: string;
  event_name: string;
  last_updated: string; // e.g., "2021-05-24 16:15:26 UTC"
  stat_display: string;
  stat_round: string; // e.g., "event_avg"
  live_stats: LivePlayerData[];
}

// Define the structure for Supabase insert (matching historical table)
interface SupabaseLiveStat {
  dg_id: number;
  player_name: string;
  event_name: string;
  course_name: string;
  round_num: string;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  position?: string | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  data_golf_updated_at: string;
}

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// Helper to create the URL based on the tour type
function getLiveStatsUrl(tour: string) {
  return `https://feeds.datagolf.com/preds/live-tournament-stats?tour=${tour}&stats=sg_app,sg_ott,sg_putt,sg_arg,sg_t2g,sg_total,accuracy,distance,gir,prox_fw,scrambling,position,thru,today,total&display=value&file_format=json&key=${dataGolfApiKey}`;
}

// Rounds we want to fetch data for
const ROUNDS_TO_FETCH = ["1", "2", "3", "4", "event_avg"];

// Helper to fetch live stats for a round
async function fetchLiveStats(tour: string, round: string): Promise<DataGolfLiveStatsResponse | null> {
  const baseUrl = getLiveStatsUrl(tour);
  const url = `${baseUrl}&round=${round}`;
  
  logger.info(`Fetching ${tour} tour data for round ${round}`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn(`Round ${round} data not found (404) for tour ${tour}, skipping.`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Fetch failed for ${tour} tour round ${round}: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (err) {
    throw new Error(`Error fetching ${tour} tour round ${round}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Helper to map DataGolf player data to Supabase insert format
function mapStatsToInsert(data: DataGolfLiveStatsResponse, timestamp: string): SupabaseLiveStat[] {
  return (data.live_stats || []).map((player) => ({
    dg_id: player.dg_id,
    player_name: player.player_name,
    event_name: data.event_name,
    course_name: data.course_name,
    round_num: data.stat_round,
    sg_app: player.sg_app,
    sg_ott: player.sg_ott,
    sg_putt: player.sg_putt,
    sg_arg: player.sg_arg ?? null,
    sg_t2g: player.sg_t2g ?? null,
    sg_total: player.sg_total ?? null,
    accuracy: player.accuracy ?? null,
    distance: player.distance ?? null,
    gir: player.gir ?? null,
    prox_fw: player.prox_fw ?? null,
    scrambling: player.scrambling ?? null,
    position: player.position ?? null,
    thru: player.thru ?? null,
    today: player.round ?? null,
    total: player.total ?? null,
    data_golf_updated_at: timestamp,
  }));
}

// Replace legacy param validation with Zod and getQueryParams
const tourParamSchema = z.object({ tour: z.enum(['pga', 'opp', 'euro']) });

export async function GET(request: Request) {
  logger.info('Received live-stats/sync-tour request', { url: request.url });
  try {
    const { tour } = getQueryParams(request, tourParamSchema);
  
  // Validate tour parameter
  if (!['pga', 'opp', 'euro'].includes(tour)) {
      return handleApiError(`Invalid tour parameter: ${tour}. Must be one of: pga, opp, euro.`);
  }

  // First, check if there are any active tournaments before syncing
  const supabase = createSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const { data: activeTournaments, error: tournamentsError } = await supabase
    .from('tournaments')
    .select('event_id, event_name, start_date, end_date')
    .lte('start_date', today) // Started before or on today
    .gte('end_date', today);  // Ends after or on today

  if (tournamentsError) {
    logger.error("Error checking active tournaments:", tournamentsError);
    return handleApiError(`Failed to check tournament status: ${tournamentsError.message}`);
  }

  if (!activeTournaments || activeTournaments.length === 0) {
    logger.info("No active tournaments found. Skipping live stats sync to avoid fetching stale data.");
    return jsonSuccess({
      processedCount: 0,
      sourceTimestamp: null,
      eventName: null,
      tour: tour,
      errors: [],
      message: "No active tournaments - sync skipped"
    }, "No active tournaments found. Live stats sync skipped to avoid stale data.");
  }

  logger.info(`Found ${activeTournaments.length} active tournament(s): ${activeTournaments.map(t => t.event_name).join(', ')}`);
  
    logger.info(`Starting multi-round live stats sync for ${tour.toUpperCase()} tour...`);
  let totalInsertedCount = 0;
  let lastSourceTimestamp: string | null = null;
  let fetchedEventName: string | null = null;
  const errors: string[] = [];

  // Only fetch Euro tour data if tour is 'euro' and handle appropriately
  if (tour === 'euro') {
      return handleApiError('Euro tour data is not supported by DataGolf API. Only PGA and Opposite Field events are supported.');
  }

  for (const round of ROUNDS_TO_FETCH) {
    try {
      const data = await fetchLiveStats(tour, round);
      if (!data) continue;

      // Check if this event is in our active tournaments list
      const matchingTournament = activeTournaments.find(t => t.event_name === data.event_name);
      if (!matchingTournament) {
        logger.info(`Event "${data.event_name}" from ${tour.toUpperCase()} tour is not in active tournaments list. Skipping sync for this event.`);
        continue;
      }

      const currentRoundTimestamp = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
      lastSourceTimestamp = currentRoundTimestamp;
      fetchedEventName = data.event_name;
      const statsToInsert = mapStatsToInsert(data, currentRoundTimestamp);
        // Upsert on (dg_id, round_num, event_name)
        const { error } = await supabase
          .from("live_tournament_stats")
          .upsert(statsToInsert, { onConflict: "dg_id,round_num,event_name" });
        if (error) {
          errors.push(`Upsert failed for round ${round}: ${error.message}`);
          logger.error(`Upsert failed for round ${round}: ${error.message}`);
      } else {
        totalInsertedCount += statsToInsert.length;
      }
    } catch (err: any) {
      errors.push(err.message || String(err));
        logger.error(`Error syncing round ${round}: ${err.message || String(err)}`);
    }
  }

  const finalMessage = `${tour.toUpperCase()} tour sync complete. Total records inserted/updated: ${totalInsertedCount} across attempted rounds for ${fetchedEventName ?? 'event'}.`;
  if (errors.length > 0) {
      logger.warn(`${tour.toUpperCase()} sync completed with errors:`, errors);
  }

    logger.info('Returning live-stats/sync-tour response');
  return jsonSuccess({
    processedCount: totalInsertedCount,
    sourceTimestamp: lastSourceTimestamp,
    eventName: fetchedEventName,
    tour: tour,
    errors,
  }, finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''));
  } catch (error) {
    logger.error('Error in live-stats/sync-tour endpoint:', error);
    return handleApiError(error);
  }
}
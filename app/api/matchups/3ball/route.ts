import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

// Define interfaces for the Data Golf API response
interface Odds {
  p1: number | null;
  p2: number | null;
  p3: number | null;
}

interface BookmakerOdds {
  [bookmaker: string]: Odds;
}

interface Matchup {
  odds: BookmakerOdds;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id: number;
  p3_player_name: string;
  ties: string;
}

interface DataGolfResponse {
  event_name: string;
  last_updated: string; // ISO 8601 format e.g., "2025-04-10 11:30:00 UTC"
  market: string;
  match_list: Matchup[];
  round_num: number;
}

// Define the structure for Supabase insertion
interface SupabaseMatchup {
  event_id: number;
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id: number;
  p3_player_name: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  fanduel_p3_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  draftkings_p3_odds: number | null;
  datagolf_p1_odds: number | null;
  datagolf_p2_odds: number | null;
  datagolf_p3_odds: number | null;
  tour?: string; // Added tour field
}

// Data Golf API Key - Ensure this environment variable is set!
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

// Remove validate/threeBallMatchupsQuerySchema and use zod inline schema
const querySchema = z.object({ eventId: z.string().optional(), tour: z.string().optional() })

// Helper function to process matchups for a specific tour
function processMatchups(
  data: DataGolfResponse,
  eventMapping: Record<string, number>,
  tourCode: string,
  fallbackEventId: number
): SupabaseMatchup[] {
  if (!data || !data.match_list) {
    logger.info(`No 3-ball matchups found for ${tourCode} tour`);
    return [];
  }
  if (!Array.isArray(data.match_list)) {
    logger.error(`ERROR: match_list is not an array for ${tourCode} tour. Type: ${typeof data.match_list}`);
    logger.error(`Data structure: ${JSON.stringify(data).substring(0, 500)}...`);
    return [];
  }
  let eventId = fallbackEventId;
  if (data.event_name) {
    const nameLower = data.event_name.toLowerCase();
    if (eventMapping[nameLower]) {
      eventId = eventMapping[nameLower];
    }
  }
  logger.info(
    `Processing ${data.match_list.length} 3-ball matchups for ${tourCode} tour - ${data.event_name} (Event ID: ${eventId})`
  );
  return data.match_list.map((m) => ({
    event_id: eventId,
    event_name: data.event_name,
    round_num: data.round_num,
    data_golf_update_time: new Date(
      data.last_updated.replace(" UTC", "Z")
    ).toISOString(),
    p1_dg_id: m.p1_dg_id,
    p1_player_name: m.p1_player_name,
    p2_dg_id: m.p2_dg_id,
    p2_player_name: m.p2_player_name,
    p3_dg_id: m.p3_dg_id,
    p3_player_name: m.p3_player_name,
    ties_rule: m.ties,
    fanduel_p1_odds: m.odds?.fanduel?.p1 || null,
    fanduel_p2_odds: m.odds?.fanduel?.p2 || null,
    fanduel_p3_odds: m.odds?.fanduel?.p3 || null,
    draftkings_p1_odds: m.odds?.draftkings?.p1 || null,
    draftkings_p2_odds: m.odds?.draftkings?.p2 || null,
    draftkings_p3_odds: m.odds?.draftkings?.p3 || null,
    datagolf_p1_odds: m.odds?.datagolf?.p1 || null,
    datagolf_p2_odds: m.odds?.datagolf?.p2 || null,
    datagolf_p3_odds: m.odds?.datagolf?.p3 || null,
    tour: tourCode.toLowerCase(),
  }));
}

export async function GET(request: Request): Promise<Response> {
  let params;
  try {
    params = getQueryParams(request, querySchema)
  } catch (error) {
    return handleApiError(error);
  }
  const { eventId, tour } = params;
  logger.info(`API: Received request for 3-ball matchups with eventId=${eventId}, tour=${tour}`);
  try {
    const supabase = createSupabaseClient();
    logger.info("Fetching fresh data from DataGolf API");
    // Fetch all tours in parallel
    const [pgaRes, oppRes, euroRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_OPP_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_EURO_URL, { cache: 'no-store' })
    ]);
    if (!pgaRes.ok && !oppRes.ok && !euroRes.ok) {
      throw new Error("Failed to fetch from DataGolf API for all tours");
    }
    let pgaData: DataGolfResponse | null = null;
    let oppData: DataGolfResponse | null = null;
    let euroData: DataGolfResponse | null = null;
    try {
      if (pgaRes.ok) {
        pgaData = await pgaRes.json();
        if (pgaData) {
          logger.info(`PGA event: ${pgaData.event_name}, 3-ball matchups: ${pgaData.match_list?.length || 0}`);
        }
      }
    } catch (error) {
      logger.error("Error parsing PGA 3-ball data:", error);
    }
    try {
      if (oppRes.ok) {
        oppData = await oppRes.json();
        if (oppData) {
          logger.info(`Opposite field event: ${oppData.event_name}, 3-ball matchups: ${oppData.match_list?.length || 0}`);
        }
      }
    } catch (error) {
      logger.error("Error parsing Opposite field 3-ball data:", error);
    }
    try {
      if (euroRes.ok) {
        euroData = await euroRes.json();
        if (euroData) {
          logger.info(`European Tour event: ${euroData.event_name}, 3-ball matchups: ${euroData.match_list?.length || 0}`);
        }
      }
    } catch (error) {
      logger.error("Error parsing European Tour 3-ball data:", error);
    }
    // Get tournaments to map event names to IDs
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour");
    const eventMapping: Record<string, number> = {};
    if (tournaments) {
      tournaments.forEach((t: { event_name: string; event_id: number }) => {
        const nameLower = t.event_name.toLowerCase();
        eventMapping[nameLower] = t.event_id;
        if (nameLower.includes('myrtle')) eventMapping['myrtle'] = t.event_id;
      });
    }
    // Process matchups for each tour
    const pgaMatchups = pgaData ? processMatchups(pgaData, eventMapping, "pga", 480) : [];
    const oppMatchups = oppData ? processMatchups(oppData, eventMapping, "opp", 553) : [];
    const euroMatchups = euroData ? processMatchups(euroData, eventMapping, "euro", 600) : [];
    const allMatchups = [...pgaMatchups, ...oppMatchups, ...euroMatchups];
    logger.info(`Processed ${allMatchups.length} total 3-ball matchups across all tours`);
    // Save matchups to both latest and historical tables
    try {
      const { data: latestHistory, error: historyError } = await supabase
        .from("three_ball_matchups")
        .select("data_golf_update_time")
        .order("data_golf_update_time", { ascending: false })
        .limit(1);
      let shouldSaveHistory = true;
      if (!historyError && latestHistory && latestHistory.length > 0) {
        const historyTime = new Date(latestHistory[0].data_golf_update_time);
        const updateTimes = [
          pgaData ? new Date(pgaData.last_updated.replace(" UTC", "Z")) : null,
          oppData ? new Date(oppData.last_updated.replace(" UTC", "Z")) : null,
          euroData ? new Date(euroData.last_updated.replace(" UTC", "Z")) : null
        ].filter(Boolean) as Date[];
        shouldSaveHistory = updateTimes.some(time => time > historyTime);
      }
      if (shouldSaveHistory && allMatchups.length > 0) {
        logger.info("Saving 3-ball matchups to historical table...");
        await supabase
          .from("three_ball_matchups")
          .insert(allMatchups);
      }
      if (allMatchups.length > 0) {
        await supabase.from("latest_three_ball_matchups").delete().gte("id", 0);
        const { error: insertError } = await supabase
          .from("latest_three_ball_matchups")
          .insert(allMatchups);
        if (insertError) {
          logger.error("Error inserting 3-ball matchups:", insertError);
        } else {
          logger.info(`Successfully updated latest_three_ball_matchups with ${allMatchups.length} matchups`);
        }
      }
    } catch (dbError) {
      logger.error("Database error:", dbError);
    }
    let filteredMatchups = allMatchups;
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        filteredMatchups = filteredMatchups.filter(m => Number(m.event_id) === eventIdInt);
        logger.info(`Filtered to ${filteredMatchups.length} 3-ball matchups for event ${eventIdInt}`);
      }
    }
    if (tour) {
      const tourLower = tour.toLowerCase();
      filteredMatchups = filteredMatchups.filter(m => m.tour === tourLower);
      logger.info(`Filtered to ${filteredMatchups.length} 3-ball matchups for tour ${tourLower}`);
    }
    const matchupsByEvent: Record<string | number, {
      event_id: number;
      event_name: string;
      tour?: string;
      matchups: SupabaseMatchup[];
    }> = {};
    filteredMatchups.forEach((m) => {
      const eventIdKey = m.event_id ?? 'unknown';
      if (!matchupsByEvent[eventIdKey]) {
        matchupsByEvent[eventIdKey] = {
          event_id: m.event_id,
          event_name: m.event_name,
          tour: m.tour,
          matchups: [],
        };
      }
      matchupsByEvent[eventIdKey].matchups.push(m);
    });
    return jsonSuccess({
      matchups: filteredMatchups,
      events: Object.values(matchupsByEvent),
      tourCounts: {
        pga: pgaMatchups.length,
        opp: oppMatchups.length,
        euro: euroMatchups.length
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}

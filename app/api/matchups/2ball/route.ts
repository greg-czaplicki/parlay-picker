import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils'

// Define interfaces for the Data Golf API response (2-ball)
interface Odds {
  p1: number | null;
  p2: number | null;
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
  ties: string;
}

interface DataGolfResponse {
  event_name: string;
  last_updated: string;
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
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  tour?: string; // Added tour field
}

const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

// Helper function to process matchups for a specific tour
function processMatchups(
  data: DataGolfResponse,
  eventMapping: Record<string, number>,
  tourCode: string,
  fallbackEventId: number
): SupabaseMatchup[] {
  if (!data || !data.match_list) {
    logger.info(`No matchups found for ${tourCode} tour`);
    return [];
  }
  // Find appropriate event ID based on event name
  let eventId = fallbackEventId;
  if (data.event_name) {
    const nameLower = data.event_name.toLowerCase();
    if (eventMapping[nameLower]) {
      eventId = eventMapping[nameLower];
    }
  }
  logger.info(
    `Processing ${data.match_list.length} matchups for ${tourCode} tour - ${data.event_name} (Event ID: ${eventId})`
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
    ties_rule: m.ties,
    fanduel_p1_odds: typeof m.odds?.fanduel?.p1 === 'number' ? m.odds.fanduel.p1 : null,
    fanduel_p2_odds: typeof m.odds?.fanduel?.p2 === 'number' ? m.odds.fanduel.p2 : null,
    draftkings_p1_odds: typeof m.odds?.draftkings?.p1 === 'number' ? m.odds.draftkings.p1 : null,
    draftkings_p2_odds: typeof m.odds?.draftkings?.p2 === 'number' ? m.odds.draftkings.p2 : null,
    tour: tourCode.toLowerCase(),
  }));
}

const querySchema = z.object({ eventId: z.string().optional(), tour: z.string().optional() })

export async function GET(request: Request) {
  let params;
  try {
    params = getQueryParams(request, querySchema)
  } catch (error) {
    logger.error('Zod param parse error', { error });
    return handleApiError(error);
  }
  const { eventId, tour } = params;
  logger.info(`API: Received request with eventId=${eventId}, tour=${tour}`);
  try {
    const supabase = createSupabaseClient()
    logger.info('Fetching from DataGolf APIs...');
    // Fetch from DataGolf APIs directly
    // Fetch all tours in parallel
    const [pgaRes, oppRes, euroRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_OPP_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_EURO_URL, { cache: 'no-store' })
    ]);
    // Check if at least one API call succeeded
    if (!pgaRes.ok && !oppRes.ok && !euroRes.ok) {
      throw new Error("Failed to fetch from DataGolf API for all tours");
    }
    // Parse the responses with error handling
    let pgaData = null;
    let oppData = null;
    let euroData = null;
    try {
      if (pgaRes.ok) {
        pgaData = await pgaRes.json();
        if (pgaData) {
          logger.info(
            `PGA event: ${pgaData?.event_name ?? 'N/A'}, matchups: ${Array.isArray(pgaData?.match_list) ? pgaData.match_list.length : 0}`
          );
        }
      }
    } catch (error) {
      logger.error("Error parsing PGA data:", error);
    }
    try {
      if (oppRes.ok) {
        oppData = await oppRes.json();
        if (oppData) {
          logger.info(
            `Opposite field event: ${oppData?.event_name ?? 'N/A'}, matchups: ${Array.isArray(oppData?.match_list) ? oppData.match_list.length : 0}`
          );
        }
      }
    } catch (error) {
      logger.error("Error parsing Opposite field data:", error);
    }
    try {
      if (euroRes.ok) {
        euroData = await euroRes.json();
        if (euroData) {
          logger.info(
            `European Tour event: ${euroData?.event_name ?? 'N/A'}, matchups: ${Array.isArray(euroData?.match_list) ? euroData.match_list.length : 0}`
          );
        }
      }
    } catch (error) {
      logger.error("Error parsing European Tour data:", error);
    }
    // Get tournaments to map event names to IDs
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour");
    // Create a map to look up event IDs
    const eventMapping: Record<string, number> = {};
    if (tournaments) {
      tournaments.forEach((t) => {
        const nameLower = t.event_name.toLowerCase();
        eventMapping[nameLower] = t.event_id;
        if (nameLower.includes('myrtle')) eventMapping['myrtle'] = t.event_id;
      });
    }
    // Process matchups for each tour
    const pgaMatchups = pgaData ? processMatchups(pgaData, eventMapping, "pga", 480) : [];
    const oppMatchups = oppData ? processMatchups(oppData, eventMapping, "opp", 553) : [];
    const euroMatchups = euroData ? processMatchups(euroData, eventMapping, "euro", 600) : [];
    // Combine all matchups
    let allMatchups = [...pgaMatchups, ...oppMatchups, ...euroMatchups];
    // Filter to only include matchups with both FanDuel odds present
    allMatchups = allMatchups.filter(m => typeof m.fanduel_p1_odds === 'number' && typeof m.fanduel_p2_odds === 'number');
    logger.info('Sample mapped odds:', {
      sample: allMatchups.slice(0, 3).map(m => ({
        p1: m.fanduel_p1_odds,
        p2: m.fanduel_p2_odds
      }))
    });
    logger.info('All matchups:', { allMatchups });
    // Log event mapping and event IDs before filtering
    logger.info('EventId from request:', { eventId });
    logger.info('eventMapping:', eventMapping);
    logger.info('Event IDs in allMatchups:', { eventIds: allMatchups.map(m => m.event_id) });
    // Apply filters if specified
    let filteredMatchups = allMatchups;
    // Filter by event ID if provided
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      filteredMatchups = filteredMatchups.filter(m => Number(m.event_id) === eventIdInt);
      logger.info(`Filtered to ${filteredMatchups.length} matchups for event ${eventIdInt}`);
      logger.info('Event IDs in filteredMatchups:', { eventIds: filteredMatchups.map(m => m.event_id) });
    }
    // Filter by tour if provided
    if (tour) {
      const tourLower = tour.toLowerCase();
      filteredMatchups = filteredMatchups.filter(m => m.tour === tourLower);
      logger.info(`Filtered to ${filteredMatchups.length} matchups for tour ${tourLower}`);
    }
    // Group matchups by event
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
    logger.info('Filtered matchups:', { filteredMatchups });
    logger.info('Returning from /2ball', {
      eventId,
      tour,
      filteredMatchups,
      matchupsByEventKeys: Object.keys(matchupsByEvent),
      matchupsByEvent,
    });
    return jsonSuccess({
      success: true,
      matchups: filteredMatchups,
      tourCounts: {
        pga: pgaMatchups.length,
        opp: oppMatchups.length,
        euro: euroMatchups.length
      }
    });
  } catch (error) {
    logger.error('Error in /2ball endpoint', { error, eventId, tour });
    return handleApiError(error)
  }
}
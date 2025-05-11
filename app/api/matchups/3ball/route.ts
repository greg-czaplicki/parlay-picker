import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'
import { validate } from '@/lib/validation'
import { threeBallMatchupsQuerySchema } from '@/lib/schemas'

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

// Initialize Supabase client - Ensure these environment variables are set!
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL or Service Role Key is missing in environment variables.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Data Golf API Key - Ensure this environment variable is set!
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

// Helper function to process matchups for a specific tour
async function processMatchups(data: DataGolfResponse, eventMapping: Record<string, number>, tourCode: string, fallbackEventId: number): SupabaseMatchup[] {
  if (!data || !data.match_list) {
    console.log(`No 3-ball matchups found for ${tourCode} tour`);
    return [];
  }

  // Add safeguard if match_list isn't an array
  if (!Array.isArray(data.match_list)) {
    console.error(`ERROR: match_list is not an array for ${tourCode} tour. Type: ${typeof data.match_list}`);
    console.error(`Data structure: ${JSON.stringify(data).substring(0, 500)}...`);
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
  
  console.log(`Processing ${data.match_list.length} 3-ball matchups for ${tourCode} tour - ${data.event_name} (Event ID: ${eventId})`);
  
  return data.match_list.map(m => ({
    event_id: eventId,
    event_name: data.event_name,
    round_num: data.round_num,
    data_golf_update_time: new Date(data.last_updated.replace(" UTC", "Z")).toISOString(),
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
    tour: tourCode.toLowerCase()
  }));
}

export async function GET(request: Request): Promise<Response> {
  // Parse and validate query parameters
  const url = new URL(request.url);
  let params;
  try {
    params = validate(threeBallMatchupsQuerySchema, {
      eventId: url.searchParams.get('eventId') ?? undefined,
      tour: url.searchParams.get('tour') ?? undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
  const { eventId, tour } = params;
  console.log(`API: Received request for 3-ball matchups with eventId=${eventId}, tour=${tour}`);
  
  // Skip caching for now - we'll always fetch fresh data
  console.log("Fetching fresh data from DataGolf API");

  try {
    // Fetch from DataGolf APIs directly
    console.log("Fetching 3-ball matchups from Data Golf APIs...");
    
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
    let pgaData: DataGolfResponse | null = null;
    let oppData: DataGolfResponse | null = null;
    let euroData: DataGolfResponse | null = null;
    
    try {
      if (pgaRes.ok) {
        pgaData = await pgaRes.json();
        if (pgaData) {
          console.log(`PGA event: ${pgaData.event_name}, 3-ball matchups: ${pgaData.match_list?.length || 0}`);
          console.log(`PGA data structure: ${JSON.stringify(pgaData)}`);
          console.log(`Type of match_list: ${typeof pgaData.match_list}`);
        }
      }
    } catch (error) {
      console.error("Error parsing PGA 3-ball data:", error);
    }
    
    try {
      if (oppRes.ok) {
        oppData = await oppRes.json();
        if (oppData) {
          console.log(`Opposite field event: ${oppData.event_name}, 3-ball matchups: ${oppData.match_list?.length || 0}`);
        }
      }
    } catch (error) {
      console.error("Error parsing Opposite field 3-ball data:", error);
    }
    
    try {
      if (euroRes.ok) {
        euroData = await euroRes.json();
        if (euroData) {
          console.log(`European Tour event: ${euroData.event_name}, 3-ball matchups: ${euroData.match_list?.length || 0}`);
        }
      }
    } catch (error) {
      console.error("Error parsing European Tour 3-ball data:", error);
    }
    
    // Get tournaments to map event names to IDs
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour");
    
    // Create a map to look up event IDs
    const eventMapping: Record<string, number> = {};
    if (tournaments) {
      tournaments.forEach((t: { event_name: string; event_id: number }) => {
        const nameLower = t.event_name.toLowerCase();
        eventMapping[nameLower] = t.event_id;
        
        // Add partial matches too for backward compatibility
        if (nameLower.includes('myrtle')) eventMapping['myrtle'] = t.event_id;
      });
    }
    
    // Process matchups for each tour - with additional safeguards
    let pgaMatchups = [];
    let oppMatchups = [];
    let euroMatchups = [];

    try {
      // Handle PGA matchups
      if (pgaData) {
        if (!pgaData.match_list) {
          console.error("PGA data exists but match_list is undefined/null");
        } else if (!Array.isArray(pgaData.match_list)) {
          console.error(`PGA match_list is not an array: ${typeof pgaData.match_list}`);
          // Try to convert to array if it's an object with numeric keys
          if (typeof pgaData.match_list === 'object' && pgaData.match_list !== null) {
            const values = Object.values(pgaData.match_list);
            if (values.length > 0) {
              console.log(`Converting object to array with ${values.length} items`);
              pgaData.match_list = values;
            }
          }
        }
        pgaMatchups = await processMatchups(pgaData, eventMapping, "pga", 480);
      }

      // Handle Opposite Field matchups
      if (oppData) {
        if (!oppData.match_list) {
          console.error("OPP data exists but match_list is undefined/null");
        } else if (!Array.isArray(oppData.match_list)) {
          console.error(`OPP match_list is not an array: ${typeof oppData.match_list}`);
          // Try to convert to array if it's an object with numeric keys
          if (typeof oppData.match_list === 'object' && oppData.match_list !== null) {
            const values = Object.values(oppData.match_list);
            if (values.length > 0) {
              console.log(`Converting object to array with ${values.length} items`);
              oppData.match_list = values;
            }
          }
        }
        oppMatchups = await processMatchups(oppData, eventMapping, "opp", 553);
      }

      // Handle Euro Tour matchups
      if (euroData) {
        if (!euroData.match_list) {
          console.error("EURO data exists but match_list is undefined/null");
        } else if (!Array.isArray(euroData.match_list)) {
          console.error(`EURO match_list is not an array: ${typeof euroData.match_list}`);
          // Try to convert to array if it's an object with numeric keys
          if (typeof euroData.match_list === 'object' && euroData.match_list !== null) {
            const values = Object.values(euroData.match_list);
            if (values.length > 0) {
              console.log(`Converting object to array with ${values.length} items`);
              euroData.match_list = values;
            }
          }
        }
        euroMatchups = await processMatchups(euroData, eventMapping, "euro", 600);
      }
    } catch (processError) {
      console.error("Error processing matchups:", processError);
    }
    
    // Combine all matchups
    const allMatchups = [...pgaMatchups, ...oppMatchups, ...euroMatchups];
    
    console.log(`Processed ${allMatchups.length} total 3-ball matchups across all tours`);
    
    // Save matchups to both latest and historical tables
    try {
      // First check if we already have newer data in the historical table
      const { data: latestHistory, error: historyError } = await supabase
        .from("three_ball_matchups")
        .select("data_golf_update_time")
        .order("data_golf_update_time", { ascending: false })
        .limit(1);
        
      let shouldSaveHistory = true;
      
      if (!historyError && latestHistory && latestHistory.length > 0) {
        const historyTime = new Date(latestHistory[0].data_golf_update_time);
        // Check update times from all tours that have data
        const updateTimes = [
          pgaData ? new Date(pgaData.last_updated.replace(" UTC", "Z")) : null,
          oppData ? new Date(oppData.last_updated.replace(" UTC", "Z")) : null,
          euroData ? new Date(euroData.last_updated.replace(" UTC", "Z")) : null
        ].filter(Boolean);
        
        // Only save to history if any tour has newer data
        shouldSaveHistory = updateTimes.some(time => time > historyTime);
      }
      
      // Save to historical table if we have newer data
      if (shouldSaveHistory && allMatchups.length > 0) {
        console.log("Saving 3-ball matchups to historical table...");
        await supabase
          .from("three_ball_matchups")
          .insert(allMatchups);
      }
      
      // Update latest matchups table (always)
      if (allMatchups.length > 0) {
        // First clear existing data
        await supabase.from("latest_three_ball_matchups").delete().gte("id", 0);
        
        // Then insert new data
        const { error: insertError } = await supabase
          .from("latest_three_ball_matchups")
          .insert(allMatchups);
          
        if (insertError) {
          console.error("Error inserting 3-ball matchups:", insertError);
        } else {
          console.log(`Successfully updated latest_three_ball_matchups with ${allMatchups.length} matchups`);
        }
      }
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Continue anyway - we'll return the API data directly
    }
    
    // Apply filters if specified
    let filteredMatchups = allMatchups;
    
    // Filter by event ID if provided
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        filteredMatchups = filteredMatchups.filter(m => Number(m.event_id) === eventIdInt);
        console.log(`Filtered to ${filteredMatchups.length} 3-ball matchups for event ${eventIdInt}`);
      }
    }
    
    // Filter by tour if provided
    if (tour) {
      const tourLower = tour.toLowerCase();
      filteredMatchups = filteredMatchups.filter(m => m.tour === tourLower);
      console.log(`Filtered to ${filteredMatchups.length} 3-ball matchups for tour ${tourLower}`);
    }
    
    // Group matchups by event
    const matchupsByEvent: Record<string | number, {
      event_id: number;
      event_name: string;
      tour?: string;
      matchups: SupabaseMatchup[];
    }> = {};
    filteredMatchups.forEach(m => {
      const eventIdKey = m.event_id || 'unknown';
      if (!matchupsByEvent[eventIdKey]) {
        matchupsByEvent[eventIdKey] = {
          event_id: m.event_id,
          event_name: m.event_name,
          tour: m.tour,
          matchups: []
        };
      }
      matchupsByEvent[eventIdKey].matchups.push(m);
    });
    
    return NextResponse.json({
      success: true,
      matchups: filteredMatchups,
      events: Object.values(matchupsByEvent),
      tourCounts: {
        pga: pgaMatchups.length,
        opp: oppMatchups.length,
        euro: euroMatchups.length
      }
    });
    
  } catch (error) {
    // Enhanced error reporting
    let errorDetails = {};
    try {
      errorDetails = {
        pgaDataExists: !!pgaData,
        pgaMatchListType: pgaData ? typeof pgaData.match_list : 'undefined',
        pgaMatchListIsArray: pgaData ? Array.isArray(pgaData.match_list) : false,
        oppDataExists: !!oppData,
        oppMatchListType: oppData ? typeof oppData.match_list : 'undefined',
        oppMatchListIsArray: oppData ? Array.isArray(oppData.match_list) : false,
        euroDataExists: !!euroData,
        euroMatchListType: euroData ? typeof euroData.match_list : 'undefined',
        euroMatchListIsArray: euroData ? Array.isArray(euroData.match_list) : false,
        allMatchupsLength: allMatchups?.length || 0,
        pgaMatchupsLength: pgaMatchups?.length || 0,
        oppMatchupsLength: oppMatchups?.length || 0,
        euroMatchupsLength: euroMatchups?.length || 0,
        errorStack: error instanceof Error ? error.stack : null
      };
    } catch (diagnosticError) {
      errorDetails = { diagnosticError: `Error collecting diagnostics: ${diagnosticError.message}` };
    }
    return handleApiError(error, { diagnostic: errorDetails })
  }
}

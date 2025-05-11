import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

// Helper function to process matchups for a specific tour
async function processMatchups(data: DataGolfResponse, eventMapping: Record<string, number>, tourCode: string, fallbackEventId: number): SupabaseMatchup[] {
  if (!data || !data.match_list) {
    console.log(`No matchups found for ${tourCode} tour`);
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
  
  console.log(`Processing ${data.match_list.length} matchups for ${tourCode} tour - ${data.event_name} (Event ID: ${eventId})`);
  
  return data.match_list.map(m => ({
    event_id: eventId,
    event_name: data.event_name,
    round_num: data.round_num,
    data_golf_update_time: new Date(data.last_updated.replace(" UTC", "Z")).toISOString(),
    p1_dg_id: m.p1_dg_id,
    p1_player_name: m.p1_player_name,
    p2_dg_id: m.p2_dg_id,
    p2_player_name: m.p2_player_name,
    ties_rule: m.ties,
    fanduel_p1_odds: m.odds?.fanduel?.p1 || null,
    fanduel_p2_odds: m.odds?.fanduel?.p2 || null,
    draftkings_p1_odds: m.odds?.draftkings?.p1 || null,
    draftkings_p2_odds: m.odds?.draftkings?.p2 || null,
    tour: tourCode.toLowerCase()
  }));
}

export async function GET(request: Request) {
  // Parse query parameters
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  const tour = url.searchParams.get('tour'); // Optional parameter to filter by tour
  
  console.log(`API: Received request with eventId=${eventId}, tour=${tour}`);
  
  try {
    // Fetch from DataGolf APIs directly
    console.log("Fetching from DataGolf APIs...");
    
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
        console.log(`PGA event: ${pgaData.event_name}, matchups: ${pgaData.match_list?.length || 0}`);
      }
    } catch (error) {
      console.error("Error parsing PGA data:", error);
    }
    
    try {
      if (oppRes.ok) {
        oppData = await oppRes.json();
        console.log(`Opposite field event: ${oppData.event_name}, matchups: ${oppData.match_list?.length || 0}`);
      }
    } catch (error) {
      console.error("Error parsing Opposite field data:", error);
    }
    
    try {
      if (euroRes.ok) {
        euroData = await euroRes.json();
        console.log(`European Tour event: ${euroData.event_name}, matchups: ${euroData.match_list?.length || 0}`);
      }
    } catch (error) {
      console.error("Error parsing European Tour data:", error);
    }
    
    // Get tournaments to map event names to IDs
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour");
    
    // Create a map to look up event IDs
    const eventMapping = {};
    if (tournaments) {
      tournaments.forEach(t => {
        const nameLower = t.event_name.toLowerCase();
        eventMapping[nameLower] = t.event_id;
        
        // Add partial matches too for backward compatibility
        if (nameLower.includes('myrtle')) eventMapping['myrtle'] = t.event_id;
      });
    }
    
    // Process matchups for each tour
    const pgaMatchups = pgaData ? await processMatchups(pgaData, eventMapping, "pga", 480) : [];
    const oppMatchups = oppData ? await processMatchups(oppData, eventMapping, "opp", 553) : [];
    const euroMatchups = euroData ? await processMatchups(euroData, eventMapping, "euro", 600) : []; // Using 600 as fallback ID for Euro events
    
    // Combine all matchups
    const allMatchups = [...pgaMatchups, ...oppMatchups, ...euroMatchups];
    
    console.log(`Processed ${allMatchups.length} total matchups across all tours`);
    
    // Save matchups to both latest and historical tables
    try {
      // First check if we already have newer data in the historical table
      const { data: latestHistory, error: historyError } = await supabase
        .from("two_ball_matchups")
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
        console.log("Saving matchups to historical table...");
        await supabase
          .from("two_ball_matchups")
          .insert(allMatchups);
      }
      
      // Update latest matchups table (always)
      if (allMatchups.length > 0) {
        // First clear existing data
        await supabase.from("latest_two_ball_matchups").delete().gte("id", 0);
        
        // Then insert new data
        const { error: insertError } = await supabase
          .from("latest_two_ball_matchups")
          .insert(allMatchups);
          
        if (insertError) {
          console.error("Error inserting matchups:", insertError);
        } else {
          console.log(`Successfully updated latest_two_ball_matchups with ${allMatchups.length} matchups`);
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
        console.log(`Filtered to ${filteredMatchups.length} matchups for event ${eventIdInt}`);
      }
    }
    
    // Filter by tour if provided
    if (tour) {
      const tourLower = tour.toLowerCase();
      filteredMatchups = filteredMatchups.filter(m => m.tour === tourLower);
      console.log(`Filtered to ${filteredMatchups.length} matchups for tour ${tourLower}`);
    }
    
    // Group matchups by event
    const matchupsByEvent = {};
    filteredMatchups.forEach(m => {
      const eventId = m.event_id || 'unknown';
      if (!matchupsByEvent[eventId]) {
        matchupsByEvent[eventId] = {
          event_id: m.event_id,
          event_name: m.event_name,
          tour: m.tour,
          matchups: []
        };
      }
      matchupsByEvent[eventId].matchups.push(m);
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
    return handleApiError(error)
  }
}
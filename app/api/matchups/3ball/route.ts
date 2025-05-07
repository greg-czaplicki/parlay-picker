import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET(request: Request) {
  // Parse query parameters
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  console.log(`API: Received request for 3-ball matchups with eventId=${eventId}`);
  
  // Skip caching for now - we'll always fetch fresh data
  console.log("Fetching fresh data from DataGolf API");

  try {
    // Fetch from DataGolf APIs directly
    console.log("Fetching 3-ball matchups from Data Golf APIs...");
    
    // Fetch both PGA and Opposite Field events in parallel
    const [pgaRes, oppRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_OPP_URL, { cache: 'no-store' })
    ]);
    
    if (!pgaRes.ok || !oppRes.ok) {
      throw new Error("Failed to fetch from DataGolf API");
    }
    
    // Parse the responses
    const pgaData = await pgaRes.json();
    const oppData = await oppRes.json();
    
    console.log(`PGA event: ${pgaData.event_name}, matchups: ${pgaData.match_list?.length || 0}`);
    console.log(`Opposite field event: ${oppData.event_name}, matchups: ${oppData.match_list?.length || 0}`);
    
    // Get tournaments to map event names to IDs
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name");
    
    // Create a map to look up event IDs
    const eventMapping = {};
    if (tournaments) {
      tournaments.forEach(t => {
        const nameLower = t.event_name.toLowerCase();
        eventMapping[nameLower] = t.event_id;
        
        // Add partial matches too
        if (nameLower.includes('truist')) eventMapping['truist'] = t.event_id;
        if (nameLower.includes('myrtle')) eventMapping['myrtle'] = t.event_id;
      });
    }
    
    // Process PGA matchups
    const pgaEventId = eventMapping['truist'] || 480; // Fallback to 480 if not found
    const pgaMatchups = (pgaData.match_list || []).map(m => ({
      event_id: pgaEventId,
      event_name: pgaData.event_name,
      round_num: pgaData.round_num,
      data_golf_update_time: new Date(pgaData.last_updated.replace(" UTC", "Z")).toISOString(),
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
      datagolf_p3_odds: m.odds?.datagolf?.p3 || null
    }));
    
    // Process Opposite Field matchups
    const oppEventId = eventMapping['myrtle'] || 553; // Fallback to 553 if not found
    const oppMatchups = (oppData.match_list || []).map(m => ({
      event_id: oppEventId,
      event_name: oppData.event_name,
      round_num: oppData.round_num,
      data_golf_update_time: new Date(oppData.last_updated.replace(" UTC", "Z")).toISOString(),
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
      datagolf_p3_odds: m.odds?.datagolf?.p3 || null
    }));
    
    // Combine all matchups
    const allMatchups = [...pgaMatchups, ...oppMatchups];
    
    console.log(`Processed ${allMatchups.length} total 3-ball matchups`);
    
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
        const pgaTime = new Date(pgaData.last_updated.replace(" UTC", "Z"));
        const oppTime = new Date(oppData.last_updated.replace(" UTC", "Z"));
        
        // Only save to history if we have newer data
        shouldSaveHistory = (pgaTime > historyTime) || (oppTime > historyTime);
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
    
    // Filter matchups if eventId is provided
    let filteredMatchups = allMatchups;
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        filteredMatchups = allMatchups.filter(m => Number(m.event_id) === eventIdInt);
        console.log(`Filtered to ${filteredMatchups.length} 3-ball matchups for event ${eventIdInt}`);
      }
    }
    
    // Group matchups by event
    const matchupsByEvent = {};
    filteredMatchups.forEach(m => {
      const eventId = m.event_id || 'unknown';
      if (!matchupsByEvent[eventId]) {
        matchupsByEvent[eventId] = {
          event_id: m.event_id,
          event_name: m.event_name,
          matchups: []
        };
      }
      matchupsByEvent[eventId].matchups.push(m);
    });
    
    return NextResponse.json({
      success: true,
      matchups: filteredMatchups,
      events: Object.values(matchupsByEvent)
    });
    
  } catch (error) {
    console.error("Error in GET /api/matchups/3ball:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

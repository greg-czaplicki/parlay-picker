import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL or Service Role Key missing in environment variables.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_EURO_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=euro&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_2BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_3BALL_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=euro&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Testing European Tour data fetching...");

  try {
    // Fetch European Tour schedule
    console.log("Fetching European Tour schedule...");
    const scheduleRes = await fetch(DATA_GOLF_EURO_SCHEDULE_URL, { cache: 'no-store' });
    
    if (!scheduleRes.ok) {
      throw new Error(`Failed to fetch Euro schedule: ${scheduleRes.status}`);
    }
    
    const scheduleData = await scheduleRes.json();
    
    // Fetch 2-ball and 3-ball matchups
    console.log("Fetching European Tour matchups...");
    const [twoBallRes, threeBallRes] = await Promise.all([
      fetch(DATA_GOLF_EURO_2BALL_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_EURO_3BALL_URL, { cache: 'no-store' })
    ]);
    
    let twoBallData = null;
    let threeBallData = null;
    
    try {
      if (twoBallRes.ok) {
        twoBallData = await twoBallRes.json();
      }
    } catch (error) {
      console.error("Error parsing Euro 2-ball data:", error);
    }
    
    try {
      if (threeBallRes.ok) {
        threeBallData = await threeBallRes.json();
      }
    } catch (error) {
      console.error("Error parsing Euro 3-ball data:", error);
    }
    
    // Get current tournaments from database
    const { data: tournaments } = await supabase
      .from("tournaments")
      .select("event_id, event_name, tour")
      .eq("tour", "euro");
    
    return NextResponse.json({
      success: true,
      schedule: {
        tour: scheduleData.tour,
        season: scheduleData.current_season,
        eventCount: scheduleData.schedule?.length || 0,
        events: scheduleData.schedule?.slice(0, 5) || [] // Just return the first 5 events for brevity
      },
      twoBall: {
        eventName: twoBallData?.event_name || null,
        roundNum: twoBallData?.round_num || null,
        lastUpdated: twoBallData?.last_updated || null,
        matchupCount: twoBallData?.match_list?.length || 0,
        sampleMatchups: twoBallData?.match_list?.slice(0, 3) || [] // Just return 3 sample matchups
      },
      threeBall: {
        eventName: threeBallData?.event_name || null,
        roundNum: threeBallData?.round_num || null,
        lastUpdated: threeBallData?.last_updated || null,
        matchupCount: threeBallData?.match_list?.length || 0,
        sampleMatchups: threeBallData?.match_list?.slice(0, 3) || [] // Just return 3 sample matchups
      },
      database: {
        euroTournamentsCount: tournaments?.length || 0,
        sampleTournaments: tournaments?.slice(0, 5) || [] // Just return 5 sample tournaments
      }
    });
    
  } catch (error) {
    console.error("Error in GET /api/debug/test-euro-tour:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  try {
    // Query matchups table directly
    let query = supabase.from("latest_two_ball_matchups").select("*");
    
    if (eventId) {
      // If event ID is provided, use it to filter
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        query = query.eq("event_id", eventIdInt);
      }
    }
    
    const { data: matchups, error } = await query;
    
    if (error) {
      console.error("Error querying matchups:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    // Count by event ID
    const eventCounts = {};
    (matchups || []).forEach(m => {
      const eventId = m.event_id || 'null';
      if (!eventCounts[eventId]) {
        eventCounts[eventId] = {
          event_id: m.event_id,
          event_name: m.event_name,
          count: 0
        };
      }
      eventCounts[eventId].count++;
    });
    
    return NextResponse.json({
      success: true,
      matchupCount: matchups?.length || 0,
      eventCounts: Object.values(eventCounts),
      sampleMatchups: (matchups || []).slice(0, 3).map(m => ({
        id: m.id,
        event_id: m.event_id,
        event_name: m.event_name,
        p1: m.p1_player_name,
        p2: m.p2_player_name
      }))
    });
  } catch (error) {
    console.error("Error in db-check:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
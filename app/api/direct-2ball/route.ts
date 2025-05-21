import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// This is a bare-minimum API endpoint with no frills - just gets the data

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  try {
    // Just get the data - no fancy stuff
    let query = supabase.from("latest_two_ball_matchups").select("*");
    
    // If there's an eventId, use it
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        query = query.eq("event_id", eventIdInt);
      }
    }
    
    const { data, error } = await query;
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      matchups: data || []
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
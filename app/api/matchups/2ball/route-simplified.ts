import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  // Parse query parameters
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  console.log(`API: Received request with eventId=${eventId}`);
  
  try {
    // Verify the database content at the start
    const verifyResult = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)")
      .group("event_id, event_name");
      
    if (!verifyResult.error) {
      console.log("API: Database content:", JSON.stringify(verifyResult.data));
    }
    
    // One simple query that always works with proper event_id filtering
    let query = supabase.from("latest_two_ball_matchups").select("*");
    
    // If an event ID is provided, use it to filter
    // IMPORTANT: Cast the event_id to integer for consistent comparison
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        console.log(`API: Filtering by event_id=${eventIdInt} (numeric)`);
        query = query.eq("event_id", eventIdInt);
      } else {
        console.warn(`API: Invalid eventId provided: ${eventId}`);
      }
    }
    
    // Execute the query
    const { data: matchups, error: matchupsError } = await query;
    
    // Log what was found
    console.log(`API: Query returned ${matchups?.length || 0} matchups`);
    if (matchups && matchups.length > 0) {
      const eventIds = [...new Set(matchups.map(m => m.event_id))];
      console.log(`API: Event IDs in results: ${eventIds.join(', ')}`);
    }
    
    if (matchupsError) {
      return handleApiError(matchupsError)
    }
    
    // Process matchups to ensure event_id is a number (not a string)
    const processedMatchups = (matchups || []).map(m => ({
      ...m,
      event_id: m.event_id != null ? Number(m.event_id) : null
    }));
    
    return NextResponse.json({
      success: true,
      matchups: processedMatchups 
    });
  } catch (error) {
    return handleApiError(error)
  }
}
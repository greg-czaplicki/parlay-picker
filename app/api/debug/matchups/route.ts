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
  const url = new URL(request.url);
  const eventId = url.searchParams.get('eventId');
  
  try {
    // Log the request parameters
    console.log(`Debug API: Received request with eventId=${eventId}`);
    
    // 1. Get counts by event for both 2-ball and 3-ball
    const { data: twoBallCounts, error: twoBallCountError } = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)")
      .group("event_id, event_name");
    
    const { data: threeBallCounts, error: threeBallCountError } = await supabase
      .from("latest_three_ball_matchups")
      .select("event_id, event_name, count(*)")
      .group("event_id, event_name");
    
    // 2. Get the active tournaments
    const { data: activeTournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("*")
      .gte("end_date", new Date().toISOString().split('T')[0])
      .order("start_date", { ascending: true });
    
    // 3. Fetch sample data for the requested event
    let twoBallSample = null;
    let threeBallSample = null;
    
    if (eventId) {
      // Test different ways of querying to see what works
      
      // 3.1 Direct event_id match (stringified)
      const { data: direct2Ball } = await supabase
        .from("latest_two_ball_matchups")
        .select("*")
        .eq("event_id", eventId)
        .limit(5);
      
      // 3.2 Direct event_id match (parsed as number)
      const { data: numeric2Ball } = await supabase
        .from("latest_two_ball_matchups")
        .select("*")
        .eq("event_id", parseInt(eventId, 10))
        .limit(5);
      
      // 3.3 If we have an active tournament matching the eventId, try by name
      let nameMatched2Ball = null;
      const matchingTournament = activeTournaments?.find(t => t.event_id.toString() === eventId);
      
      if (matchingTournament) {
        const { data: nameMatched } = await supabase
          .from("latest_two_ball_matchups")
          .select("*")
          .ilike("event_name", `%${matchingTournament.event_name}%`)
          .limit(5);
        
        nameMatched2Ball = nameMatched;
      }
      
      // Combined results
      twoBallSample = {
        directMatch: direct2Ball || [],
        numericMatch: numeric2Ball || [],
        nameMatch: nameMatched2Ball || []
      };
      
      // Same for 3-ball
      const { data: direct3Ball } = await supabase
        .from("latest_three_ball_matchups")
        .select("*")
        .eq("event_id", eventId)
        .limit(5);
      
      threeBallSample = direct3Ball || [];
    }
    
    // 4. Raw SQL query to check data types
    const { data: rawTypes } = await supabase.rpc('check_event_id_types');
    
    // Return all the debugging information
    return NextResponse.json({
      twoBallCounts,
      threeBallCounts,
      activeTournaments,
      twoBallSample,
      threeBallSample,
      rawTypes,
      request: {
        eventId,
        eventIdType: typeof eventId,
        parsedEventId: eventId ? parseInt(eventId, 10) : null
      }
    });
  } catch (error) {
    return handleApiError(error)
  }
}
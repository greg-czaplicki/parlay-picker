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
    // Check database content first
    const { data: countData, error: countError } = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)")
      .group("event_id, event_name");
    
    console.log("Count data:", countData);
    
    // Test direct API call
    const apiResponse = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || ''}/api/matchups/2ball${eventId ? `?eventId=${eventId}` : ''}`, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    let apiData;
    let apiResponseText;
    
    try {
      apiResponseText = await apiResponse.text();
      apiData = JSON.parse(apiResponseText);
    } catch (error) {
      console.error("Error parsing API response:", error);
    }
    
    // Now try direct Supabase query
    let directQuery = supabase.from("latest_two_ball_matchups").select("*");
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        directQuery = directQuery.eq("event_id", eventIdInt);
      }
    }
    
    const { data: directData, error: directError } = await directQuery;
    
    return NextResponse.json({
      dbCounts: countData,
      countError: countError?.message,
      apiStatus: apiResponse.status,
      apiOk: apiResponse.ok,
      apiResponseText: apiResponseText,
      apiData: apiData,
      directQueryResults: directData?.length,
      directError: directError?.message,
      directSample: directData?.slice(0, 3),
      requestInfo: {
        url: request.url,
        eventId,
        apiUrl: `${process.env.NEXT_PUBLIC_VERCEL_URL || ''}/api/matchups/2ball${eventId ? `?eventId=${eventId}` : ''}`
      }
    });
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
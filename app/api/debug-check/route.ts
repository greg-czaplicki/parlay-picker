import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const eventId = url.searchParams.get('eventId');
    const matchupType = url.searchParams.get('type') || '2ball';
    
    // Construct API URL
    const apiUrl = `/api/matchups/${matchupType}${eventId ? `?eventId=${eventId}` : ''}`;
    
    console.log(`Making request to: ${apiUrl}`);
    
    // Make the request to our own API
    const baseUrl = request.headers.get('host') ? 
      `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}` : 
      'http://localhost:3000';
    const fullUrl = `${baseUrl}${apiUrl}`;
    
    console.log(`Making full request to: ${fullUrl}`);
    
    const response = await fetch(fullUrl, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    const status = response.status;
    
    // Try to get response as text first in case JSON parsing fails
    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // If JSON parsing fails, just return the text
      return NextResponse.json({
        fetchSuccess: true,
        status,
        jsonParseError: true,
        responseText: text.substring(0, 1000) // Limit to first 1000 chars
      });
    }
    
    // Return detailed diagnostics
    return NextResponse.json({
      fetchSuccess: true,
      status,
      apiSuccess: data.success,
      matchupCount: data.matchups?.length || 0,
      eventsCount: data.events?.length || 0,
      eventIds: data.matchups ? [...new Set(data.matchups.map(m => m.event_id))] : [],
      eventIdTypes: data.matchups && data.matchups.length > 0 
        ? [...new Set(data.matchups.map(m => typeof m.event_id))] 
        : [],
      sample: data.matchups && data.matchups.length > 0 
        ? data.matchups.slice(0, 1).map(m => ({
            id: m.id,
            event_id: m.event_id,
            event_name: m.event_name
          }))
        : [],
      requestDetails: {
        eventId,
        matchupType,
        apiUrl
      }
    });
  } catch (error) {
    console.error("Error in debug-check:", error);
    return NextResponse.json({
      fetchSuccess: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
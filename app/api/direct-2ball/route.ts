import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'
import { validate } from '@/lib/validation'
import { eventIdParamSchema } from '@/lib/schemas'
import { jsonSuccess, jsonError } from '@/lib/api-response'

// This is a bare-minimum API endpoint with no frills - just gets the data

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase credentials");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  let eventId: string | undefined = undefined;
  try {
    const params = validate(eventIdParamSchema.extend({ eventId: eventIdParamSchema.shape.eventId.optional() }), {
      eventId: url.searchParams.get('eventId') ?? undefined,
    });
    eventId = params.eventId;
  } catch (error) {
    return handleApiError(error);
  }
  
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
      return jsonError(error.message, 'DB_ERROR');
    }
    
    return jsonSuccess({ matchups: data || [] });
  } catch (error) {
    return handleApiError(error)
  }
}
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'
import { validate } from '@/lib/validation'
import { eventIdParamSchema } from '@/lib/schemas'
import { jsonSuccess, jsonError } from '@/lib/api-response'

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const url = new URL(request.url);
  let params;
  try {
    params = validate(eventIdParamSchema, {
      eventId: url.searchParams.get('eventId'),
    });
  } catch (error) {
    return jsonError('Invalid or missing eventId', 'VALIDATION_ERROR');
  }
  const { eventId } = params;
  
  if (!eventId) {
    return jsonError('eventId is required', 'VALIDATION_ERROR');
  }
  
  try {
    // First get the event name from tournaments
    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("event_name")
      .eq("event_id", parseInt(eventId, 10))
      .single();
    
    if (tournamentError) {
      return NextResponse.json({ error: tournamentError.message }, { status: 500 });
    }
    
    const eventName = tournamentData?.event_name;
    
    // Test different filtering approaches
    
    // Approach 1: String comparison of event_id
    const { data: stringIdData, error: stringIdError } = await supabase
      .from("latest_two_ball_matchups")
      .select("id, event_id, event_name, p1_player_name, p2_player_name")
      .eq("event_id", eventId)
      .limit(50);
    
    // Approach 2: Numeric comparison of event_id
    const { data: numericIdData, error: numericIdError } = await supabase
      .from("latest_two_ball_matchups")
      .select("id, event_id, event_name, p1_player_name, p2_player_name")
      .eq("event_id", parseInt(eventId, 10))
      .limit(50);
    
    // Approach 3: Filter by event name
    const { data: nameData, error: nameError } = await supabase
      .from("latest_two_ball_matchups")
      .select("id, event_id, event_name, p1_player_name, p2_player_name")
      .eq("event_name", eventName)
      .limit(50);
    
    // Approach 4: Filter by event name pattern (ilike)
    const { data: patternData, error: patternError } = await supabase
      .from("latest_two_ball_matchups")
      .select("id, event_id, event_name, p1_player_name, p2_player_name")
      .ilike("event_name", `%${eventName}%`)
      .limit(50);
    
    // Approach 5: Raw SQL with cast
    const { data: sqlCastData, error: sqlCastError } = await supabase
      .rpc('filter_matchups_by_event_id', { event_id_param: parseInt(eventId, 10) });
    
    return jsonSuccess({
      tournament: {
        event_id: eventId,
        event_name: eventName
      },
      results: {
        stringComparison: {
          count: stringIdData?.length || 0,
          error: stringIdError?.message || null,
          sample: stringIdData?.slice(0, 3) || []
        },
        numericComparison: {
          count: numericIdData?.length || 0,
          error: numericIdError?.message || null,
          sample: numericIdData?.slice(0, 3) || []
        },
        nameMatch: {
          count: nameData?.length || 0,
          error: nameError?.message || null,
          sample: nameData?.slice(0, 3) || []
        },
        patternMatch: {
          count: patternData?.length || 0,
          error: patternError?.message || null,
          sample: patternData?.slice(0, 3) || []
        },
        sqlCast: {
          count: sqlCastData?.length || 0,
          error: sqlCastError?.message || null,
          sample: sqlCastData?.slice(0, 3) || []
        }
      }
    });
    
  } catch (error) {
    return handleApiError(error)
  }
}
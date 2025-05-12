import 'next-logger'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

const querySchema = z.object({ eventId: z.string().min(1) });

export async function GET(request: Request) {
  logger.info('Received debug/compare-filters request', { url: request.url });
  try {
    const { eventId } = getQueryParams(request, querySchema);
    if (!eventId) {
      logger.warn('eventId is required');
      return handleApiError('eventId is required');
    }
    const supabase = createSupabaseClient()
    // First get the event name from tournaments
    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments")
      .select("event_name")
      .eq("event_id", parseInt(eventId, 10))
      .single();
    if (tournamentError) {
      return handleApiError(tournamentError.message);
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
    logger.info('Returning debug/compare-filters response', { eventId });
    return jsonSuccess({
      stringIdData,
      numericIdData,
      nameData,
      patternData,
      sqlCastData,
      eventId,
      eventName
    });
  } catch (error) {
    logger.error('Error in compare-filters endpoint:', error);
    return handleApiError(error);
  }
}
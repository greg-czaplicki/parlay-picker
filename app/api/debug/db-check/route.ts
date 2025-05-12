import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

const eventIdSchema = z.object({ eventId: z.string().optional() })

export async function GET(request: Request) {
  logger.info('Received debug/db-check request', { url: request.url });
  let eventId: string | undefined = undefined;
  try {
    const params = getQueryParams(request, eventIdSchema)
    eventId = params.eventId
  } catch (error) {
    logger.warn('Invalid query parameters', { error });
    return handleApiError(error);
  }
  
  try {
    const supabase = createSupabaseClient()
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
      logger.error("Error querying matchups:", error);
      return handleApiError(error);
    }
    // Count by event ID
    const eventCounts: Record<string, { event_id: number | null, event_name: string, count: number }> = {};
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
    logger.info('Returning debug/db-check response', { eventId });
    return jsonSuccess({
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
    logger.error('Error in debug/db-check endpoint', { error });
    return handleApiError(error)
  }
}
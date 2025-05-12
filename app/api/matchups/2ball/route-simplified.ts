import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

const eventIdSchema = z.object({ eventId: z.string().optional() })

export async function GET(request: Request) {
  // Parse query parameters
  let eventId: string | undefined = undefined;
  try {
    const params = getQueryParams(request, eventIdSchema)
    eventId = params.eventId
  } catch (error) {
    return handleApiError(error);
  }
  logger.info(`API: Received request with eventId=${eventId}`);
  try {
    const supabase = createSupabaseClient()
    // Verify the database content at the start
    const verifyResult = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)");
    if (!verifyResult.error) {
      logger.info("API: Database content:", JSON.stringify(verifyResult.data));
    }
    // One simple query that always works with proper event_id filtering
    let query = supabase.from("latest_two_ball_matchups").select("*");
    // If an event ID is provided, use it to filter
    // IMPORTANT: Cast the event_id to integer for consistent comparison
    if (eventId) {
      const eventIdInt = parseInt(eventId, 10);
      if (!isNaN(eventIdInt)) {
        logger.info(`API: Filtering by event_id=${eventIdInt} (numeric)`);
        query = query.eq("event_id", eventIdInt);
      } else {
        logger.warn(`API: Invalid eventId provided: ${eventId}`);
      }
    }
    // Execute the query
    const { data: matchups, error: matchupsError } = await query;
    // Log what was found
    logger.info(`API: Query returned ${matchups?.length || 0} matchups`);
    if (matchups && matchups.length > 0) {
      const eventIds = [...new Set(matchups.map(m => m.event_id))];
      logger.info(`API: Event IDs in results: ${eventIds.join(', ')}`);
    }
    if (matchupsError) {
      return handleApiError(matchupsError);
    }
    // Process matchups to ensure event_id is a number (not a string)
    const processedMatchups = (matchups || []).map(m => ({
      ...m,
      event_id: m.event_id != null ? Number(m.event_id) : null
    }));
    return jsonSuccess({ matchups: processedMatchups });
  } catch (error) {
    return handleApiError(error)
  }
}
import 'next-logger'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils'

// This is a bare-minimum API endpoint with no frills - just gets the data

const eventIdSchema = z.object({ eventId: z.string().optional() })

export async function GET(request: Request) {
  logger.info('Received direct-2ball request', { url: request.url });
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
    logger.info('Returning direct-2ball response', { eventId });
    return jsonSuccess({ matchups: data || [] });
  } catch (error) {
    logger.error('Error in direct-2ball endpoint', { error });
    return handleApiError(error)
  }
}
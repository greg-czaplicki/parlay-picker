import 'next-logger'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

const eventIdSchema = z.object({ eventId: z.string().optional() })

export async function GET(request: Request) {
  logger.info('Received debug/matchups/2ball request', { url: request.url });
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
    // Check database content first
    const { data: countData, error: countError } = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)");

    logger.info("Count data:", countData);

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
      logger.error("Error parsing API response:", error);
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

    logger.info('Returning debug/matchups/2ball response', { eventId });
    return jsonSuccess({
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
    logger.error('Error in debug/matchups/2ball endpoint', { error });
    return handleApiError(error)
  }
}
import 'next-logger'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess } from '@/lib/api-utils'

const querySchema = z.object({ table: z.string().min(1), event: z.string().optional() });

export async function GET(request: Request) {
  logger.info('Received debug/db request', { url: request.url });
  let params;
  try {
    params = getQueryParams(request, querySchema)
  } catch (error) {
    logger.warn('Invalid query parameters', { error });
    return handleApiError('Invalid query parameters');
  }
  const { table, event } = params;
  if (!table) {
    logger.warn('Missing or invalid table parameter');
    return handleApiError('Missing or invalid table parameter');
  }
  try {
    const supabase = createSupabaseClient()
    // First, get a count by event_id
    const { data: countData, error: countError } = await supabase
      .from(table)
      .select('event_id, event_name');
    if (countError) {
      logger.error('DB error on count', { countError });
      return handleApiError(countError.message);
    }
    // Now get details if event parameter is provided
    let detailData = null;
    let detailError = null;
    if (event && typeof event === 'string') {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('event_id', event)
        .limit(10);
      detailData = data;
      detailError = error;
    }
    logger.info('Returning debug/db response', { counts: countData?.length, details: detailData?.length });
    return jsonSuccess({
      counts: countData,
      details: detailData,
      detailError: detailError ? detailError.message : null
    });
  } catch (error) {
    logger.error('Error in debug/db endpoint:', error);
    return handleApiError(error);
  }
}
import 'next-logger'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { createSupabaseClient, getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils'

const tableEventSchema = z.object({ table: z.string().optional(), event: z.string().optional() })

export async function GET(request: Request) {
  logger.info('Received debug/db request', { url: request.url });
  let params;
  try {
    params = getQueryParams(request, tableEventSchema)
  } catch (error) {
    logger.warn('Invalid query parameters', { error });
    return jsonError('Invalid query parameters', 'VALIDATION_ERROR');
  }
  const { table, event } = params;
  if (!table || typeof table !== 'string') {
    logger.warn('Missing or invalid table parameter', { table });
    return jsonError('Missing or invalid table parameter', 'VALIDATION_ERROR');
  }
  try {
    const supabase = createSupabaseClient()
    // First, get a count by event_id
    const { data: countData, error: countError } = await supabase
      .from(table)
      .select('event_id, event_name');
    if (countError) {
      logger.error('DB error on count', { countError });
      return jsonError(countError.message, 'DB_ERROR');
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
    logger.error('Error in debug endpoint', { error });
    return jsonError(error instanceof Error ? error.message : 'Unknown error', 'INTERNAL_ERROR');
  }
}
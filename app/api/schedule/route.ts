import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("tournaments_v2")
      .select("event_id, event_name, course, start_date, end_date")
      .order("start_date", { ascending: true });
    if (error) {
      logger.error("Error fetching tournaments:", error);
      return handleApiError(error);
    }
    return jsonSuccess({ tournaments: data });
  } catch (error) {
    logger.error("Error in schedule endpoint:", error);
    return handleApiError(error);
  }
}
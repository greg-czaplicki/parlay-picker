import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("dg_id, name, start_date, end_date, status, tour")
      .order("start_date", { ascending: true });
    if (error) {
      logger.error("Error fetching tournaments:", error);
      return handleApiError(error);
    }
    
    // Map to expected format for compatibility
    const formattedData = data?.map(tournament => ({
      event_id: tournament.dg_id,
      event_name: tournament.name,
      course: 'TBD', // Will need course data from courses table
      start_date: tournament.start_date,
      end_date: tournament.end_date,
      status: tournament.status,
      tour: tournament.tour
    }));
    
    return jsonSuccess({ tournaments: formattedData });
  } catch (error) {
    logger.error("Error in schedule endpoint:", error);
    return handleApiError(error);
  }
}
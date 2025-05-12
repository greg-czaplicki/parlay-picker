import 'next-logger'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export async function GET(request: Request) {
  logger.info('Received debug/check-tables request', { url: request.url });
  try {
    const supabase = createSupabaseClient();
    // Check tables existence and row counts
    const tables = [
      "tournaments",
      "latest_two_ball_matchups",
      "latest_three_ball_matchups",
      "two_ball_matchups",
      "three_ball_matchups"
    ];
    const results: Record<string, any> = {};
    for (const table of tables) {
      try {
        // Check table exists
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (error) {
          results[table] = { exists: false, error: error.message };
        } else {
          results[table] = { exists: true, rowCount: count };
          // If we have rows, get event distribution
          if (typeof count === 'number' && count > 0 && (table.includes('two_ball') || table.includes('three_ball'))) {
            const { data: eventCounts, error: eventError } = await supabase
              .from(table)
              .select('event_id, event_name')
              .limit(500);
            if (!eventError && eventCounts) {
              // Count by event
              const countsByEvent: Record<string, number> = {};
              eventCounts.forEach((row: any) => {
                const key = `${row.event_id || 'null'}-${row.event_name || 'unknown'}`;
                countsByEvent[key] = (countsByEvent[key] || 0) + 1;
              });
              results[table].eventCounts = Object.entries(countsByEvent).map(([key, count]) => {
                const [eventId, eventName] = key.split('-');
                return {
                  event_id: eventId === 'null' ? null : eventId,
                  event_name: eventName === 'unknown' ? null : eventName,
                  count
                };
              });
            }
          }
        }
      } catch (tableError: any) {
        results[table] = { exists: false, error: tableError?.message };
      }
    }
    logger.info('Returning debug/check-tables response');
    return jsonSuccess({
      tables: results
    });
  } catch (error) {
    logger.error('Error in debug/check-tables endpoint', { error });
    return handleApiError(error)
  }
}
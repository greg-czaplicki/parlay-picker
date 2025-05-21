import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Check tables existence and row counts
    const tables = [
      "tournaments",
      "latest_two_ball_matchups",
      "latest_three_ball_matchups",
      "two_ball_matchups",
      "three_ball_matchups"
    ];
    
    const results = {};
    
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
          if (count > 0 && (table.includes('two_ball') || table.includes('three_ball'))) {
            const { data: eventCounts, error: eventError } = await supabase
              .from(table)
              .select('event_id, event_name')
              .limit(500);
              
            if (!eventError && eventCounts) {
              // Count by event
              const countsByEvent = {};
              eventCounts.forEach(row => {
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
      } catch (tableError) {
        results[table] = { exists: false, error: tableError.message };
      }
    }
    
    return NextResponse.json({
      success: true,
      tables: results
    });
  } catch (error) {
    console.error("Error checking tables:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
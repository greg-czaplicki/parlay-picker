import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response
interface LivePlayerData {
  dg_id: number;
  player_name: string;
  accuracy?: number | null; // Make optional as stats might vary
  distance?: number | null;
  gir?: number | null;
  position?: string | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  // sg_arg?: number | null; // Add if available
  // sg_total?: number | null; // Add if available
  thru?: number | null;
  today?: number | null;
  total?: number | null;
}

interface DataGolfLiveStatsResponse {
  course_name: string;
  event_name: string;
  last_updated: string; // e.g., "2021-05-24 16:15:26 UTC"
  stat_display: string;
  stat_round: string; // e.g., "event_avg"
  live_stats: LivePlayerData[];
}

// Define the structure for Supabase insert (matching historical table)
interface SupabaseLiveStat {
  dg_id: number;
  player_name: string;
  event_name: string;
  course_name: string;
  round_num: string;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  "position"?: string | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  data_golf_updated_at: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL or Service Role Key is missing in environment variables.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// Construct URL (using event_avg for now, stats=all)
// Consider making tour/stats/round dynamic via query params later if needed
const DATA_GOLF_LIVE_URL = `https://feeds.datagolf.com/preds/live-tournament-stats?tour=pga&stats=all&round=event_avg&display=value&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Fetching live tournament stats (event_avg) from Data Golf...");

  try {
    // Using cache: 'no-store' for manual sync
    const response = await fetch(DATA_GOLF_LIVE_URL, { cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch live stats from Data Golf:", response.status, errorText);
      throw new Error(
        `Failed to fetch live stats: ${response.status} ${errorText}`,
      );
    }

    const data: DataGolfLiveStatsResponse = await response.json();
    const sourceUpdateTime = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
    console.log(`Successfully fetched live stats for ${data.event_name}, round ${data.stat_round}. Source updated: ${sourceUpdateTime}`);

    const statsToInsert: SupabaseLiveStat[] = data.live_stats.map((player) => ({
        dg_id: player.dg_id,
        player_name: player.player_name,
        event_name: data.event_name,
        course_name: data.course_name,
        round_num: data.stat_round,
        sg_app: player.sg_app,
        sg_ott: player.sg_ott,
        sg_putt: player.sg_putt,
        // Include other stats, using nullish coalescing for safety
        accuracy: player.accuracy ?? null,
        distance: player.distance ?? null,
        gir: player.gir ?? null,
        prox_fw: player.prox_fw ?? null,
        scrambling: player.scrambling ?? null,
        "position": player.position ?? null,
        thru: player.thru ?? null,
        today: player.today ?? null,
        total: player.total ?? null,
        data_golf_updated_at: sourceUpdateTime,
    }));

    console.log(`Processed ${statsToInsert.length} player live stat records for insertion.`);

    if (statsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("live_tournament_stats") // Insert into historical table
        .insert(statsToInsert);

      if (insertError) {
        console.error("Error inserting live stats into Supabase:", insertError);
        // Decide if this error should stop the process or just be logged
        throw new Error(`Supabase live stats insert failed: ${insertError.message}`);
      }
        console.log(`Successfully inserted ${statsToInsert.length} live stat records into Supabase.`);
    } else {
        console.log("No live stats found in the fetched data to insert.")
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${statsToInsert.length} live stat records for ${data.event_name} (${data.stat_round}).`,
      processedCount: statsToInsert.length,
      sourceTimestamp: sourceUpdateTime,
      eventName: data.event_name,
      round: data.stat_round,
    });

  } catch (error) {
    console.error("Error in GET /api/live-stats/sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

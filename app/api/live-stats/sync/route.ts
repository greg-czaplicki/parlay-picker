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
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  round?: number | null; // Score relative to par for the current round
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
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  "position"?: string | null;
  thru?: number | null;
  today?: number | null; // This column will store the player's round score
  total?: number | null;
  data_golf_updated_at: string;
}

// Add interfaces for Field Update Response
interface FieldPlayer {
  dg_id: number;
}
interface DataGolfFieldResponse {
  event_name: string;
  current_round: number | null;
  field: FieldPlayer[];
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

const DATA_GOLF_FIELD_URL = `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${dataGolfApiKey}`;
const requiredStats = "sg_app,sg_ott,sg_putt,sg_arg,sg_t2g,sg_total,accuracy,distance,gir,prox_fw,scrambling,position,thru,today,total";
const LIVE_STATS_BASE_URL = `https://feeds.datagolf.com/preds/live-tournament-stats?tour=pga&stats=sg_app,sg_ott,sg_putt,sg_arg,sg_t2g,sg_total,accuracy,distance,gir,prox_fw,scrambling,position,thru,today,total&display=value&file_format=json&key=${dataGolfApiKey}`;

// Rounds we want to fetch data for
const ROUNDS_TO_FETCH = ["1", "2", "3", "4", "event_avg"];

export async function GET() {
  console.log("Starting multi-round live stats sync...");
  let totalInsertedCount = 0;
  let lastSourceTimestamp: string | null = null;
  let fetchedEventName: string | null = null;
  const errors: string[] = [];

  try {
    for (const round of ROUNDS_TO_FETCH) {
        const liveStatsUrl = `${LIVE_STATS_BASE_URL}&round=${round}`;
        console.log(`Fetching live stats for round: ${round} from URL: ${liveStatsUrl}`);

        try {
            const response = await fetch(liveStatsUrl, { cache: 'no-store' });
            console.log(`Data Golf Response Status for round ${round}: ${response.status}`);

            if (!response.ok) {
              // If a specific round isn't available yet (e.g., R3/R4 early), it might 404 - treat as warning, not error
              if (response.status === 404) {
                 console.warn(`Round ${round} data not found (404), skipping.`);
                 continue; // Skip to the next round
              }
              const errorText = await response.text();
              console.error(`Failed to fetch live stats for round ${round}:`, errorText);
              errors.push(`Fetch failed for round ${round}: ${response.status}`);
              continue; // Skip to next round on other errors
            }

            const data: DataGolfLiveStatsResponse = await response.json();
            // Use the timestamp from THIS specific round's data
            const currentRoundTimestamp = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
            lastSourceTimestamp = currentRoundTimestamp; // Keep track of the latest one processed
            fetchedEventName = data.event_name;
            console.log(`Received data for ${data.event_name}, round ${data.stat_round}. Processing ${data.live_stats?.length ?? 0} records...`);

            if (!data.live_stats || data.live_stats.length === 0) {
                console.log(`No player data in live_stats array for round ${round}.`);
                continue;
            }

            const statsToInsert: SupabaseLiveStat[] = data.live_stats.map((player) => ({
                dg_id: player.dg_id,
                player_name: player.player_name,
                event_name: data.event_name,
                course_name: data.course_name,
                round_num: data.stat_round, // Use actual round from response
                sg_app: player.sg_app,
                sg_ott: player.sg_ott,
                sg_putt: player.sg_putt,
                sg_arg: player.sg_arg ?? null,
                sg_t2g: player.sg_t2g ?? null,
                sg_total: player.sg_total ?? null,
                accuracy: player.accuracy ?? null,
                distance: player.distance ?? null,
                gir: player.gir ?? null,
                prox_fw: player.prox_fw ?? null,
                scrambling: player.scrambling ?? null,
                "position": player.position ?? null,
                thru: player.thru ?? null,
                today: player.round ?? null,
                total: player.total ?? null,
                data_golf_updated_at: currentRoundTimestamp,
            }));

            if (statsToInsert.length > 0) {
                console.log(`Attempting to insert ${statsToInsert.length} records for round ${round} into live_tournament_stats...`);
                const { error: insertError } = await supabase
                    .from("live_tournament_stats")
                    .insert(statsToInsert);

                if (insertError) {
                    console.error(`SUPABASE INSERT ERROR for round ${round}:`, insertError);
                    errors.push(`Insert failed for round ${round}: ${insertError.message}`);
                    // Decide whether to continue or stop on insert error
                } else {
                    console.log(`Successfully inserted ${statsToInsert.length} records for round ${round}.`);
                    totalInsertedCount += statsToInsert.length;
                }
            }
        } catch (fetchError: any) {
            console.error(`Error processing round ${round}:`, fetchError);
            errors.push(`Processing failed for round ${round}: ${fetchError.message}`);
        }
    }

    // Final Response
    const finalMessage = `Sync complete. Total records inserted/updated: ${totalInsertedCount} across attempted rounds for ${fetchedEventName ?? 'event'}.`;
    console.log(finalMessage);
    if (errors.length > 0) {
        console.warn("Sync completed with errors:", errors);
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''),
      processedCount: totalInsertedCount,
      sourceTimestamp: lastSourceTimestamp, // Timestamp of the last successfully fetched round
      eventName: fetchedEventName,
      errors: errors,
    });

  } catch (error) {
    // Catch unexpected errors outside the loop
    console.error("Unexpected error during multi-round sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during sync process",
      },
      { status: 500 },
    );
  }
}

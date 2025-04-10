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
const LIVE_STATS_BASE_URL = `https://feeds.datagolf.com/preds/live-tournament-stats?tour=pga&stats=${requiredStats}&display=value&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  let roundToFetch = "event_avg"; // Default
  let currentEventName = "Unknown Event";

  try {
    // 1. Fetch Field update to determine current round
    console.log("Fetching field update to determine current round...");
    const fieldResponse = await fetch(DATA_GOLF_FIELD_URL, { cache: 'no-store' });
    if (!fieldResponse.ok) {
        console.warn(`Failed to fetch field update (status: ${fieldResponse.status}), defaulting to round=event_avg.`);
        // Continue with default round
    } else {
        const fieldData: DataGolfFieldResponse = await fieldResponse.json();
        currentEventName = fieldData.event_name;
        if (fieldData.current_round && [1, 2, 3, 4].includes(fieldData.current_round)) {
            roundToFetch = fieldData.current_round.toString();
            console.log(`Current round determined as: ${roundToFetch} for ${currentEventName}`);
        } else {
            console.log(`No active round found (current_round: ${fieldData.current_round}), defaulting to event_avg for ${currentEventName}.`);
        }
    }

    // 2. Fetch Live Stats for the determined round
    const liveStatsUrl = `${LIVE_STATS_BASE_URL}&round=${roundToFetch}`;
    console.log(`Fetching live stats from URL: ${liveStatsUrl}`);
    const response = await fetch(liveStatsUrl, { cache: 'no-store' });
    console.log(`Data Golf Live Stats Response Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch live stats from Data Golf:", errorText);
      throw new Error(`Failed to fetch live stats (${roundToFetch}): ${response.status} ${errorText}`);
    }

    const data: DataGolfLiveStatsResponse = await response.json();
    console.log(`Received live stats data for ${data.event_name}, round ${data.stat_round}. Sample:`, data.live_stats?.slice(0, 2));

    // Validate if the fetched round matches the requested one (or event_avg if that was requested)
    if (data.stat_round !== roundToFetch) {
        console.warn(`Requested round '${roundToFetch}' but received data for '${data.stat_round}'. Proceeding with received data.`);
        // Update roundToFetch to match what was actually returned, ensuring consistency
        roundToFetch = data.stat_round;
    }

    if (!data.live_stats || data.live_stats.length === 0) {
        console.log("Data Golf API returned empty live_stats array.");
        // Return success but indicate no data was processed
        return NextResponse.json({
          success: true,
          message: `No live stats data available from Data Golf for ${data.event_name} (${data.stat_round}).`,
          processedCount: 0,
          sourceTimestamp: new Date(data.last_updated.replace(" UTC", "Z")).toISOString(),
          eventName: data.event_name,
          round: data.stat_round,
        });
    }

    const sourceUpdateTime = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
    console.log(`Processing ${data.live_stats.length} records for round ${roundToFetch}...`);

    // 3. Map data using the actual fetched round number
    console.log("Mapping received player data...");
    const statsToInsert: SupabaseLiveStat[] = data.live_stats.map((player, index) => {
        // Log the 'round' field for the first few players
        if (index < 3) {
            console.log(`Player ${player.player_name} - Raw round value: ${player.round}`);
        }
        return {
            dg_id: player.dg_id,
            player_name: player.player_name,
            event_name: data.event_name,
            course_name: data.course_name,
            round_num: data.stat_round,
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
            today: player.round ?? null, // Map player.round to Supabase.today
            total: player.total ?? null,
            data_golf_updated_at: sourceUpdateTime,
        };
    });

    // 4. Insert into historical table
    if (statsToInsert.length > 0) {
        console.log("Sample record to insert:", JSON.stringify(statsToInsert[0], null, 2));
        console.log("Attempting to insert records into live_tournament_stats...");
        const { error: insertError } = await supabase
            .from("live_tournament_stats")
            .insert(statsToInsert);

        if (insertError) {
            console.error("SUPABASE INSERT ERROR:", insertError);
            throw new Error(`Supabase live stats insert failed: ${insertError.message}`);
        } else {
            console.log(`Successfully inserted ${statsToInsert.length} live stat records.`);
        }
    } else {
        console.log("No mapped live stats to insert.")
    }

    return NextResponse.json({
      success: true,
      message: `Successfully recorded ${statsToInsert.length} live stat records for ${data.event_name} (Round: ${data.stat_round}).`,
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

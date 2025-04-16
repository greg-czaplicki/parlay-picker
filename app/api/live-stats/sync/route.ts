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
  position?: string | null;
  thru?: number | null;
  today?: number | null; // This column will store the player's round score
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

const LIVE_STATS_BASE_URL = `https://feeds.datagolf.com/preds/live-tournament-stats?tour=pga&stats=sg_app,sg_ott,sg_putt,sg_arg,sg_t2g,sg_total,accuracy,distance,gir,prox_fw,scrambling,position,thru,today,total&display=value&file_format=json&key=${dataGolfApiKey}`;

// Rounds we want to fetch data for
const ROUNDS_TO_FETCH = ["1", "2", "3", "4", "event_avg"];

// Helper to fetch live stats for a round
async function fetchLiveStats(round: string): Promise<DataGolfLiveStatsResponse | null> {
  const url = `${LIVE_STATS_BASE_URL}&round=${round}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Round ${round} data not found (404), skipping.`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Fetch failed for round ${round}: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (err) {
    throw new Error(`Error fetching round ${round}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Helper to map DataGolf player data to Supabase insert format
function mapStatsToInsert(data: DataGolfLiveStatsResponse, timestamp: string): SupabaseLiveStat[] {
  return (data.live_stats || []).map((player) => ({
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
    position: player.position ?? null,
    thru: player.thru ?? null,
    today: player.round ?? null,
    total: player.total ?? null,
    data_golf_updated_at: timestamp,
  }));
}

// Helper to upsert stats into Supabase
async function upsertStats(stats: SupabaseLiveStat[], round: string): Promise<string | null> {
  if (!stats.length) return null;
  // Upsert on (dg_id, round_num, event_name)
  const { error } = await supabase
    .from("live_tournament_stats")
    .upsert(stats, { onConflict: "dg_id,round_num,event_name" });
  if (error) {
    return `Upsert failed for round ${round}: ${error.message}`;
  }
  return null;
}

export async function GET() {
  console.log("Starting multi-round live stats sync...");
  let totalInsertedCount = 0;
  let lastSourceTimestamp: string | null = null;
  let fetchedEventName: string | null = null;
  const errors: string[] = [];

  for (const round of ROUNDS_TO_FETCH) {
    try {
      const data = await fetchLiveStats(round);
      if (!data) continue;
      const currentRoundTimestamp = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
      lastSourceTimestamp = currentRoundTimestamp;
      fetchedEventName = data.event_name;
      const statsToInsert = mapStatsToInsert(data, currentRoundTimestamp);
      const upsertError = await upsertStats(statsToInsert, round);
      if (upsertError) {
        errors.push(upsertError);
      } else {
        totalInsertedCount += statsToInsert.length;
      }
    } catch (err: any) {
      errors.push(err.message || String(err));
    }
  }

  const finalMessage = `Sync complete. Total records inserted/updated: ${totalInsertedCount} across attempted rounds for ${fetchedEventName ?? 'event'}.`;
  if (errors.length > 0) {
    console.warn("Sync completed with errors:", errors);
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''),
    processedCount: totalInsertedCount,
    sourceTimestamp: lastSourceTimestamp,
    eventName: fetchedEventName,
    errors,
  });
}

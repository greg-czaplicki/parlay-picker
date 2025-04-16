import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// --- Interfaces ---
interface PlayerSkillData {
  player_name: string;
  dg_id: number;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  driving_acc: number | null;
  driving_dist: number | null;
}

interface DataGolfSkillResponse {
  last_updated: string;
  players: PlayerSkillData[];
}

interface SupabasePlayerSkill {
  dg_id: number;
  player_name: string;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  driving_acc: number | null;
  driving_dist: number | null;
  data_golf_updated_at: string;
}

interface FieldPlayer {
  dg_id: number;
}

interface DataGolfFieldResponse {
  event_name: string;
  field: FieldPlayer[];
}

// --- Supabase & API Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

const DATA_GOLF_SKILL_URL = `https://feeds.datagolf.com/preds/skill-ratings?display=value&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_FIELD_URL = `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Fetching player skill ratings and field data from Data Golf...");
  try {
    const [fieldRes, skillRes] = await Promise.all([
      fetch(DATA_GOLF_FIELD_URL, { cache: 'no-store' }),
      fetch(DATA_GOLF_SKILL_URL, { cache: 'no-store' })
    ]);

    if (!fieldRes.ok) {
      const errorText = await fieldRes.text();
      throw new Error(`Failed to fetch field data: ${fieldRes.status} ${errorText}`);
    }
    if (!skillRes.ok) {
      const errorText = await skillRes.text();
      throw new Error(`Failed to fetch skill data: ${skillRes.status} ${errorText}`);
    }

    const fieldData: DataGolfFieldResponse = await fieldRes.json();
    const skillData: DataGolfSkillResponse = await skillRes.json();
    const sourceUpdateTime = new Date(skillData.last_updated.replace(" UTC", "Z")).toISOString();
    const fieldPlayerIds = new Set(fieldData.field.map(p => p.dg_id));

    const allPlayersSkill: SupabasePlayerSkill[] = skillData.players.map(player => ({
      dg_id: player.dg_id,
      player_name: player.player_name,
      sg_putt: player.sg_putt,
      sg_arg: player.sg_arg,
      sg_app: player.sg_app,
      sg_ott: player.sg_ott,
      sg_total: player.sg_total,
      driving_acc: player.driving_acc,
      driving_dist: player.driving_dist,
      data_golf_updated_at: sourceUpdateTime,
    }));
    const playersToUpsert = allPlayersSkill.filter(player => fieldPlayerIds.has(player.dg_id));

    let processedCount = 0;
    if (playersToUpsert.length > 0) {
      const { error: deleteError } = await supabase.from("player_skill_ratings").delete().neq('dg_id', 0);
      if (deleteError) {
        console.error("Error clearing player_skill_ratings table:", deleteError);
      }
      const { error: upsertError } = await supabase
        .from("player_skill_ratings")
        .upsert(playersToUpsert, { onConflict: 'dg_id', ignoreDuplicates: false });
      if (upsertError) {
        throw new Error(`Supabase latest upsert failed: ${upsertError.message}`);
      }
      const { error: insertHistError } = await supabase
        .from("historical_player_skill_ratings")
        .insert(playersToUpsert);
      if (insertHistError) {
        console.error("Error inserting historical player skill ratings:", insertHistError);
      }
      processedCount = playersToUpsert.length;
    }
    return NextResponse.json({
      success: true,
      message: `Synced skill ratings for ${playersToUpsert.length} players in the current field (${fieldData.event_name}).`,
      processedCount,
      sourceTimestamp: sourceUpdateTime,
      eventName: fieldData.event_name,
    });
  } catch (error) {
    console.error("Error in GET /api/players/sync-skill-ratings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

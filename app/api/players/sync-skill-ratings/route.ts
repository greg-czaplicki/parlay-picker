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

export async function GET() {
  console.log("Fetching player skill ratings and field data from Data Golf...");
  let sourceTimestamp: string | null = null;
  try {
    // Fetch main event field (PGA)
    const pgaFieldRes = await fetch(`https://feeds.datagolf.com/field-updates?tour=pga&key=${dataGolfApiKey}`, { cache: 'no-store' });
    if (!pgaFieldRes.ok) throw new Error('Failed to fetch PGA field');
    const pgaFieldData: DataGolfFieldResponse = await pgaFieldRes.json();

    // Fetch opposite field event (OPP)
    const oppFieldRes = await fetch(`https://feeds.datagolf.com/field-updates?tour=opp&key=${dataGolfApiKey}`, { cache: 'no-store' });
    let oppFieldData: DataGolfFieldResponse | null = null;
    if (oppFieldRes.ok) {
      oppFieldData = await oppFieldRes.json();
    }

    // Fetch skill ratings (for main event only)
    const skillRes = await fetch(DATA_GOLF_SKILL_URL, { cache: 'no-store' });
    if (!skillRes.ok) throw new Error('Failed to fetch skill data');
    const skillData: DataGolfSkillResponse = await skillRes.json();
    sourceTimestamp = new Date(skillData.last_updated.replace(" UTC", "Z")).toISOString();

    // Helper to upsert a field into player_field
    async function upsertField(fieldData: DataGolfFieldResponse) {
      // Find event_id in tournaments table
      const { data: eventRows } = await supabase
        .from("tournaments_v2")
        .select("event_id")
        .eq("event_name", fieldData.event_name)
        .limit(1);
      if (!eventRows || eventRows.length === 0) return;
      const event_id = eventRows[0].event_id;
      const fieldRows = (fieldData.field || []).map((p) => ({
        event_id,
        event_name: fieldData.event_name,
        dg_id: p.dg_id,
        player_name: p.player_name, // Always use player_name from field API
      }));
      if (fieldRows.length > 0) {
        await supabase.from("player_field").delete().eq("event_id", event_id);
        const { error: fieldUpsertError } = await supabase
          .from("player_field")
          .upsert(fieldRows, { onConflict: "event_id,dg_id", ignoreDuplicates: false });
        if (fieldUpsertError) {
          console.error("Error upserting player_field for event:", fieldData.event_name, fieldUpsertError);
          throw new Error(`upsert failed: ${fieldUpsertError.message}`);
        }
      }
    }

    // Upsert main event field
    await upsertField(pgaFieldData);
    // Upsert opposite field event if available
    if (oppFieldData && oppFieldData.field && oppFieldData.field.length > 0) {
      await upsertField(oppFieldData);
    }

    // Update player_skill_ratings for ALL players in the skill ratings feed
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
      data_golf_updated_at: sourceTimestamp,
    }));
    let processedCount = 0;
    if (allPlayersSkill.length > 0) {
      const { error: deleteError } = await supabase.from("player_skill_ratings").delete().neq('dg_id', 0);
      if (deleteError) {
        console.error("Error clearing player_skill_ratings table:", deleteError);
      }
      const { error: upsertError } = await supabase
        .from("player_skill_ratings")
        .upsert(allPlayersSkill, { onConflict: 'dg_id', ignoreDuplicates: false });
      if (upsertError) {
        throw new Error(`Supabase latest upsert failed: ${upsertError.message}`);
      }
      const { error: insertHistError } = await supabase
        .from("historical_player_skill_ratings")
        .insert(allPlayersSkill);
      if (insertHistError) {
        console.error("Error inserting historical player skill ratings:", insertHistError);
      }
      processedCount = allPlayersSkill.length;
    }
    return NextResponse.json({
      success: true,
      message: `Synced player fields for PGA and Opposite Field events. Main event: ${pgaFieldData.event_name} (${processedCount} players).`,
      processedCount,
      sourceTimestamp,
      mainEventName: pgaFieldData.event_name,
      oppEventName: oppFieldData?.event_name || null
    });
  } catch (error) {
    console.error("Error in GET /api/players/sync-skill-ratings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        sourceTimestamp
      },
      { status: 500 },
    );
  }
}

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response
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
  last_updated: string; // ISO 8601 format e.g., "2021-10-28 20:58:16 UTC"
  players: PlayerSkillData[];
}

// Define the structure for Supabase upsert (matching table columns)
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
  data_golf_updated_at: string; // Store the source file timestamp
}

// Interface for Field Update Player
interface FieldPlayer {
  dg_id: number;
  // ... other fields we might want later ...
}

// Interface for Field Update Response
interface DataGolfFieldResponse {
  event_name: string;
  // ... other fields ...
  field: FieldPlayer[];
}

// Initialize Supabase client - Ensure these environment variables are set!
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL or Service Role Key is missing in environment variables.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Data Golf API Key - Ensure this environment variable is set!
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

const DATA_GOLF_SKILL_URL = `https://feeds.datagolf.com/preds/skill-ratings?display=value&file_format=json&key=${dataGolfApiKey}`;
// Add Field Update URL (assuming PGA tour)
const DATA_GOLF_FIELD_URL = `https://feeds.datagolf.com/field-updates?tour=pga&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Starting player data sync...");

  try {
    // 1. Fetch Current Field Data
    console.log("Fetching current field data from Data Golf...");
    const fieldResponse = await fetch(DATA_GOLF_FIELD_URL, { cache: 'no-store' });
    if (!fieldResponse.ok) {
      const errorText = await fieldResponse.text();
      console.error("Failed to fetch field data:", fieldResponse.status, errorText);
      throw new Error(`Failed to fetch field data: ${fieldResponse.status} ${errorText}`);
    }
    const fieldData: DataGolfFieldResponse = await fieldResponse.json();
    const fieldPlayerIds = new Set(fieldData.field.map(p => p.dg_id));
    console.log(`Found ${fieldPlayerIds.size} players in the field for ${fieldData.event_name}.`);

    // 2. Fetch Skill Ratings Data
    console.log("Fetching player skill ratings from Data Golf...");
    const skillResponse = await fetch(DATA_GOLF_SKILL_URL, { cache: 'no-store' });
    if (!skillResponse.ok) {
      const errorText = await skillResponse.text();
      console.error("Failed to fetch skill data:", skillResponse.status, errorText);
      throw new Error(`Failed to fetch skill data: ${skillResponse.status} ${errorText}`);
    }
    const skillData: DataGolfSkillResponse = await skillResponse.json();
    const sourceUpdateTime = new Date(skillData.last_updated.replace(" UTC", "Z")).toISOString();
    console.log(`Successfully fetched skill data. Source last updated: ${sourceUpdateTime}`);

    // 3. Map and Filter Skill data based on current field
    const allPlayersSkill = skillData.players.map((player) => ({ // Map first
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

    // Now filter based on the field IDs
    const playersToUpsert: SupabasePlayerSkill[] = allPlayersSkill.filter(player =>
        fieldPlayerIds.has(player.dg_id)
    );

    console.log(`Processed ${allPlayersSkill.length} total skill ratings, filtered down to ${playersToUpsert.length} players in the current field.`);

    // 4. Upsert Filtered Players
    if (playersToUpsert.length > 0) {
      // Clear the table first to remove players no longer in the field
      const { error: deleteError } = await supabase.from("player_skill_ratings").delete().neq('dg_id', 0); // Delete all rows
      if (deleteError) {
          // Log error but continue with upsert if desired, though data might be mixed
          console.error("Error clearing player_skill_ratings table:", deleteError);
          // Depending on severity, you might want to throw the error here
          // throw new Error(`Failed to clear player skills table: ${deleteError.message}`);
      } else {
          console.log("Cleared old players from player_skill_ratings table.");
      }

      // Now upsert only the players in the current field
      const { error: upsertError } = await supabase
        .from("player_skill_ratings")
        .upsert(playersToUpsert, {
          onConflict: 'dg_id',
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error("Error upserting player skill ratings into Supabase:", upsertError);
        throw new Error(`Supabase upsert failed: ${upsertError.message}`);
      }
        console.log(`Successfully upserted ${playersToUpsert.length} player skill ratings.`);
    } else {
        console.log("No players found in both skill ratings and current field to upsert.")
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced skill ratings for ${playersToUpsert.length} players in the current field (${fieldData.event_name}).`,
      processedCount: playersToUpsert.length,
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

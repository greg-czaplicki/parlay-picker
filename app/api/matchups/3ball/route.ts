import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response
interface Odds {
  p1: number | null;
  p2: number | null;
  p3: number | null;
}

interface BookmakerOdds {
  [bookmaker: string]: Odds;
}

interface Matchup {
  odds: BookmakerOdds;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id: number;
  p3_player_name: string;
  ties: string;
}

interface DataGolfResponse {
  event_name: string;
  last_updated: string; // ISO 8601 format e.g., "2025-04-10 11:30:00 UTC"
  market: string;
  match_list: Matchup[];
  round_num: number;
}

// Define the structure for Supabase insertion
interface SupabaseMatchup {
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  p3_dg_id: number;
  p3_player_name: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  fanduel_p3_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  draftkings_p3_odds: number | null;
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

const DATA_GOLF_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Fetching 3-ball matchups from Data Golf...");

  try {
    const response = await fetch(DATA_GOLF_URL, {
        next: { revalidate: 3600 } // Revalidate data every hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch data from Data Golf:", response.status, errorText);
      throw new Error(
        `Failed to fetch data from Data Golf: ${response.status} ${errorText}`,
      );
    }

    const data: DataGolfResponse = await response.json();
    console.log(`Successfully fetched data for event: ${data.event_name}, round: ${data.round_num}`);

    const matchupsToInsert: SupabaseMatchup[] = data.match_list.map((matchup) => {
        const fanduelOdds = matchup.odds.fanduel;
        const draftkingsOdds = matchup.odds.draftkings;

        return {
            event_name: data.event_name,
            round_num: data.round_num,
            // Convert UTC time string to a format Supabase understands (ISO 8601)
            data_golf_update_time: new Date(data.last_updated.replace(" UTC", "Z")).toISOString(),
            p1_dg_id: matchup.p1_dg_id,
            p1_player_name: matchup.p1_player_name,
            p2_dg_id: matchup.p2_dg_id,
            p2_player_name: matchup.p2_player_name,
            p3_dg_id: matchup.p3_dg_id,
            p3_player_name: matchup.p3_player_name,
            ties_rule: matchup.ties,
            fanduel_p1_odds: fanduelOdds?.p1 ?? null,
            fanduel_p2_odds: fanduelOdds?.p2 ?? null,
            fanduel_p3_odds: fanduelOdds?.p3 ?? null,
            draftkings_p1_odds: draftkingsOdds?.p1 ?? null,
            draftkings_p2_odds: draftkingsOdds?.p2 ?? null,
            draftkings_p3_odds: draftkingsOdds?.p3 ?? null,
        };
    });

    console.log(`Processed ${matchupsToInsert.length} matchups for insertion.`);

    if (matchupsToInsert.length > 0) {

      // 1. Insert into historical table
      const { error: insertError } = await supabase
        .from("three_ball_matchups") // Historical table
        .insert(matchupsToInsert);

      if (insertError) {
          // Log error but potentially continue to upsert latest, or handle differently
          console.error("Error inserting historical matchups into Supabase:", insertError);
          // Optional: Decide if you want to stop the process here
          // throw new Error(`Supabase historical insertion failed: ${insertError.message}`);
      } else {
        console.log(`Successfully inserted ${matchupsToInsert.length} historical matchups.`);
      }

      // 2. Upsert into latest odds table
      const { error: upsertError } = await supabase
        .from("latest_three_ball_matchups") // Latest odds table
        .upsert(matchupsToInsert, {
          // Specify the columns that define a unique matchup
          onConflict: 'event_name, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
          // ignoreDuplicates: false // Default is false, ensures updates happen
        });

      if (upsertError) {
        // This is more critical, as it affects the main display
        console.error("Error upserting latest matchups into Supabase:", upsertError);
        throw new Error(`Supabase latest upsert failed: ${upsertError.message}`);
      }
        console.log(`Successfully upserted ${matchupsToInsert.length} latest matchups.`);

    } else {
        console.log("No matchups found in the fetched data to insert.")
    }


    return NextResponse.json({
      success: true,
      message: `Successfully fetched and stored ${matchupsToInsert.length} 3-ball matchups for ${data.event_name}, round ${data.round_num}.`,
      event: data.event_name,
      round: data.round_num,
      processedCount: matchupsToInsert.length,
    });
  } catch (error) {
    console.error("Error in GET /api/matchups/3ball:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

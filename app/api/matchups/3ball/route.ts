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

const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  console.log("Fetching 3-ball matchups from Data Golf (PGA and Opposite Field)...");

  try {
    // Fetch both PGA and Opposite Field events in parallel
    const [pgaRes, oppRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 3600 } }),
      fetch(DATA_GOLF_OPP_URL, { next: { revalidate: 3600 } })
    ]);

    // Fetch tournaments from Supabase to map event_name to event_id
    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("event_id, event_name");
    if (tournamentsError) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError.message}`);
    }
    const eventNameToId = new Map<string, number>();
    (tournaments || []).forEach(t => eventNameToId.set(t.event_name, t.event_id));

    const results = [];
    const sources: [Response, string][] = [
      [pgaRes, 'PGA'],
      [oppRes, 'OPP'],
    ];
    for (const [res, label] of sources) {
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch data from Data Golf (${label}):`, res.status, errorText);
        continue;
      }
      const data: DataGolfResponse = await res.json();
      console.log(`Full Data Golf API response (${label}):`, data);
      if (!Array.isArray(data.match_list)) {
        console.error(`Data Golf API (${label}): match_list is not an array`, data.match_list);
        continue;
      }
      const event_id = eventNameToId.get(data.event_name) || null;
      const matchupsToInsert: (SupabaseMatchup & { event_id: number | null })[] = data.match_list.map((matchup) => {
        const fanduelOdds = matchup.odds.fanduel;
        const draftkingsOdds = matchup.odds.draftkings;
        return {
          event_id,
          event_name: data.event_name,
          round_num: data.round_num,
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
      if (matchupsToInsert.length > 0) {
        // Insert into historical table
        const { error: insertError } = await supabase
          .from("three_ball_matchups")
          .insert(matchupsToInsert);
        if (insertError) {
          console.error(`Error inserting historical matchups into Supabase (${label}):`, insertError);
        } else {
          console.log(`Successfully inserted ${matchupsToInsert.length} historical matchups for ${label}.`);
        }
        // Upsert into latest odds table
        const { error: upsertError } = await supabase
          .from("latest_three_ball_matchups")
          .upsert(matchupsToInsert, {
            onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
          });
        if (upsertError) {
          console.error(`Error upserting latest matchups into Supabase (${label}):`, upsertError);
          throw new Error(`Supabase latest upsert failed (${label}): ${upsertError.message}`);
        }
        console.log(`Successfully upserted ${matchupsToInsert.length} latest matchups for ${label}.`);
      } else {
        console.log(`No matchups found in the fetched data to insert for ${label}.`);
      }
      results.push({
        event: data.event_name,
        round: data.round_num,
        processedCount: matchupsToInsert.length
      });
    }
    return NextResponse.json({
      success: true,
      message: `Fetched and stored 3-ball matchups for ${results.length} event(s).`,
      results
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

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response (2-ball)
interface Odds {
  p1: number | null;
  p2: number | null;
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
  ties: string;
}

interface DataGolfResponse {
  event_name: string;
  last_updated: string;
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
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
}

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

const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  // 1. Fetch Data Golf's last_updated timestamp (PGA only, as a reference)
  const dataGolfRes = await fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 3600 } });
  if (!dataGolfRes.ok) {
    const errorText = await dataGolfRes.text();
    return NextResponse.json({ success: false, error: `Failed to fetch Data Golf: ${errorText}` }, { status: 500 });
  }
  const dataGolfJson: DataGolfResponse = await dataGolfRes.json();
  const dataGolfLastUpdated = new Date(dataGolfJson.last_updated.replace(" UTC", "Z"));

  // 2. Check for recent matchups in the DB (by data_golf_update_time)
  const { data: recentMatchups, error: recentError } = await supabase
    .from("latest_two_ball_matchups")
    .select("*")
    .order("data_golf_update_time", { ascending: false })
    .limit(1);

  if (recentError) {
    console.error("Error checking for recent 2-ball matchups:", recentError);
  }

  if (recentMatchups && recentMatchups.length > 0) {
    const latest = recentMatchups[0];
    const dbLastUpdated = new Date(latest.data_golf_update_time);
    // If DB is as fresh as Data Golf, serve from cache
    if (dbLastUpdated >= dataGolfLastUpdated) {
      const { data: allRecent, error: allRecentError } = await supabase
        .from("latest_two_ball_matchups")
        .select("*")
        .eq("event_name", latest.event_name)
        .eq("round_num", latest.round_num)
        .eq("data_golf_update_time", latest.data_golf_update_time);
      if (allRecentError) {
        return NextResponse.json({ success: false, error: allRecentError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, cached: true, matchups: allRecent });
    }
  }

  console.log("Fetching 2-ball matchups from Data Golf (PGA and Opposite Field)...");
  try {
    const [pgaRes, oppRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 3600 } }),
      fetch(DATA_GOLF_OPP_URL, { next: { revalidate: 3600 } })
    ]);

    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("event_id, event_name");
    if (tournamentsError) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError.message}`);
    }
    const eventNameToId = new Map<string, number>();
    (tournaments || []).forEach(t => eventNameToId.set(t.event_name, t.event_id));

    // 2b. Check latest data_golf_update_time in historical table
    const { data: latestHist, error: histError } = await supabase
      .from("two_ball_matchups")
      .select("data_golf_update_time")
      .order("data_golf_update_time", { ascending: false })
      .limit(1);
    let histLastUpdated = null;
    if (latestHist && latestHist.length > 0) {
      histLastUpdated = new Date(latestHist[0].data_golf_update_time);
    }

    const results = [];
    const sources: [Response, string][] = [
      [pgaRes, 'PGA'],
      [oppRes, 'OPP'],
    ];
    for (const [res, label] of sources) {
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch data from Data Golf (${label}):`, res.status, errorText);
        throw new Error(`Failed to fetch data from Data Golf (${label}): ${res.status} ${errorText}`);
      }
      const data: DataGolfResponse = await res.json();
      console.log(`Full Data Golf API response (${label}):`, data);
      if (!Array.isArray(data.match_list)) {
        console.error(`Data Golf API (${label}): match_list is not an array`, data.match_list);
        throw new Error(`Data Golf API (${label}): match_list is not an array`);
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
          ties_rule: matchup.ties,
          fanduel_p1_odds: fanduelOdds?.p1 ?? null,
          fanduel_p2_odds: fanduelOdds?.p2 ?? null,
          draftkings_p1_odds: draftkingsOdds?.p1 ?? null,
          draftkings_p2_odds: draftkingsOdds?.p2 ?? null,
        };
      });
      // Deduplicate matchups by unique constraint
      const uniqueKey = (m: any) => `${m.event_id}-${m.event_name}-${m.round_num}-${m.p1_dg_id}-${m.p2_dg_id}`;
      const dedupedMatchups = Array.from(
        new Map(matchupsToInsert.map(m => [uniqueKey(m), m])).values()
      );
      if (dedupedMatchups.length > 0) {
        // Only insert into historical table if Data Golf last_updated is newer
        if (!histLastUpdated || new Date(data.last_updated.replace(" UTC", "Z")) > histLastUpdated) {
          const { error: insertError } = await supabase
            .from("two_ball_matchups")
            .insert(dedupedMatchups);
          if (insertError) {
            console.error(`Error inserting historical matchups into Supabase (${label}):`, insertError);
            throw new Error(`Supabase historical insert failed (${label}): ${insertError.message}`);
          }
        } else {
          console.log(`Historical odds not updated for ${label} (no new Data Golf update).`);
        }
        // Upsert into latest odds table
        const { error: upsertError } = await supabase
          .from("latest_two_ball_matchups")
          .upsert(dedupedMatchups, {
            onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id',
          });
        if (upsertError) {
          console.error(`Error upserting latest matchups into Supabase (${label}):`, upsertError);
          throw new Error(`Supabase latest upsert failed (${label}): ${upsertError.message}`);
        }
        console.log(`Successfully upserted ${dedupedMatchups.length} latest matchups for ${label}.`);
      } else {
        console.log(`No matchups found in the fetched data to insert for ${label}.`);
      }
      results.push({
        event: data.event_name,
        round: data.round_num,
        processedCount: dedupedMatchups.length
      });
    }
    return NextResponse.json({
      success: true,
      message: `Fetched and stored 2-ball matchups for ${results.length} event(s).`,
      results
    });
  } catch (error) {
    console.error("Error in GET /api/matchups/2ball:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

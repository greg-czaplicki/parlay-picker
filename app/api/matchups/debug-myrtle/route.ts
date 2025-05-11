import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'

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
const dataGolfApiKey = process.env.DATAGOLF_API_KEY || "fb03cadc312c2f0015bc8c5354ea";

const OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  try {
    console.log("MYRTLE BEACH DEBUG: Starting direct debug of opposite field matchups");
    
    // 1. Fetch the opposite field API directly
    console.log("MYRTLE BEACH DEBUG: Fetching opposite field API data...");
    const oppResponse = await fetch(OPP_URL, { cache: 'no-store' });
    
    if (!oppResponse.ok) {
      return handleApiError(`Failed to fetch from Data Golf API: ${oppResponse.status}`, undefined, 500);
    }
    
    const oppData = await oppResponse.json();
    console.log("MYRTLE BEACH DEBUG: API response received");
    
    // 2. Get Myrtle Beach tournament from DB
    console.log("MYRTLE BEACH DEBUG: Finding Myrtle Beach tournament in database...");
    const { data: myrtleTournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .ilike("event_name", "%myrtle%")
      .single();
    
    if (tournamentError) {
      return handleApiError(`Failed to find Myrtle Beach tournament: ${tournamentError.message}`, undefined, 500);
    }
    
    if (!myrtleTournament) {
      return handleApiError("No Myrtle Beach tournament found in database", undefined, 404);
    }
    
    console.log("MYRTLE BEACH DEBUG: Found tournament:", myrtleTournament);
    
    // 3. Check for existing matchups for this tournament
    console.log("MYRTLE BEACH DEBUG: Checking for existing matchups...");
    const { data: existingMatchups, error: matchupsError } = await supabase
      .from("latest_three_ball_matchups")
      .select("id, event_name, event_id")
      .eq("event_id", myrtleTournament.event_id)
      .limit(1);
    
    if (matchupsError) {
      console.log("MYRTLE BEACH DEBUG: Error checking for existing matchups:", matchupsError);
    }
    
    console.log("MYRTLE BEACH DEBUG: Existing matchups check result:", existingMatchups);
    
    // 4. Prepare matchups for insertion
    console.log("MYRTLE BEACH DEBUG: Preparing matchups for insertion...");
    
    if (!Array.isArray(oppData.match_list)) {
      return handleApiError("match_list in API response is not an array");
    }
    
    const matchupsToInsert = oppData.match_list.map(matchup => {
      const fanduelOdds = matchup.odds.fanduel;
      const draftkingsOdds = matchup.odds.draftkings;
      const datagolfOdds = matchup.odds.datagolf;
      
      return {
        event_id: myrtleTournament.event_id,
        event_name: myrtleTournament.event_name, // Use our DB name, not API name
        round_num: oppData.round_num,
        data_golf_update_time: new Date(oppData.last_updated.replace(" UTC", "Z")).toISOString(),
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
        datagolf_p1_odds: datagolfOdds?.p1 ?? null,
        datagolf_p2_odds: datagolfOdds?.p2 ?? null,
        datagolf_p3_odds: datagolfOdds?.p3 ?? null,
      };
    });
    
    console.log(`MYRTLE BEACH DEBUG: Prepared ${matchupsToInsert.length} matchups for insertion`);
    
    // 5. Insert into database
    console.log("MYRTLE BEACH DEBUG: Inserting into historical table...");
    const { error: insertError } = await supabase
      .from("three_ball_matchups")
      .insert(matchupsToInsert);
    
    if (insertError) {
      console.log("MYRTLE BEACH DEBUG: Insert error:", insertError);
      return handleApiError(`Failed to insert historical matchups: ${insertError.message}`, undefined, 500);
    }
    
    console.log("MYRTLE BEACH DEBUG: Upserting into latest table...");
    const { error: upsertError } = await supabase
      .from("latest_three_ball_matchups")
      .upsert(matchupsToInsert, {
        onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
      });
    
    if (upsertError) {
      console.log("MYRTLE BEACH DEBUG: Upsert error:", upsertError);
      return handleApiError(`Failed to upsert latest matchups: ${upsertError.message}`);
    }
    
    console.log("MYRTLE BEACH DEBUG: Successfully inserted/upserted matchups");
    
    // 6. Return success
    return NextResponse.json({
      success: true,
      message: `Successfully inserted ${matchupsToInsert.length} matchups for ${myrtleTournament.event_name}`,
      tournament: myrtleTournament,
      api_event_name: oppData.event_name,
      matchup_count: matchupsToInsert.length
    });
    
  } catch (error) {
    return handleApiError(error);
  }
}
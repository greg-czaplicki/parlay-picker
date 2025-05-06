import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

const PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  try {
    console.log("ALL MATCHUPS DEBUG: Starting direct debug of both PGA and OPP matchups");
    
    // 1. Fetch both APIs in parallel
    console.log("ALL MATCHUPS DEBUG: Fetching both API endpoints...");
    const [pgaResponse, oppResponse] = await Promise.all([
      fetch(PGA_URL, { cache: 'no-store' }),
      fetch(OPP_URL, { cache: 'no-store' })
    ]);
    
    if (!pgaResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to fetch from PGA API: ${pgaResponse.status}` 
      }, { status: 500 });
    }
    
    if (!oppResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to fetch from OPP API: ${oppResponse.status}` 
      }, { status: 500 });
    }
    
    const pgaData = await pgaResponse.json();
    const oppData = await oppResponse.json();
    
    console.log("ALL MATCHUPS DEBUG: API responses received");
    console.log(`PGA event: ${pgaData.event_name}, OPP event: ${oppData.event_name}`);
    
    // 2. Get both tournaments from DB
    console.log("ALL MATCHUPS DEBUG: Fetching tournaments from database...");
    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("*")
      .or(`event_name.ilike.%Truist%,event_name.ilike.%Myrtle%`);
    
    if (tournamentsError) {
      return NextResponse.json({ 
        success: false, 
        error: `Failed to find tournaments: ${tournamentsError.message}` 
      }, { status: 500 });
    }
    
    if (!tournaments || tournaments.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No matching tournaments found in database" 
      }, { status: 404 });
    }
    
    console.log("ALL MATCHUPS DEBUG: Found tournaments:", tournaments);
    
    // Find each tournament
    const truistTournament = tournaments.find(t => t.event_name.includes('Truist'));
    const myrtleTournament = tournaments.find(t => t.event_name.includes('Myrtle'));
    
    if (!truistTournament) {
      return NextResponse.json({ 
        success: false, 
        error: "Truist Championship not found in database" 
      }, { status: 404 });
    }
    
    if (!myrtleTournament) {
      return NextResponse.json({ 
        success: false, 
        error: "Myrtle Beach Classic not found in database" 
      }, { status: 404 });
    }
    
    // 3. Prepare PGA matchups
    console.log("ALL MATCHUPS DEBUG: Preparing PGA matchups for insertion...");
    
    if (!Array.isArray(pgaData.match_list)) {
      return NextResponse.json({ 
        success: false, 
        error: "PGA match_list in API response is not an array" 
      }, { status: 500 });
    }
    
    const pgaMatchupsToInsert = pgaData.match_list.map(matchup => {
      const fanduelOdds = matchup.odds.fanduel;
      const draftkingsOdds = matchup.odds.draftkings;
      const datagolfOdds = matchup.odds.datagolf;
      
      return {
        event_id: truistTournament.event_id,
        event_name: truistTournament.event_name, // Use our DB name, not API name
        round_num: pgaData.round_num,
        data_golf_update_time: new Date(pgaData.last_updated.replace(" UTC", "Z")).toISOString(),
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
    
    // 4. Prepare OPP matchups
    console.log("ALL MATCHUPS DEBUG: Preparing OPP matchups for insertion...");
    
    if (!Array.isArray(oppData.match_list)) {
      return NextResponse.json({ 
        success: false, 
        error: "OPP match_list in API response is not an array" 
      }, { status: 500 });
    }
    
    const oppMatchupsToInsert = oppData.match_list.map(matchup => {
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
    
    console.log(`ALL MATCHUPS DEBUG: Prepared ${pgaMatchupsToInsert.length} PGA matchups and ${oppMatchupsToInsert.length} OPP matchups`);
    
    // 5. Process PGA matchups
    console.log("ALL MATCHUPS DEBUG: Processing PGA matchups...");
    if (pgaMatchupsToInsert.length > 0) {
      // Insert into historical
      const { error: pgaInsertError } = await supabase
        .from("three_ball_matchups")
        .insert(pgaMatchupsToInsert);
      
      if (pgaInsertError) {
        console.log("ALL MATCHUPS DEBUG: PGA historical insert error:", pgaInsertError);
      } else {
        console.log(`ALL MATCHUPS DEBUG: Successfully inserted ${pgaMatchupsToInsert.length} PGA historical matchups`);
      }
      
      // Upsert PGA matchups
      const { error: pgaUpsertError } = await supabase
        .from("latest_three_ball_matchups")
        .upsert(pgaMatchupsToInsert, {
          onConflict: 'event_id, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
        });
      
      if (pgaUpsertError) {
        console.log("ALL MATCHUPS DEBUG: PGA upsert error:", pgaUpsertError);
      } else {
        console.log(`ALL MATCHUPS DEBUG: Successfully upserted ${pgaMatchupsToInsert.length} PGA latest matchups`);
      }
    }
    
    // 6. Process OPP matchups
    console.log("ALL MATCHUPS DEBUG: Processing OPP matchups...");
    if (oppMatchupsToInsert.length > 0) {
      // Insert into historical
      const { error: oppInsertError } = await supabase
        .from("three_ball_matchups")
        .insert(oppMatchupsToInsert);
      
      if (oppInsertError) {
        console.log("ALL MATCHUPS DEBUG: OPP historical insert error:", oppInsertError);
      } else {
        console.log(`ALL MATCHUPS DEBUG: Successfully inserted ${oppMatchupsToInsert.length} OPP historical matchups`);
      }
      
      // Upsert OPP matchups
      const { error: oppUpsertError } = await supabase
        .from("latest_three_ball_matchups")
        .upsert(oppMatchupsToInsert, {
          onConflict: 'event_id, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
        });
      
      if (oppUpsertError) {
        console.log("ALL MATCHUPS DEBUG: OPP upsert error:", oppUpsertError);
      } else {
        console.log(`ALL MATCHUPS DEBUG: Successfully upserted ${oppMatchupsToInsert.length} OPP latest matchups`);
      }
    }
    
    // 7. Return success
    return NextResponse.json({
      success: true,
      message: `Successfully processed matchups for both tournaments`,
      pga_tournament: {
        id: truistTournament.event_id,
        name: truistTournament.event_name,
        api_name: pgaData.event_name,
        matchup_count: pgaMatchupsToInsert.length
      },
      opp_tournament: {
        id: myrtleTournament.event_id,
        name: myrtleTournament.event_name,
        api_name: oppData.event_name,
        matchup_count: oppMatchupsToInsert.length
      }
    });
    
  } catch (error) {
    console.error("Error in all matchups debug endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
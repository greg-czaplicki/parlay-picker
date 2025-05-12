import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

const dataGolfApiKey = process.env.DATAGOLF_API_KEY || "fb03cadc312c2f0015bc8c5354ea";
const OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  try {
    logger.info("MYRTLE BEACH DEBUG: Starting direct debug of opposite field matchups");
    // 1. Fetch the opposite field API directly
    logger.info("MYRTLE BEACH DEBUG: Fetching opposite field API data...");
    const oppResponse = await fetch(OPP_URL, { cache: 'no-store' });
    if (!oppResponse.ok) {
      return handleApiError(`Failed to fetch from Data Golf API: ${oppResponse.status}`);
    }
    const oppData = await oppResponse.json();
    logger.info("MYRTLE BEACH DEBUG: API response received");
    // 2. Get Myrtle Beach tournament from DB
    logger.info("MYRTLE BEACH DEBUG: Finding Myrtle Beach tournament in database...");
    const supabase = createSupabaseClient();
    const { data: myrtleTournament, error: tournamentError } = await supabase
      .from("tournaments")
      .select("*")
      .ilike("event_name", "%myrtle%")
      .single();
    if (tournamentError) {
      return handleApiError(`Failed to find Myrtle Beach tournament: ${tournamentError.message}`);
    }
    if (!myrtleTournament) {
      return handleApiError("No Myrtle Beach tournament found in database");
    }
    logger.info("MYRTLE BEACH DEBUG: Found tournament:", myrtleTournament);
    // 3. Check for existing matchups for this tournament
    logger.info("MYRTLE BEACH DEBUG: Checking for existing matchups...");
    const { data: existingMatchups, error: matchupsError } = await supabase
      .from("latest_three_ball_matchups")
      .select("id, event_name, event_id")
      .eq("event_id", myrtleTournament.event_id)
      .limit(1);
    if (matchupsError) {
      logger.warn("MYRTLE BEACH DEBUG: Error checking for existing matchups:", matchupsError);
    }
    logger.info("MYRTLE BEACH DEBUG: Existing matchups check result:", existingMatchups);
    // 4. Prepare matchups for insertion
    logger.info("MYRTLE BEACH DEBUG: Preparing matchups for insertion...");
    if (!Array.isArray(oppData.match_list)) {
      return handleApiError("match_list in API response is not an array");
    }
    const matchupsToInsert = oppData.match_list.map((matchup: any) => {
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
    logger.info(`MYRTLE BEACH DEBUG: Prepared ${matchupsToInsert.length} matchups for insertion`);
    // 5. Insert into database
    logger.info("MYRTLE BEACH DEBUG: Inserting into historical table...");
    const { error: insertError } = await supabase
      .from("three_ball_matchups")
      .insert(matchupsToInsert);
    if (insertError) {
      logger.error("MYRTLE BEACH DEBUG: Insert error:", insertError);
      return handleApiError(`Failed to insert historical matchups: ${insertError.message}`);
    }
    logger.info("MYRTLE BEACH DEBUG: Upserting into latest table...");
    const { error: upsertError } = await supabase
      .from("latest_three_ball_matchups")
      .upsert(matchupsToInsert, {
        onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
      });
    if (upsertError) {
      logger.error("MYRTLE BEACH DEBUG: Upsert error:", upsertError);
      return handleApiError(`Failed to upsert latest matchups: ${upsertError.message}`);
    }
    logger.info("MYRTLE BEACH DEBUG: Successfully inserted/upserted matchups");
    // 6. Return success
    return jsonSuccess({
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
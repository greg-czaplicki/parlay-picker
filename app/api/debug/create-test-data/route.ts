import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    // First check if we already have 2-ball matchups
    const { count: existingCount, error: countError } = await supabase
      .from("latest_two_ball_matchups")
      .select('*', { count: 'exact', head: true });
    if (countError) {
      throw new Error(`Error checking existing matchups: ${countError.message}`);
    }
    logger.info(`Found ${existingCount} existing 2-ball matchups`);
    // Check 3-ball matchups as source data
    const { count: threeBallCount, error: threeBallError } = await supabase
      .from("latest_three_ball_matchups")
      .select('*', { count: 'exact', head: true });
    if (threeBallError) {
      throw new Error(`Error checking 3-ball matchups: ${threeBallError.message}`);
    }
    logger.info(`Found ${threeBallCount} existing 3-ball matchups as source data`);
    if (threeBallCount === 0) {
      return jsonSuccess({
        success: false,
        error: "No 3-ball matchups found to use as source data"
      });
    }
    // Now run our SQL to create test 2-ball data
    // 1. Clear existing 2-ball matchups
    const { error: deleteError } = await supabase
      .from("latest_two_ball_matchups")
      .delete()
      .neq("id", 0); // This is just a trick to delete all rows
    if (deleteError) {
      throw new Error(`Error clearing existing 2-ball matchups: ${deleteError.message}`);
    }
    // 2. Copy data from 3-ball matchups
    const threeBallData = await supabase
      .from("latest_three_ball_matchups")
      .select("*");
    if (threeBallData.error) {
      throw new Error(`Error fetching 3-ball data: ${threeBallData.error.message}`);
    }
    // Transform 3-ball data to 2-ball format
    const twoBallMatchups = (threeBallData.data || []).map((match: any) => ({
      event_id: match.event_id,
      event_name: match.event_name,
      round_num: match.round_num,
      data_golf_update_time: match.data_golf_update_time,
      p1_dg_id: match.p1_dg_id,
      p1_player_name: match.p1_player_name,
      p2_dg_id: match.p2_dg_id,
      p2_player_name: match.p2_player_name,
      ties_rule: match.ties_rule,
      fanduel_p1_odds: match.fanduel_p1_odds,
      fanduel_p2_odds: match.fanduel_p2_odds,
      draftkings_p1_odds: match.draftkings_p1_odds,
      draftkings_p2_odds: match.draftkings_p2_odds
    }));
    // Insert the transformed data
    const { error: insertError } = await supabase
      .from("latest_two_ball_matchups")
      .insert(twoBallMatchups);
    if (insertError) {
      throw new Error(`Error inserting test 2-ball data: ${insertError.message}`);
    }
    // Verify the final counts
    const { count: finalCount, error: finalError } = await supabase
      .from("latest_two_ball_matchups")
      .select('*', { count: 'exact', head: true });
    if (finalError) {
      throw new Error(`Error checking final count: ${finalError.message}`);
    }
    // Get distribution by event
    const { data: eventCounts, error: eventError } = await supabase
      .from("latest_two_ball_matchups")
      .select("event_id, event_name, count(*)");
    return jsonSuccess({
      success: true,
      initialCount: existingCount,
      threeBallCount,
      finalCount,
      eventDistribution: eventError ? null : eventCounts
    });
  } catch (error) {
    return handleApiError(error)
  }
}
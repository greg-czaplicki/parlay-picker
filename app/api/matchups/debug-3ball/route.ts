import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}
const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  try {
    const supabase = createSupabaseClient();
    // Fetch tournaments from database for debugging
    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("event_id, event_name");
    if (tournamentsError) {
      logger.error("Failed to fetch tournaments:", tournamentsError);
      return handleApiError(`Failed to fetch tournaments: ${tournamentsError.message}`);
    }
    // Fetch both APIs
    const [pgaResponse, oppResponse] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 0 } }),
      fetch(DATA_GOLF_OPP_URL, { next: { revalidate: 0 } })
    ]);
    const pgaData = await pgaResponse.json();
    const oppData = await oppResponse.json();
    // Create event name to ID map for debugging
    const eventNameMap: Record<string, number> = {};
    tournaments?.forEach((t: { event_name: string; event_id: number }) => {
      eventNameMap[t.event_name] = t.event_id;
    });
    // Generate a diagnostic report
    const diagnosticReport = {
      tournaments_in_database: tournaments,
      tournament_count: tournaments?.length || 0,
      event_name_map: eventNameMap,
      pga_event: {
        name: pgaData.event_name,
        found_in_db: tournaments?.some((t: any) => t.event_name === pgaData.event_name),
        event_id: eventNameMap[pgaData.event_name] || null,
        last_updated: pgaData.last_updated,
        matchup_count: Array.isArray(pgaData.match_list) ? pgaData.match_list.length : 0
      },
      opp_event: {
        name: oppData.event_name,
        found_in_db: tournaments?.some((t: any) => t.event_name === oppData.event_name),
        event_id: eventNameMap[oppData.event_name] || null,
        last_updated: oppData.last_updated,
        matchup_count: Array.isArray(oppData.match_list) ? oppData.match_list.length : 0
      },
      potential_issues: [] as any[]
    };
    // Detect potential issues
    if (!diagnosticReport.pga_event.found_in_db) {
      diagnosticReport.potential_issues.push({
        type: "missing_tournament",
        message: `PGA event "${pgaData.event_name}" not found in tournaments table`,
        suggestion: "Check if tournament name matches exactly or add it to the database"
      });
    }
    if (!diagnosticReport.opp_event.found_in_db) {
      diagnosticReport.potential_issues.push({
        type: "missing_tournament",
        message: `Opposite field event "${oppData.event_name}" not found in tournaments table`,
        suggestion: "Check if tournament name matches exactly or add it to the database"
      });
    }
    // Find closest name match for opposite field event if not found exactly
    if (!diagnosticReport.opp_event.found_in_db) {
      const possibleMatches = tournaments?.filter((t: any) => {
        // Fuzzy match: check if either name contains parts of the other
        const oppName = oppData.event_name.toLowerCase();
        const dbName = t.event_name.toLowerCase();
        return oppName.includes(dbName) || dbName.includes(oppName);
      });
      if (possibleMatches && possibleMatches.length > 0) {
        diagnosticReport.potential_issues.push({
          type: "possible_name_mismatch",
          message: `Possible matches for "${oppData.event_name}" found`,
          possible_matches: possibleMatches
        });
      }
    }
    return jsonSuccess({
      diagnostic_report: diagnosticReport
    });
  } catch (error) {
    logger.error("Error in debug-3ball endpoint:", error);
    return handleApiError(error);
  }
}
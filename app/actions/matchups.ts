"use server"

import { createServerClient } from "@/lib/supabase";

// --- Helper Functions ---

/**
 * Converts American odds to Decimal odds.
 * @param odds - American odds (e.g., -110, +250).
 * @returns Decimal odds (e.g., 1.91, 3.50).
 */
function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return odds / 100 + 1;
  } else if (odds < 0) {
    return 100 / Math.abs(odds) + 1;
  }
  return 1; // Edge case for even odds (0) - treat as no payout? Or handle error.
}

/**
 * Converts Decimal odds to Implied Probability.
 * @param decimalOdds - Decimal odds (must be > 1).
 * @returns Implied probability (0 to 1).
 */
function decimalToImpliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 1) return 0; // Odds <= 1 imply 100% or more probability, which is invalid/impossible.
  return 1 / decimalOdds;
}

// Define interface for the raw row structure from latest_three_ball_matchups
interface LatestThreeBallMatchupRow {
    id: number; // Assuming bigint maps to number, adjust if needed
    event_name: string | null;
    round_num: number | null;
    p1_dg_id: number | null;
    p1_player_name: string | null;
    p2_dg_id: number | null;
    p2_player_name: string | null;
    p3_dg_id: number | null;
    p3_player_name: string | null;
    // Add potential nulls for odds
    fanduel_p1_odds: number | string | null;
    fanduel_p2_odds: number | string | null;
    fanduel_p3_odds: number | string | null;
    draftkings_p1_odds: number | string | null;
    draftkings_p2_odds: number | string | null;
    draftkings_p3_odds: number | string | null;
    // Allow other properties potentially selected
    [key: string]: any;
}

// --- Interfaces ---

export interface Player {
  id: number;
  name: string;
  odds: number;
  sgTotal: number; // Primary SG metric for now
  // Add other SG stats if needed later
  // sgTeeToGreen: number;
  // sgApproach: number;
  // sgAroundGreen: number;
  // sgPutting: number;
  valueRating: number; // Calculated value score (e.g., 0-10)
  confidenceScore: number; // Calculated confidence score (e.g., 0-100)
  isRecommended: boolean; // Determined by calculation within group
}

// Internal interface extending Player with calculated probability for processing
interface PlayerWithProbability extends Player {
    impliedProbability: number;
}

export interface Matchup {
  id: string; // Matchup ID from DB
  group: string; // Group name (e.g., "Group 1")
  bookmaker: string;
  players: Player[]; // Array of players in the matchup with calculated scores
  recommended: string; // Name of the recommended player in this group
}

// --- Calculation Logic ---

// Placeholder weights - ADJUST THESE based on importance
const WEIGHT_ODDS_GAP = 0.6; // Weight for odds advantage within the group
const WEIGHT_SG_TOTAL = 0.4; // Weight for Strokes Gained: Total

/**
 * Calculates value and confidence scores for a player within their group.
 * @param player - The player to calculate scores for (with implied probability).
 * @param groupPlayers - All players in the group (including the player itself).
 * @returns Calculated confidenceScore and valueRating.
 */
function calculateScore(player: PlayerWithProbability, groupPlayers: PlayerWithProbability[]): { confidenceScore: number; valueRating: number } {
    // 1. Calculate Odds Gap Factor
    const otherPlayers = groupPlayers.filter(p => p.id !== player.id);
    const avgOtherProbability = otherPlayers.length > 0
        ? otherPlayers.reduce((sum, p) => sum + p.impliedProbability, 0) / otherPlayers.length
        : 0;

    // Use small epsilon to avoid division by zero if probabilities are 0
    const epsilon = 0.0001;
    const playerProbability = Math.max(player.impliedProbability, epsilon);
    const safeAvgOtherProbability = Math.max(avgOtherProbability, epsilon);

    // Relative Odds Gap: How much better is the player's probability than the average of others?
    // Positive value means player has higher probability than avg of others.
    const oddsGapFactor = (playerProbability - safeAvgOtherProbability) / safeAvgOtherProbability;

    // Normalize Odds Gap Factor (e.g., map -100% to +100% difference to 0-1)
    // Cap the factor to prevent extreme values from dominating
    const cappedOddsGapFactor = Math.max(-1, Math.min(1, oddsGapFactor));
    const normalizedOddsGap = (cappedOddsGapFactor + 1) / 2; // Maps [-1, 1] to [0, 1]

    // 2. Get SG Total & Normalize
    const sgTotal = typeof player.sgTotal === 'number' ? player.sgTotal : 0;
    // Crude normalization assuming SG Total roughly ranges from -5 to +5
    // Adjust this range if data suggests otherwise
    const normalizedSgTotal = Math.max(0, Math.min(1, (sgTotal + 5) / 10)); // Clamp to [0, 1]

    // 3. Combine weighted normalized scores
    const confidenceScore = (WEIGHT_ODDS_GAP * normalizedOddsGap * 100) + (WEIGHT_SG_TOTAL * normalizedSgTotal * 100);

    // Simple value rating based on confidence score (e.g., scale 0-10)
    const valueRating = confidenceScore / 10;

    return {
        confidenceScore: parseFloat(confidenceScore.toFixed(0)), // Integer score 0-100
        valueRating: parseFloat(valueRating.toFixed(1))        // Rating 0.0-10.0
    };
}

// --- Server Action: getMatchups ---

/**
 * Fetches matchups from latest_three_ball_matchups, calculates player scores dynamically,
 * and identifies recommendations based on SG Total and odds gap.
 * @param matchupType - Should always be "3ball" for this implementation.
 * @param bookmaker - "fanduel" or "draftkings". Filters odds columns used.
 * @returns An object containing the list of processed matchups or an error message.
 */
export async function getMatchups(matchupType: string, bookmaker?: string): Promise<{ matchups: Matchup[]; error?: string }> {
  // This implementation specifically uses the latest_three_ball_matchups structure.
  // If matchupType is not "3ball", it might not work as expected.
  if (matchupType !== '3ball') {
      console.warn(`getMatchups called with type ${matchupType}, but is designed for '3ball' using latest_three_ball_matchups.`);
      // Optionally return error or proceed if schema is somehow compatible
      // return { matchups: [], error: `Unsupported matchupType: ${matchupType}` };
  }

  // Default to draftkings if no bookmaker specified
  const selectedBookmaker = bookmaker === 'fanduel' ? 'fanduel' : 'draftkings';
  console.log(`Fetching 3-ball matchups using ${selectedBookmaker} odds.`);

  const supabase = createServerClient();

  try {
    // 1. Select relevant columns from latest_three_ball_matchups
    const { data: matchupRows, error: matchupsError } = await supabase
      .from('latest_three_ball_matchups')
      .select(`
        id,
        event_name,
        round_num,
        p1_dg_id, p1_player_name,
        p2_dg_id, p2_player_name,
        p3_dg_id, p3_player_name,
        fanduel_p1_odds, fanduel_p2_odds, fanduel_p3_odds, 
        draftkings_p1_odds, draftkings_p2_odds, draftkings_p3_odds
      `)
      .returns<LatestThreeBallMatchupRow[]>(); // Use .returns<T>() for type safety

    if (matchupsError) {
      console.error("Supabase error fetching latest_three_ball_matchups:", matchupsError);
      throw new Error(`Error fetching matchups: ${matchupsError.message}`);
    }
    if (!matchupRows || matchupRows.length === 0) {
        console.log("No matchup data returned from latest_three_ball_matchups.");
        return { matchups: [] };
    }

    // 2. Get Unique Player IDs from all players in the fetched matchups
    const playerIds = [
      ...new Set(
        matchupRows.flatMap(row => [row.p1_dg_id, row.p2_dg_id, row.p3_dg_id])
                   .filter((id): id is number => id != null) // Ensure IDs are numbers and not null
      ),
    ];

    if (playerIds.length === 0) {
        console.log("No valid player IDs found in fetched matchups.");
        return { matchups: [] };
    }

    // 3. Fetch Player Stats (SG Total for now)
    const { data: playerStatsData, error: statsError } = await supabase
      .from("player_stats")
      .select("player_id, sg_total")
      .in("player_id", playerIds);

    if (statsError) {
      console.error("Supabase error fetching player stats:", statsError);
      // Decide how to handle missing stats - here we'll default to 0
    }

    // Create a map for quick stat lookup (Player ID -> { sgTotal: number })
    const playerStatsMap = new Map<number, { sgTotal: number }>();
    playerStatsData?.forEach(ps => {
        if (ps.player_id != null) {
            playerStatsMap.set(ps.player_id, { sgTotal: Number(ps.sg_total) || 0 });
        }
    });

    // 4. Process Each Matchup Row: Create Player objects, Calculate Scores, Determine Recommendation
    const processedMatchups: Matchup[] = matchupRows.map((row) => {

        // Safely access odds using the known keys based on selectedBookmaker
        const oddsP1Key = `${selectedBookmaker}_p1_odds` as keyof LatestThreeBallMatchupRow;
        const oddsP2Key = `${selectedBookmaker}_p2_odds` as keyof LatestThreeBallMatchupRow;
        const oddsP3Key = `${selectedBookmaker}_p3_odds` as keyof LatestThreeBallMatchupRow;

        const p1 = {
            id: row.p1_dg_id,
            name: row.p1_player_name,
            odds: Number(row[oddsP1Key]) || 0,
            sgTotal: playerStatsMap.get(row.p1_dg_id!)?.sgTotal ?? 0
        };
        const p2 = {
            id: row.p2_dg_id,
            name: row.p2_player_name,
            odds: Number(row[oddsP2Key]) || 0,
            sgTotal: playerStatsMap.get(row.p2_dg_id!)?.sgTotal ?? 0
        };
        const p3 = {
            id: row.p3_dg_id,
            name: row.p3_player_name,
            odds: Number(row[oddsP3Key]) || 0,
            sgTotal: playerStatsMap.get(row.p3_dg_id!)?.sgTotal ?? 0
        };

        // Create initial array
        const playersInitial = [p1, p2, p3];

        // Define the type for a player object *after* null checks
        type ValidPlayerData = { id: number; name: string; odds: number; sgTotal: number };

        // Filter out invalid players using a type predicate to narrow the type
        const validPlayers = playersInitial.filter(
            (p): p is ValidPlayerData => p.id != null && p.name != null
        );

        // Create PlayerWithProbability objects using the filtered, correctly typed players
        let groupPlayers: PlayerWithProbability[] = validPlayers
            .map(p => ({ // p here is now guaranteed to be ValidPlayerData (id is number)
                ...p,
                impliedProbability: decimalToImpliedProbability(americanToDecimal(p.odds)),
                valueRating: 0,
                confidenceScore: 0,
                isRecommended: false
            }));

        // Need 3 valid players for a 3-ball matchup calculation
        if (groupPlayers.length !== 3) {
            console.warn(`Matchup ID ${row.id} does not have 3 valid players. Skipping scoring.`);
            return {
                id: String(row.id),
                group: `Event: ${row.event_name || 'N/A'}, Round: ${row.round_num || 'N/A'}`,
                bookmaker: selectedBookmaker,
                players: [], // Return empty players array
                recommended: "",
            };
        }

        // Calculate scores for each player
        groupPlayers = groupPlayers.map(player => {
            const scores = calculateScore(player, groupPlayers);
            return { ...player, ...scores };
        });

        // Determine Recommended Player (highest confidence score)
        let recommendedPlayerName = "";
        const sortedPlayers = [...groupPlayers].sort((a, b) => b.confidenceScore - a.confidenceScore);

        if (sortedPlayers.length > 0) {
            const recommendedPlayer = sortedPlayers[0];
            recommendedPlayerName = recommendedPlayer.name;
            // Mark the recommended player
            groupPlayers = groupPlayers.map(p => ({
                ...p,
                isRecommended: p.id === recommendedPlayer.id,
            }));
        }

        // Final Player objects (remove internal probability)
        const finalPlayers: Player[] = groupPlayers.map(({ impliedProbability, ...rest }) => rest);

        return {
            id: String(row.id),
            group: `Matchup ${row.id}`, // Simple group name
            bookmaker: selectedBookmaker,
            players: finalPlayers,
            recommended: recommendedPlayerName,
        };
    })
    .filter(m => m.recommended !== ""); // Keep filtering matchups without recommendations

    console.log(`Processed ${processedMatchups.length} matchups successfully.`);
    return { matchups: processedMatchups };

  } catch (error) {
    console.error("Error processing matchups:", error);
    return { matchups: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// TODO: Refactor getTopGolfers
// The existing getTopGolfers logic needs to be updated.
// It currently sorts by raw SG and fetches potentially unrelated matchup data.
// The correct approach would likely involve:
// 1. Calling the updated getMatchups() action.
// 2. Extracting *all* recommended players (or all players with scores).
// 3. Sorting these players based on their calculated confidenceScore or valueRating.
// 4. Applying the limit and mapping to the required TopGolfer format.
export async function getTopGolfers(matchupType: string, activeFilter: string, limit = 10) {
     console.warn("getTopGolfers action is not yet implemented with dynamic scoring and returns placeholder data.");
     // Placeholder implementation
     return { topGolfers: [], error: "getTopGolfers not implemented with new logic yet." };
}

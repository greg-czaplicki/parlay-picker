"use server"

import { createServerClient } from "@/lib/supabase";
import { LiveTournamentStat } from "@/types/definitions";

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

// Define interface for the raw row structure from latest_two_ball_matchups
interface LatestTwoBallMatchupRow {
    id: number;
    event_name: string | null;
    round_num: number | null;
    p1_dg_id: number | null;
    p1_player_name: string | null;
    p2_dg_id: number | null;
    p2_player_name: string | null;
    // Add potential nulls for odds
    fanduel_p1_odds: number | string | null;
    fanduel_p2_odds: number | string | null;
    draftkings_p1_odds: number | string | null;
    draftkings_p2_odds: number | string | null;
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

// Interface for Parlays table
export interface Parlay {
    id: number;
    // user_id?: string; // If using auth
    name: string | null;
    created_at: string;
}

// Interface for ParlayPicks table (add parlay_id)
export interface ParlayPick {
    id: number;
    parlay_id: number;
    // user_id?: string; // If using auth
    picked_player_dg_id: number;
    picked_player_name: string;
    matchup_id: number | null;
    event_name: string | null;
    round_num: number | null;
    created_at: string;
}

// Type for returning grouped data
export interface ParlayWithPicks extends Parlay {
    picks: ParlayPick[];
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
 * Fetches matchups from the appropriate matchups table based on matchupType,
 * calculates player scores dynamically, and identifies recommendations based on SG Total and odds gap.
 * @param matchupType - Either "2ball" or "3ball" to specify the type of matchups to fetch
 * @param bookmaker - "fanduel" or "draftkings". Filters odds columns used.
 * @returns An object containing the list of processed matchups or an error message.
 */
export async function getMatchups(matchupType: string, bookmaker?: string): Promise<{ matchups: Matchup[]; error?: string }> {
  // Support both 2ball and 3ball matchup types
  if (matchupType !== '3ball' && matchupType !== '2ball') {
      console.warn(`getMatchups called with unsupported type ${matchupType}. Only '3ball' and '2ball' are supported.`);
      return { matchups: [], error: `Unsupported matchupType: ${matchupType}` };
  }

  // Default to draftkings if no bookmaker specified
  const selectedBookmaker = bookmaker === 'fanduel' ? 'fanduel' : 'draftkings';
  console.log(`Fetching ${matchupType} matchups using ${selectedBookmaker} odds.`);

  const supabase = createServerClient();

  try {
    let matchupRows: LatestThreeBallMatchupRow[] | LatestTwoBallMatchupRow[] = [];
    let matchupsError: any = null;
    
    // Different handling based on matchup type
    if (matchupType === '3ball') {
      // Handle 3-ball matchups
      const response = await supabase
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
        
      matchupRows = response.data || [];
      matchupsError = response.error;
    } else {
      // Handle 2-ball matchups
      const response = await supabase
        .from('latest_two_ball_matchups')
        .select(`
          id,
          event_name,
          round_num,
          p1_dg_id, p1_player_name,
          p2_dg_id, p2_player_name,
          fanduel_p1_odds, fanduel_p2_odds,
          draftkings_p1_odds, draftkings_p2_odds
        `)
        .returns<LatestTwoBallMatchupRow[]>();
        
      matchupRows = response.data || [];
      matchupsError = response.error;
    }

    if (matchupsError) {
      console.error(`Supabase error fetching latest_${matchupType}_matchups:`, matchupsError);
      throw new Error(`Error fetching matchups: ${matchupsError.message}`);
    }
    
    if (!matchupRows || matchupRows.length === 0) {
      console.log(`No matchup data returned from latest_${matchupType}_matchups.`);
      return { matchups: [] };
    }

    // 2. Get Unique Player IDs from all players in the fetched matchups
    let playerIds: number[];
    if (matchupType === '3ball') {
      playerIds = [
        ...new Set(
          (matchupRows as LatestThreeBallMatchupRow[]).flatMap(row => [row.p1_dg_id, row.p2_dg_id, row.p3_dg_id])
                     .filter((id): id is number => id != null) // Ensure IDs are numbers and not null
        ),
      ];
    } else {
      playerIds = [
        ...new Set(
          (matchupRows as LatestTwoBallMatchupRow[]).flatMap(row => [row.p1_dg_id, row.p2_dg_id])
                     .filter((id): id is number => id != null) // Ensure IDs are numbers and not null
        ),
      ];
    }

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
        // Define the type for a player object *after* null checks
        type ValidPlayerData = { id: number; name: string; odds: number; sgTotal: number };
        
        // Initialize players array based on matchup type
        let playersInitial: any[] = [];
        let expectedPlayerCount = 0;
        
        if (matchupType === '3ball') {
            const typedRow = row as LatestThreeBallMatchupRow;
            // Safely access odds using the known keys based on selectedBookmaker
            const oddsP1Key = `${selectedBookmaker}_p1_odds` as keyof LatestThreeBallMatchupRow;
            const oddsP2Key = `${selectedBookmaker}_p2_odds` as keyof LatestThreeBallMatchupRow;
            const oddsP3Key = `${selectedBookmaker}_p3_odds` as keyof LatestThreeBallMatchupRow;

            const p1 = {
                id: typedRow.p1_dg_id,
                name: typedRow.p1_player_name,
                odds: Number(typedRow[oddsP1Key]) || 0,
                sgTotal: playerStatsMap.get(typedRow.p1_dg_id!)?.sgTotal ?? 0
            };
            const p2 = {
                id: typedRow.p2_dg_id,
                name: typedRow.p2_player_name,
                odds: Number(typedRow[oddsP2Key]) || 0,
                sgTotal: playerStatsMap.get(typedRow.p2_dg_id!)?.sgTotal ?? 0
            };
            const p3 = {
                id: typedRow.p3_dg_id,
                name: typedRow.p3_player_name,
                odds: Number(typedRow[oddsP3Key]) || 0,
                sgTotal: playerStatsMap.get(typedRow.p3_dg_id!)?.sgTotal ?? 0
            };
            
            playersInitial = [p1, p2, p3];
            expectedPlayerCount = 3;
        } else {
            const typedRow = row as LatestTwoBallMatchupRow;
            // Safely access odds for 2ball
            const oddsP1Key = `${selectedBookmaker}_p1_odds` as keyof LatestTwoBallMatchupRow;
            const oddsP2Key = `${selectedBookmaker}_p2_odds` as keyof LatestTwoBallMatchupRow;

            const p1 = {
                id: typedRow.p1_dg_id,
                name: typedRow.p1_player_name,
                odds: Number(typedRow[oddsP1Key]) || 0,
                sgTotal: playerStatsMap.get(typedRow.p1_dg_id!)?.sgTotal ?? 0
            };
            const p2 = {
                id: typedRow.p2_dg_id,
                name: typedRow.p2_player_name,
                odds: Number(typedRow[oddsP2Key]) || 0,
                sgTotal: playerStatsMap.get(typedRow.p2_dg_id!)?.sgTotal ?? 0
            };
            
            playersInitial = [p1, p2];
            expectedPlayerCount = 2;
        }

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

        // Need expected number of valid players for a matchup calculation
        if (groupPlayers.length !== expectedPlayerCount) {
            console.warn(`Matchup ID ${row.id} does not have ${expectedPlayerCount} valid players. Skipping scoring.`);
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

// --- Server Action: findPlayerMatchup ---

// Define the return type for the matchup data
export type PlayerMatchupData = LatestThreeBallMatchupRow | null;

/**
 * Finds the absolute latest 3-ball matchup containing a given player name across all events,
 * attempting to match "First Last" input against "Last, First" database format.
 * @param playerName - The name of the player to search for (ideally "Firstname Lastname").
 * @returns The matchup row if found, otherwise null. Includes an error string if applicable.
 */
export async function findPlayerMatchup(playerName: string): Promise<{ matchup: PlayerMatchupData; error?: string }> {
    console.log(`[findPlayerMatchup] Searching for player: '${playerName}'`);
    
    let patterns = [];
    const originalPattern = `%${playerName.trim()}%`;
    patterns.push(originalPattern);
    
    // Try multiple name formats for better matching
    const nameParts = playerName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
        // Case 1: Last, First format
        const lastName = nameParts.pop();
        const firstName = nameParts.join(' ');
        patterns.push(`%${lastName}, ${firstName}%`);
        
        // Case 2: First Last format (reverse of above)
        patterns.push(`%${firstName} ${lastName}%`);
        
        // Case 3: Last First (no comma)
        patterns.push(`%${lastName} ${firstName}%`);
    }
    
    console.log(`[findPlayerMatchup] Search patterns: ${patterns.join(', ')}`);
    
    // Build the OR query for all patterns
    const orFilterString = patterns
        .map(pattern => 
            `p1_player_name.ilike."${pattern}",p2_player_name.ilike."${pattern}",p3_player_name.ilike."${pattern}"`)
        .join(',');

    const supabase = createServerClient();
    try {
        // First, try to find matchup in round 2 (current round)
        // Try to find a round 2 matchup first
        const { data: round2Matchup, error: round2MatchupError } = await supabase
            .from('latest_three_ball_matchups')
            .select('*')
            .or(orFilterString)
            .eq('round_num', 2) // Specifically look for Round 2 matchups
            .order('data_golf_update_time', { ascending: false })
            .limit(1)
            .maybeSingle<LatestThreeBallMatchupRow>();
            
        // If we found a round 2 matchup, return it
        if (round2Matchup && !round2MatchupError) {
            console.log(`[findPlayerMatchup] Found round 2 matchup for ${playerName}`);
            return { matchup: round2Matchup };
        }
        
        // If not round 2, try looking for the player in any 3-ball matchup
        console.log(`[findPlayerMatchup] No round 2 matchup found, searching any round for ${playerName}`);
        const { data: matchup, error: matchupError } = await supabase
            .from('latest_three_ball_matchups')
            .select('*')
            .or(orFilterString)
            .order('data_golf_update_time', { ascending: false })
            .limit(1)
            .maybeSingle<LatestThreeBallMatchupRow>();
        
        // Try the historical three ball matchups table if latest table is empty
        if (!matchup && !matchupError) {
            console.log(`[findPlayerMatchup] No matchup in latest_three_ball_matchups, trying three_ball_matchups for ${playerName}`);
            const { data: historicalMatchup, error: historicalError } = await supabase
                .from('three_ball_matchups')
                .select('*')
                .or(orFilterString)
                .order('data_golf_update_time', { ascending: false })
                .limit(1)
                .maybeSingle<LatestThreeBallMatchupRow>();
                
            if (historicalMatchup && !historicalError) {
                console.log(`[findPlayerMatchup] Found historical 3-ball matchup for ${playerName}`);
                return { matchup: historicalMatchup };
            }
        }

        // If that still doesn't work, try 2-ball matchups
        if (!matchup && !matchupError) {
            console.log(`[findPlayerMatchup] No 3-ball matchup found, trying 2-ball for ${playerName}`);
            const { data: twoBallMatchup, error: twoBallError } = await supabase
                .from('latest_two_ball_matchups')
                .select('*')
                .or(`p1_player_name.ilike."${originalPattern}",p2_player_name.ilike."${originalPattern}"`)
                .order('data_golf_update_time', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            if (twoBallMatchup && !twoBallError) {
                // Convert 2ball to 3ball format for compatibility
                const converted: LatestThreeBallMatchupRow = {
                    ...twoBallMatchup,
                    p3_player_name: null,
                    p3_dg_id: null,
                    fanduel_p3_odds: null,
                    draftkings_p3_odds: null
                };
                console.log(`[findPlayerMatchup] Found 2-ball matchup for ${playerName}`);
                return { matchup: converted };
            }
            
            // Try the historical two ball matchups as a last resort
            const { data: historicalTwoBall, error: historicalTwoBallError } = await supabase
                .from('two_ball_matchups')
                .select('*')
                .or(`p1_player_name.ilike."${originalPattern}",p2_player_name.ilike."${originalPattern}"`)
                .order('data_golf_update_time', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            if (historicalTwoBall && !historicalTwoBallError) {
                // Convert 2ball to 3ball format for compatibility
                const converted: LatestThreeBallMatchupRow = {
                    ...historicalTwoBall,
                    p3_player_name: null,
                    p3_dg_id: null,
                    fanduel_p3_odds: null,
                    draftkings_p3_odds: null
                };
                console.log(`[findPlayerMatchup] Found historical 2-ball matchup for ${playerName}`);
                return { matchup: converted };
            }
        }

        if (matchupError) {
            console.error(`[findPlayerMatchup] Supabase error finding latest matchup:`, matchupError);
            throw new Error(`Database error finding matchup: ${matchupError.message}`);
        }

        if (!matchup) {
            console.log(`[findPlayerMatchup] No 3-ball or 2-ball matchup found for ${playerName}`);
            return { matchup: null };
        } else {
            console.log(`[findPlayerMatchup] Found matchup for ${playerName}`);
        }
        return { matchup };
    } catch (error) {
        console.error(`[findPlayerMatchup] Error during execution for ${playerName}:`, error); // KEEP
        return { matchup: null, error: error instanceof Error ? error.message : "Unknown error finding player matchup" };
    }
}

// --- Server Action: getLiveStatsForPlayers ---

/**
 * Fetches the latest live tournament stats for a given list of player IDs.
 * @param playerIds - An array of player dg_id values.
 * @returns An object containing an array of stats or an error message.
 */
export async function getLiveStatsForPlayers(
    playerIds: number[]
): Promise<{ stats: LiveTournamentStat[]; error?: string }> {
    if (!playerIds || playerIds.length === 0) {
        return { stats: [] };
    }
    console.log(`[getLiveStatsForPlayers] Fetching live stats for ${playerIds.length} player IDs:`, playerIds);
    const supabase = createServerClient();

    try {
        // Try to get specifically round 2 stats for the current tournament (no event_name filter)
        const { data: round2Stats, error: round2Error } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .eq('round_num', '2') // Explicitly fetch Round 2 stats
            .returns<LiveTournamentStat[]>();
        
        if (round2Stats && round2Stats.length > 0) {
            return { stats: round2Stats };
        }
        
        // Try to get Round 1 stats (no event_name filter)
        const { data: round1Stats, error: round1Error } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .eq('round_num', '1') // Try Round 1 stats
            .returns<LiveTournamentStat[]>();
        
        if (round1Stats && round1Stats.length > 0) {
            return { stats: round1Stats };
        }
        
        // If we don't find stats for the current round, get any stats for these players
        const { data, error } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .order('data_golf_updated_at', { ascending: false }) // Get most recent stats first
            .returns<LiveTournamentStat[]>();

        if (error) {
            console.error(`[getLiveStatsForPlayers] Supabase error fetching live stats for IDs [${playerIds.join(', ')}]:`, error); // KEEP
            throw new Error(`Database error fetching live stats: ${error.message}`);
        }

        return { stats: data || [] };

    } catch (error) {
        console.error(`[getLiveStatsForPlayers] Error during execution for IDs [${playerIds.join(', ')}]:`, error); // KEEP
        return { stats: [], error: error instanceof Error ? error.message : "Unknown error fetching live stats" };
    }
}

// --- Server Actions for Parlays and Picks ---

/**
 * Creates a new parlay.
 * @param name - Optional name for the parlay.
 * @returns An object containing the newly created parlay or an error message.
 */
// Helper function to invalidate the parlays cache
function invalidateParlaysCache() {
    parlaysCache = {
        data: null,
        timestamp: 0
    };
    console.log("[matchups] Parlays cache invalidated");
}

export async function createParlay(name?: string): Promise<{ parlay: Parlay | null; error?: string }> {
    console.log("[createParlay] Creating new parlay...");
    const supabase = createServerClient();
    try {
        // TODO: Add user_id if auth is implemented
        const { data, error } = await supabase
            .from('parlays')
            .insert([{ name: name /* , user_id: userId */ }])
            .select()
            .single();

        if (error) {
            console.error("[createParlay] Supabase error:", error);
            throw new Error(`Database error creating parlay: ${error.message}`);
        }
        
        // Invalidate cache since we've created a new parlay
        invalidateParlaysCache();
        
        console.log("[createParlay] Successfully created parlay ID:", data?.id);
        return { parlay: data as Parlay };
    } catch (error) {
        console.error("[createParlay] Error:", error);
        return { parlay: null, error: error instanceof Error ? error.message : "Unknown error creating parlay" };
    }
}

/**
 * Fetches all parlays and their associated picks.
 * (Assumes no user authentication for now - fetches all rows)
 * @returns An object containing an array of parlays with nested picks or an error message.
 */
// Simple in-memory cache for parlays
let parlaysCache: {
    data: ParlayWithPicks[] | null;
    timestamp: number;
} = {
    data: null,
    timestamp: 0
};

// Cache expiration time (10 seconds)
const CACHE_TTL = 10 * 1000;

export async function getParlaysAndPicks(): Promise<{ parlays: ParlayWithPicks[]; error?: string }> {
    // Check if we have fresh cached data (less than 10 seconds old)
    const now = Date.now();
    if (parlaysCache.data && now - parlaysCache.timestamp < CACHE_TTL) {
        console.log(`[getParlaysAndPicks] Using cached data from ${new Date(parlaysCache.timestamp).toLocaleTimeString()}`);
        return { parlays: parlaysCache.data };
    }
    
    console.log("[getParlaysAndPicks] Fetching all parlays and picks...");
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        // Use Supabase join query, aliasing the joined table to match the interface
        const { data, error } = await supabase
            .from('parlays')
            .select(`
                *,
                picks:parlay_picks (*)
            `)
            .order('created_at', { ascending: true }) // Order parlays by creation time
            // Optionally order picks within each parlay
            // .order('created_at', { foreignTable: 'parlay_picks', ascending: true })
            .returns<ParlayWithPicks[]>();

        if (error) {
            console.error("[getParlaysAndPicks] Supabase error fetching data:", error);
            throw new Error(`Database error fetching parlays and picks: ${error.message}`);
        }
        
        // Update the cache
        parlaysCache = {
            data: data || [],
            timestamp: now
        };
        
        console.log(`[getParlaysAndPicks] Successfully fetched ${data?.length ?? 0} parlays with picks.`);
        // Now the data should correctly contain a 'picks' array
        return { parlays: data || [] };
    } catch (error) {
        console.error("[getParlaysAndPicks] Error:", error);
        return { parlays: [], error: error instanceof Error ? error.message : "Unknown error fetching data" };
    }
}

/**
 * Adds a new parlay pick to the database, linked to a specific parlay.
 * @param pickData - Object containing the pick details, including parlay_id.
 * @returns An object containing the newly added pick or an error message.
 */
export async function addParlayPick(pickData: Omit<ParlayPick, 'id' | 'created_at'>): Promise<{ pick: ParlayPick | null; error?: string }> {
    console.log("[addParlayPick] Adding pick:", pickData);
    if (!pickData.parlay_id) {
         return { pick: null, error: "parlay_id is required to add a pick." };
    }
    const supabase = createServerClient();
    try {
        // TODO: Add user_id if auth is implemented
        // Ensure consistency check if using auth (user owns the target parlay_id)
        const { data, error } = await supabase
            .from('parlay_picks')
            .insert([{
                parlay_id: pickData.parlay_id,
                // user_id: userId, // If using auth
                picked_player_dg_id: pickData.picked_player_dg_id,
                picked_player_name: pickData.picked_player_name,
                matchup_id: pickData.matchup_id,
                event_name: pickData.event_name,
                round_num: pickData.round_num,
            }])
            .select()
            .single(); // Expecting one row back

        if (error) {
            console.error("[addParlayPick] Supabase error inserting pick:", error);
            throw new Error(`Database error adding pick: ${error.message}`);
        }
        
        // Invalidate cache since we've added a pick
        invalidateParlaysCache();
        
        console.log("[addParlayPick] Successfully added pick ID:", data?.id);
        return { pick: data as ParlayPick };
    } catch (error) {
        console.error("[addParlayPick] Error:", error);
        return { pick: null, error: error instanceof Error ? error.message : "Unknown error adding pick" };
    }
}

/**
 * Removes a parlay pick from the database by its unique ID.
 * @param pickId - The ID of the pick to remove.
 * @returns An object indicating success or containing an error message.
 */
export async function removeParlayPick(pickId: number): Promise<{ success: boolean; error?: string }> {
    console.log(`[removeParlayPick] Removing pick ID: ${pickId}`);
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        const { error } = await supabase
            .from('parlay_picks')
            .delete()
            .eq('id', pickId);

        if (error) {
            console.error(`[removeParlayPick] Supabase error removing pick ID ${pickId}:`, error);
            throw new Error(`Database error removing pick: ${error.message}`);
        }
        
        // Invalidate cache since we've removed a pick
        invalidateParlaysCache();
        
        console.log(`[removeParlayPick] Successfully removed pick ID: ${pickId}`);
        return { success: true };
    } catch (error) {
        console.error(`[removeParlayPick] Error for ID ${pickId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error removing pick" };
    }
}

/**
 * Batch loads matchup data and live stats for a collection of parlay picks.
 * This helps avoid the waterfall effect of loading data for individual picks.
 */
export type ParlayPickWithData = {
    pick: ParlayPick;
    matchup: PlayerMatchupData | null;
    liveStats: Record<number, LiveTournamentStat> | null;
    matchupError?: string;
    statsError?: string;
};

export async function batchLoadParlayPicksData(
    picks: ParlayPick[]
): Promise<{ picksWithData: ParlayPickWithData[]; error?: string }> {
    console.log(`[batchLoadParlayPicksData] Loading data for ${picks.length} picks`);
    
    if (!picks || picks.length === 0) {
        return { picksWithData: [] };
    }
    
    try {
        const picksWithData: ParlayPickWithData[] = [];
        
        // Process each pick sequentially to avoid rate limits
        for (const pick of picks) {
            let pickResult: ParlayPickWithData = {
                pick,
                matchup: null,
                liveStats: null
            };
            
            // 1. Find matchup for this pick
            const { matchup, error: matchupError } = await findPlayerMatchup(pick.picked_player_name);
            pickResult.matchup = matchup;
            pickResult.matchupError = matchupError;
            
            // 2. If we have a matchup, get the stats
            if (matchup) {
                const playerIds = [
                    matchup.p1_dg_id,
                    matchup.p2_dg_id,
                    matchup.p3_dg_id,
                ].filter((id): id is number => id !== null);
                
                if (playerIds.length > 0) {
                    const { stats, error: statsError } = await getLiveStatsForPlayers(playerIds);
                    
                    // Convert stats array to map for easy lookup
                    // Group stats by player ID - prioritize round 2 stats
                    const statsMap: Record<number, LiveTournamentStat> = {};
                    
                    // First look for round 2 stats for each player
                    (stats || []).forEach(stat => {
                        if (stat.dg_id && String(stat.round_num) === '2') {
                            statsMap[stat.dg_id] = stat;
                        }
                    });
                    
                    // Fill in any players without round 2 stats
                    (stats || []).forEach(stat => {
                        if (stat.dg_id && !statsMap[stat.dg_id]) {
                            statsMap[stat.dg_id] = stat;
                        }
                    });
                    
                    pickResult.liveStats = statsMap;
                    pickResult.statsError = statsError;
                }
            }
            
            picksWithData.push(pickResult);
        }
        
        console.log(`[batchLoadParlayPicksData] Successfully loaded data for ${picksWithData.length} picks`);
        return { picksWithData };
    } catch (error) {
        console.error(`[batchLoadParlayPicksData] Error:`, error);
        return { 
            picksWithData: [], 
            error: error instanceof Error ? error.message : "Error loading parlay picks data" 
        };
    }
}

// Action to delete a parlay (will cascade delete all its picks)
export async function deleteParlay(parlayId: number): Promise<{ success: boolean; error?: string }> {
    console.log(`[deleteParlay] Deleting parlay ID: ${parlayId}`);
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        const { error } = await supabase
            .from('parlays')
            .delete()
            .eq('id', parlayId);

        if (error) {
            console.error(`[deleteParlay] Supabase error deleting parlay ID ${parlayId}:`, error);
            throw new Error(`Database error deleting parlay: ${error.message}`);
        }
        
        // Invalidate cache since we've deleted a parlay
        invalidateParlaysCache();
        
        console.log(`[deleteParlay] Successfully deleted parlay ID: ${parlayId}`);
        return { success: true };
    } catch (error) {
        console.error(`[deleteParlay] Error for ID ${parlayId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error deleting parlay" };
    }
}
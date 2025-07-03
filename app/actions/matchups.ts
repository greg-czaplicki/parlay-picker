"use server"

import { createServerClient } from "@/lib/supabase";
import { LiveTournamentStat } from "@/types/definitions";
import { logger } from '@/lib/logger'
import { snapshotService } from '@/lib/snapshot-service'

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
    id: number; // Primary key is integer
    user_id: string;
    created_at: string;
    // ML fields - using proper ENUM types
    outcome: 'win' | 'loss' | 'push' | null;
    payout_amount: string | null; // NUMERIC as string for precision
}

// Interface for ParlayPicks table 
export interface ParlayPick {
    id: number; // Primary key is integer
    parlay_id: number; // Foreign key to parlays.id
    matchup_id: number; // Foreign key to matchups.id
    pick: number; // Player position (1, 2, or 3)
    created_at: string;
    // ML fields - using proper ENUM types
    outcome: 'win' | 'loss' | 'push' | 'void' | null;
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
 * Fetches matchups from the unified matchups table based on matchupType,
 * calculates player scores dynamically, and identifies recommendations based on SG Total and odds gap.
 * @param matchupType - Either "2ball" or "3ball" to specify the type of matchups to fetch
 * @param bookmaker - "fanduel" or "draftkings". Filters odds columns used.
 * @returns An object containing the list of processed matchups or an error message.
 */
export async function getMatchups(matchupType: string, bookmaker?: string): Promise<{ matchups: Matchup[]; error?: string }> {
  // Support both 2ball and 3ball matchup types
  if (matchupType !== '3ball' && matchupType !== '2ball') {
      logger.info(`getMatchups called with unsupported type ${matchupType}. Only '3ball' and '2ball' are supported.`);
      return { matchups: [], error: `Unsupported matchupType: ${matchupType}` };
  }

  // Default to draftkings if no bookmaker specified
  const selectedBookmaker = bookmaker === 'fanduel' ? 'fanduel' : 'draftkings';
  logger.info(`Fetching ${matchupType} matchups using ${selectedBookmaker} odds.`);

  const supabase = createServerClient();

  try {
    let matchupRows: any[] = [];
    let matchupsError: any = null;
    // Unified query for both 2ball and 3ball
    const response = await supabase
      .from('matchups_v2')
      .select('*')
      .eq('type', matchupType)
      .order('created_at', { ascending: false });
    matchupRows = response.data || [];
    matchupsError = response.error;

    if (matchupsError) {
      logger.error(`Supabase error fetching matchups:`, matchupsError);
      throw new Error(`Error fetching matchups: ${matchupsError.message}`);
    }
    if (!matchupRows || matchupRows.length === 0) {
      logger.info(`No matchup data returned from matchups table.`);
      return { matchups: [] };
    }

    // 2. Get Unique Player IDs from all players in the fetched matchups
    let playerIds: number[];
    if (matchupType === '3ball') {
      playerIds = [
        ...new Set(
          matchupRows.flatMap(row => [row.player1_dg_id, row.player2_dg_id, row.player3_dg_id])
                     .filter((id): id is number => id != null)
        ),
      ];
    } else {
      playerIds = [
        ...new Set(
          matchupRows.flatMap(row => [row.player1_dg_id, row.player2_dg_id])
                     .filter((id): id is number => id != null)
        ),
      ];
    }
    if (playerIds.length === 0) {
        logger.info("No valid player IDs found in fetched matchups.");
        return { matchups: [] };
    }

    // 3. Fetch Player Stats (SG Total for now)
    const { data: playerStatsData, error: statsError } = await supabase
      .from("player_stats")
      .select("player_id, sg_total")
      .in("player_id", playerIds);

    if (statsError) {
      logger.error("Supabase error fetching player stats:", statsError);
      // Decide how to handle missing stats - here we'll default to 0
    }

    // Create a map for quick stat lookup (Player ID -> { sgTotal: number })
    const playerStatsMap = new Map<number, { sgTotal: number }>();
    playerStatsData?.forEach(ps => {
        if (ps.player_id != null) {
            playerStatsMap.set(ps.player_id, { sgTotal: Number(ps.sg_total) || 0 });
        }
    });

    // Map to processed matchups (update field names as needed)
    const processedMatchups: Matchup[] = matchupRows.map((row) => {
      let playersInitial: any[] = [];
      let expectedPlayerCount = 0;
      if (matchupType === '3ball') {
        // Use new unified schema
        const p1 = {
          id: row.player1_dg_id,
          name: row.player1_name,
          odds: Number(row[`${selectedBookmaker}_p1_odds`]) || 0,
          sgTotal: playerStatsMap.get(row.player1_dg_id)?.sgTotal ?? 0
        };
        const p2 = {
          id: row.player2_dg_id,
          name: row.player2_name,
          odds: Number(row[`${selectedBookmaker}_p2_odds`]) || 0,
          sgTotal: playerStatsMap.get(row.player2_dg_id)?.sgTotal ?? 0
        };
        const p3 = {
          id: row.player3_dg_id,
          name: row.player3_name,
          odds: Number(row[`${selectedBookmaker}_p3_odds`]) || 0,
          sgTotal: playerStatsMap.get(row.player3_dg_id)?.sgTotal ?? 0
        };
        playersInitial = [p1, p2, p3];
        expectedPlayerCount = 3;
      } else {
        // 2ball
        const p1 = {
          id: row.player1_dg_id,
          name: row.player1_name,
          odds: Number(row[`${selectedBookmaker}_p1_odds`]) || 0,
          sgTotal: playerStatsMap.get(row.player1_dg_id)?.sgTotal ?? 0
        };
        const p2 = {
          id: row.player2_dg_id,
          name: row.player2_name,
          odds: Number(row[`${selectedBookmaker}_p2_odds`]) || 0,
          sgTotal: playerStatsMap.get(row.player2_dg_id)?.sgTotal ?? 0
        };
        playersInitial = [p1, p2];
        expectedPlayerCount = 2;
      }
      // ...rest of your logic for recommendations, etc.
      // Return the processed matchup object
      return {
        ...row,
        players: playersInitial,
        expectedPlayerCount,
      };
    });

    return { matchups: processedMatchups };
  } catch (err: any) {
    logger.error('Error in getMatchups:', err);
    return { matchups: [], error: err.message };
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
     logger.warn("getTopGolfers action is not yet implemented with dynamic scoring and returns placeholder data.");
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
export async function findPlayerMatchup(playerName: string): Promise<{ matchup: any & { opponents?: string[] }; error?: string }> {
    logger.info(`[findPlayerMatchup] Searching for player: '${playerName}'`);
    let patterns = [];
    const originalPattern = `%${playerName.trim()}%`;
    patterns.push(originalPattern);
    // Try multiple name formats for better matching
    const nameParts = playerName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
        const lastName = nameParts.pop();
        const firstName = nameParts.join(' ');
        patterns.push(`%${lastName}, ${firstName}%`);
        patterns.push(`%${firstName} ${lastName}%`);
        patterns.push(`%${lastName} ${firstName}%`);
    }
    const supabase = createServerClient();
    try {
        // Search for 3ball matchups first
        const { data: matchups, error: matchupError } = await supabase
            .from('matchups_v2')
            .select('*')
            .or(patterns.map(p => `player1_name.ilike."${p}",player2_name.ilike."${p}",player3_name.ilike."${p}"`).join(","))
            .eq('type', '3ball')
            .order('created_at', { ascending: false })
            .limit(1);
        let matchup = matchups && matchups.length > 0 ? matchups[0] : null;
        if (!matchup && !matchupError) {
            // Try 2ball matchups
            const { data: twoBallMatchups, error: twoBallError } = await supabase
                .from('matchups_v2')
                .select('*')
                .or(patterns.map(p => `player1_name.ilike."${p}",player2_name.ilike."${p}"`).join(","))
                .eq('type', '2ball')
                .order('created_at', { ascending: false })
                .limit(1);
            matchup = twoBallMatchups && twoBallMatchups.length > 0 ? twoBallMatchups[0] : null;
        }
        if (!matchup && matchupError) {
            logger.error(`[findPlayerMatchup] Supabase error finding latest matchup:`, matchupError);
            throw new Error(`Database error finding matchup: ${matchupError.message}`);
        }
        if (!matchup) {
            logger.info(`[findPlayerMatchup] No 3-ball or 2-ball matchup found for ${playerName}`);
            return { matchup: null, error: "No matchup found for the given player" };
        } else {
            logger.info(`[findPlayerMatchup] Found matchup for ${playerName}`);
        }
        // Add opponents field
        const allNames = [matchup.player1_name, matchup.player2_name, matchup.player3_name].filter(Boolean);
        const opponents = allNames.filter((n: string) => n && n.toLowerCase() !== playerName.toLowerCase());
        return { matchup: { ...matchup, opponents }, error: undefined };
    } catch (error) {
        logger.error(`[findPlayerMatchup] Error during execution for ${playerName}:`, error);
        return { matchup: null, error: error instanceof Error ? error.message : "Unknown error finding player matchup" };
    }
}

// --- Server Action: getLiveStatsForPlayers ---

/**
 * Fetches the latest live tournament stats for a given list of player IDs and optional round number.
 * @param playerIds - An array of player dg_id values.
 * @param roundNum - Optional round number to filter stats by.
 * @returns An object containing an array of stats or an error message.
 */
export async function getLiveStatsForPlayers(
    playerIds: number[],
    roundNum?: number | null
): Promise<{ stats: LiveTournamentStat[]; error?: string }> {
    if (!playerIds || playerIds.length === 0) {
        return { stats: [] };
    }
    logger.info(`[getLiveStatsForPlayers] Fetching live stats for ${playerIds.length} player IDs:`, playerIds, roundNum ? `roundNum=${roundNum}` : '');
    const supabase = createServerClient();

    try {
        if (roundNum) {
            // Try to get stats for the requested round
            const { data: roundStats, error: roundError } = await supabase
                .from('live_tournament_stats')
                .select('*')
                .in('dg_id', playerIds)
                .eq('round_num', String(roundNum))
                .returns<LiveTournamentStat[]>();
            if (roundStats && roundStats.length > 0) {
                return { stats: roundStats };
            }
        }
        // Fallback: Try round 2, then round 1, then any stats
        const { data: round2Stats } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .eq('round_num', '2')
            .returns<LiveTournamentStat[]>();
        if (round2Stats && round2Stats.length > 0) {
            return { stats: round2Stats };
        }
        const { data: round1Stats } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .eq('round_num', '1')
            .returns<LiveTournamentStat[]>();
        if (round1Stats && round1Stats.length > 0) {
            return { stats: round1Stats };
        }
        // If we don't find stats for the current round, get any stats for these players
        const { data, error } = await supabase
            .from('live_tournament_stats')
            .select('*')
            .in('dg_id', playerIds)
            .order('data_golf_updated_at', { ascending: false })
            .returns<LiveTournamentStat[]>();
        if (error) {
            logger.error(`[getLiveStatsForPlayers] Supabase error fetching live stats for IDs [${playerIds.join(', ')}]:`, error);
            throw new Error(`Database error fetching live stats: ${error.message}`);
        }
        return { stats: data || [] };
    } catch (error) {
        logger.error(`[getLiveStatsForPlayers] Error during execution for IDs [${playerIds.join(', ')}]:`, error);
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
    logger.info("[matchups] Parlays cache invalidated");
}

export async function createParlay(name?: string): Promise<{ parlay: Parlay | null; error?: string }> {
    logger.info("[createParlay] Creating new parlay...");
    const supabase = createServerClient();
    try {
        // TODO: Add user_id if auth is implemented
        const { data, error } = await supabase
            .from('parlays_v2')
            .insert([{ 
                name: name /* , user_id: userId */,
                outcome: 'push',
                payout_amount: '0.00',
            }])
            .select()
            .single();

        if (error) {
            logger.error("[createParlay] Supabase error:", error);
            throw new Error(`Database error creating parlay: ${error.message}`);
        }
        
        // Invalidate cache since we've created a new parlay
        invalidateParlaysCache();
        
        logger.info("[createParlay] Successfully created parlay ID:", data?.id);
        return { parlay: data as Parlay };
    } catch (error) {
        logger.error("[createParlay] Error:", error);
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
        logger.info(`[getParlaysAndPicks] Using cached data from ${new Date(parlaysCache.timestamp).toLocaleTimeString()}`);
        return { parlays: parlaysCache.data };
    }
    
    logger.info("[getParlaysAndPicks] Fetching all parlays and picks...");
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        // Use Supabase join query, aliasing the joined table to match the interface
        const { data, error } = await supabase
            .from('parlays_v2')
            .select(`
                *,
                picks:parlay_picks (*)
            `)
            .order('created_at', { ascending: true }) // Order parlays by creation time
            // Optionally order picks within each parlay
            // .order('created_at', { foreignTable: 'parlay_picks', ascending: true })
            .returns<ParlayWithPicks[]>();

        if (error) {
            logger.error("[getParlaysAndPicks] Supabase error fetching data:", error);
            throw new Error(`Database error fetching parlays and picks: ${error.message}`);
        }
        
        // Update the cache
        parlaysCache = {
            data: data || [],
            timestamp: now
        };
        
        logger.info(`[getParlaysAndPicks] Successfully fetched ${data?.length ?? 0} parlays with picks.`);
        // Now the data should correctly contain a 'picks' array
        return { parlays: data || [] };
    } catch (error) {
        logger.error("[getParlaysAndPicks] Error:", error);
        return { parlays: [], error: error instanceof Error ? error.message : "Unknown error fetching data" };
    }
}

/**
 * Adds a new parlay pick to the database, linked to a specific parlay.
 * @param pickData - Object containing the pick details, including parlay_id.
 * @returns An object containing the newly added pick or an error message.
 */
export async function addParlayPick(pickData: Omit<ParlayPick, 'id' | 'created_at'>): Promise<{ pick: ParlayPick | null; error?: string }> {
    logger.info("[addParlayPick] Adding pick:", pickData);
    if (!pickData.parlay_id) {
         return { pick: null, error: "parlay_id is required to add a pick." };
    }
    const supabase = createServerClient();
    try {
        const { data, error } = await supabase
            .from('parlay_picks_v2')
            .insert([{
                parlay_id: pickData.parlay_id,
                matchup_id: pickData.matchup_id,
                pick: pickData.pick,
                outcome: pickData.outcome || null,
            }])
            .select()
            .single(); // Expecting one row back

        if (error) {
            logger.error("[addParlayPick] Supabase error inserting pick:", error);
            throw new Error(`Database error adding pick: ${error.message}`);
        }
        
        // Invalidate cache since we've added a pick
        invalidateParlaysCache();
        
        // FEATURE SNAPSHOTTING: Capture comprehensive snapshot at bet time
        try {
            const snapshotResult = await snapshotService.captureSnapshot(
                data.id,           // parlay_pick_id
                pickData.matchup_id, // matchup_id
                pickData.pick        // picked_player_position (1, 2, or 3)
            );
            
            if (!snapshotResult.success) {
                logger.warn("[addParlayPick] Failed to capture snapshot:", snapshotResult.error);
                // Don't fail the pick creation, just log the warning
            } else {
                logger.info("[addParlayPick] Successfully captured feature snapshot for pick:", data.id);
            }
        } catch (snapshotError) {
            logger.error("[addParlayPick] Unexpected error during snapshot capture:", snapshotError);
            // Don't fail the pick creation for snapshot errors
        }
        
        logger.info("[addParlayPick] Successfully added pick ID:", data?.id);
        return { pick: data as ParlayPick };
    } catch (error) {
        logger.error("[addParlayPick] Error:", error);
        return { pick: null, error: error instanceof Error ? error.message : "Unknown error adding pick" };
    }
}

/**
 * Removes a parlay pick from the database by its unique ID.
 * @param pickId - The ID of the pick to remove.
 * @returns An object indicating success or containing an error message.
 */
export async function removeParlayPick(pickId: number): Promise<{ success: boolean; error?: string }> {
    logger.info(`[removeParlayPick] Removing pick ID: ${pickId}`);
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        const { error } = await supabase
            .from('parlay_picks_v2')
            .delete()
            .eq('id', pickId);

        if (error) {
            logger.error(`[removeParlayPick] Supabase error removing pick ID ${pickId}:`, error);
            throw new Error(`Database error removing pick: ${error.message}`);
        }
        
        // Invalidate cache since we've removed a pick
        invalidateParlaysCache();
        
        logger.info(`[removeParlayPick] Successfully removed pick ID: ${pickId}`);
        return { success: true };
    } catch (error) {
        logger.error(`[removeParlayPick] Error for ID ${pickId}:`, error);
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
    picks: ParlayPick[],
    roundNum?: number | null
): Promise<{ picksWithData: ParlayPickWithData[]; error?: string }> {
    logger.info(`[batchLoadParlayPicksData] Loading data for ${picks.length} picks`);
    
    if (!picks || picks.length === 0) {
        return { picksWithData: [] };
    }
    
    try {
        const picksWithData: ParlayPickWithData[] = [];
        const supabase = createServerClient();
        
        // Process each pick sequentially to avoid rate limits
        for (const pick of picks) {
            let pickResult: ParlayPickWithData = {
                pick,
                matchup: null,
                liveStats: null
            };
            
            // 1. Get the matchup data for this pick
            const { data: matchupData, error: matchupError } = await supabase
                .from('matchups_v2')
                .select('*')
                .eq('id', pick.matchup_id)
                .single();
                
            if (matchupError) {
                pickResult.matchupError = `Error fetching matchup: ${matchupError.message}`;
            } else if (matchupData) {
                pickResult.matchup = matchupData;
                
                // 2. Get player IDs from the matchup for stats lookup
                const playerIds = [
                    matchupData.player1_dg_id,
                    matchupData.player2_dg_id,
                    matchupData.player3_dg_id,
                ].filter((id): id is number => id !== null);
                
                if (playerIds.length > 0) {
                    const { stats, error: statsError } = await getLiveStatsForPlayers(playerIds, roundNum);
                    // Convert stats array to map for easy lookup
                    const statsMap: Record<number, LiveTournamentStat> = {};
                    // First look for requested round stats for each player
                    (stats || []).forEach(stat => {
                        if (stat.dg_id && String(stat.round_num) === String(roundNum ?? '2')) {
                            statsMap[stat.dg_id] = stat;
                        }
                    });
                    // Fill in any players without requested round stats
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
        
        logger.info(`[batchLoadParlayPicksData] Successfully loaded data for ${picksWithData.length} picks`);
        return { picksWithData };
    } catch (error) {
        logger.error(`[batchLoadParlayPicksData] Error:`, error);
        return { 
            picksWithData: [], 
            error: error instanceof Error ? error.message : "Error loading parlay picks data" 
        };
    }
}

// Action to delete a parlay (will cascade delete all its picks)
export async function deleteParlay(parlayId: number): Promise<{ success: boolean; error?: string }> {
    logger.info(`[deleteParlay] Deleting parlay ID: ${parlayId}`);
    const supabase = createServerClient();
    try {
        // TODO: Add user filter if auth is implemented e.g., .eq('user_id', userId)
        const { error } = await supabase
            .from('parlays_v2')
            .delete()
            .eq('id', parlayId);

        if (error) {
            logger.error(`[deleteParlay] Supabase error deleting parlay ID ${parlayId}:`, error);
            throw new Error(`Database error deleting parlay: ${error.message}`);
        }
        
        // Invalidate cache since we've deleted a parlay
        invalidateParlaysCache();
        
        logger.info(`[deleteParlay] Successfully deleted parlay ID: ${parlayId}`);
        return { success: true };
    } catch (error) {
        logger.error(`[deleteParlay] Error for ID ${parlayId}:`, error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error deleting parlay" };
    }
}
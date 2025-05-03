"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.storePlayerSeasonStats = storePlayerSeasonStats;
exports.mapPgaToDataGolfIds = mapPgaToDataGolfIds;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const player_matcher_1 = require("./player-matcher");
dotenv.config();
// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Service Role Key is missing in environment variables');
}
// Create Supabase client
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
/**
 * Store season-long player statistics in database
 *
 * @param playerStats Array of player statistics to store
 * @returns Object containing success status and counts
 */
async function storePlayerSeasonStats(playerStats) {
    try {
        console.log(`Processing ${playerStats.length} player stats for storage...`);
        // First delete existing records to ensure fresh data
        const { error: deleteError } = await supabase
            .from('player_season_stats')
            .delete()
            .neq('id', 0); // Delete all rows
        if (deleteError) {
            console.error('Error clearing player_season_stats table:', deleteError);
            return { success: false, error: deleteError.message };
        }
        // Map PGA players to DataGolf IDs
        console.log('Matching players to DataGolf IDs...');
        const pgaPlayersData = playerStats.map(player => ({
            playerId: player.playerId,
            playerName: player.playerName
        }));
        const playerMappings = await (0, player_matcher_1.matchPlayers)(pgaPlayersData);
        console.log(`Found mappings for ${playerMappings.size} players`);
        // Convert scraped stats to database format
        const dbFormatStats = playerStats.map(player => {
            // Skip players with no useful data or invalid names
            if (player.playerName === 'Measured Rounds' || player.playerName === '-') {
                return null;
            }
            // Get DataGolf ID if available
            const dgId = playerMappings.get(player.playerId);
            return {
                pga_player_id: player.playerId,
                player_name: player.playerName,
                dg_id: dgId, // Include DataGolf ID if found
                sg_total: player.sgTotal,
                sg_ott: player.sgOtt,
                sg_app: player.sgApp,
                sg_arg: player.sgArg,
                sg_putt: player.sgPutt,
                driving_accuracy: player.drivingAccuracy,
                driving_distance: player.drivingDistance,
                updated_at: new Date().toISOString(),
                source_updated_at: player.lastUpdated
            };
        }).filter(Boolean); // Remove null entries
        console.log(`Saving ${dbFormatStats.length} valid player records to database`);
        // Insert data into database
        const { error: insertError, count } = await supabase
            .from('player_season_stats')
            .insert(dbFormatStats)
            .select('count');
        if (insertError) {
            console.error('Error inserting player season stats:', insertError);
            return { success: false, error: insertError.message };
        }
        return {
            success: true,
            message: `Successfully stored ${count} player season stats records with ${playerMappings.size} DataGolf ID mappings`,
            count
        };
    }
    catch (error) {
        console.error('Unexpected error storing player season stats:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}
/**
 * Map PGA Tour player IDs to DataGolf IDs
 *
 * @param pgaIds Array of PGA Tour player IDs
 * @returns Map of PGA Tour IDs to DataGolf IDs
 */
async function mapPgaToDataGolfIds(pgaIds) {
    try {
        const { data, error } = await supabase
            .from('player_id_mappings')
            .select('pga_player_id, dg_id')
            .in('pga_player_id', pgaIds);
        if (error) {
            console.error('Error fetching player ID mappings:', error);
            return new Map();
        }
        const idMap = new Map();
        data.forEach(row => {
            idMap.set(row.pga_player_id, row.dg_id);
        });
        return idMap;
    }
    catch (error) {
        console.error('Unexpected error mapping player IDs:', error);
        return new Map();
    }
}

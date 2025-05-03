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
exports.normalizePlayerName = normalizePlayerName;
exports.matchPlayers = matchPlayers;
exports.generatePlayerIdFromName = generatePlayerIdFromName;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
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
 * Normalizes a player name for comparison
 * Handles formats like: "Tiger Woods", "Woods, Tiger", "T. Woods", etc.
 */
function normalizePlayerName(name) {
    if (!name)
        return '';
    // Remove any non-alphabetic characters except spaces and commas
    let normalized = name.replace(/[^a-zA-Z ,]/g, '');
    // Handle "Last, First" format
    if (normalized.includes(',')) {
        const parts = normalized.split(',').map(p => p.trim());
        normalized = `${parts[1]} ${parts[0]}`;
    }
    // Convert to lowercase
    normalized = normalized.toLowerCase();
    // Remove middle initials and periods
    normalized = normalized.replace(/\b[a-z]\b\.?\s/g, '');
    // Replace initials with just the first letter (e.g., "T. Woods" -> "t woods")
    normalized = normalized.replace(/\b([a-z])\.\s/g, '$1 ');
    // Remove prefixes/suffixes (Jr, Sr, III, etc.)
    normalized = normalized.replace(/\b(jr|sr|iii|iv|ii)\b/g, '');
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}
/**
 * Get similarity score between two strings (0-100)
 * Higher score means more similar
 */
function getSimilarityScore(str1, str2) {
    if (!str1 || !str2)
        return 0;
    const a = normalizePlayerName(str1);
    const b = normalizePlayerName(str2);
    if (a === b)
        return 100;
    // Check if one is a substring of the other
    if (a.includes(b) || b.includes(a)) {
        const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
        return Math.round(90 * ratio);
    }
    // Simple string comparison based on common words
    const aWords = a.split(' ');
    const bWords = b.split(' ');
    // Check last name match (most important)
    const aLastName = aWords[aWords.length - 1];
    const bLastName = bWords[bWords.length - 1];
    if (aLastName !== bLastName) {
        // Last names don't match, low similarity
        return 0;
    }
    // Count common words
    const commonWords = aWords.filter(word => bWords.includes(word)).length;
    const totalWords = new Set([...aWords, ...bWords]).size;
    const wordScore = Math.round((commonWords / totalWords) * 100);
    // Give extra weight to last name match
    return Math.min(80 + wordScore / 5, 99);
}
/**
 * Get existing player mappings from database
 */
async function getExistingMappings() {
    try {
        const { data, error } = await supabase
            .from('player_id_mappings')
            .select('pga_player_id, dg_id');
        if (error) {
            console.error('Error fetching existing mappings:', error);
            return new Map();
        }
        const mappings = new Map();
        data.forEach(row => {
            mappings.set(row.pga_player_id, row.dg_id);
        });
        return mappings;
    }
    catch (error) {
        console.error('Error getting existing mappings:', error);
        return new Map();
    }
}
/**
 * Get all DataGolf players from database for matching
 */
async function getDataGolfPlayers() {
    try {
        // First try player_skill_ratings table which should have recent player data
        let { data: skillRatingsData, error: skillRatingsError } = await supabase
            .from('player_skill_ratings')
            .select('dg_id, player_name')
            .order('updated_at', { ascending: false });
        if (skillRatingsError || !skillRatingsData || skillRatingsData.length === 0) {
            console.warn('No data in player_skill_ratings, trying player_field table');
            // Fallback to player_field table
            const { data: fieldData, error: fieldError } = await supabase
                .from('player_field')
                .select('dg_id, player_name')
                .order('created_at', { ascending: false });
            if (fieldError || !fieldData || fieldData.length === 0) {
                console.error('Could not find player data in database');
                return [];
            }
            return fieldData;
        }
        return skillRatingsData;
    }
    catch (error) {
        console.error('Error getting DataGolf players:', error);
        return [];
    }
}
/**
 * Match PGA Tour players to DataGolf players
 * Updates the player_id_mappings table with new mappings
 */
async function matchPlayers(pgaPlayers) {
    console.log(`Starting player matching for ${pgaPlayers.length} PGA Tour players...`);
    // Get existing mappings
    const existingMappings = await getExistingMappings();
    console.log(`Found ${existingMappings.size} existing mappings`);
    // Get all DataGolf players
    const dataGolfPlayers = await getDataGolfPlayers();
    console.log(`Found ${dataGolfPlayers.length} DataGolf players for matching`);
    if (dataGolfPlayers.length === 0) {
        console.error('No DataGolf players found for matching');
        return existingMappings;
    }
    // Index DataGolf players by normalized name for faster lookup
    const dgPlayersByName = new Map();
    dataGolfPlayers.forEach(player => {
        const normalizedName = normalizePlayerName(player.player_name);
        dgPlayersByName.set(normalizedName, player);
    });
    // Track new mappings to add
    const newMappings = [];
    const finalMappings = new Map(existingMappings);
    // Process each PGA Tour player
    for (const pgaPlayer of pgaPlayers) {
        // Skip if player ID is empty or looks invalid
        if (!pgaPlayer.playerId || pgaPlayer.playerId === '-' ||
            pgaPlayer.playerName === 'Measured Rounds') {
            continue;
        }
        // Check if we already have a mapping
        if (existingMappings.has(pgaPlayer.playerId)) {
            continue;
        }
        // Try exact match by normalized name
        const normalizedPgaName = normalizePlayerName(pgaPlayer.playerName);
        const exactMatch = dgPlayersByName.get(normalizedPgaName);
        if (exactMatch) {
            console.log(`Exact match found for ${pgaPlayer.playerName} (${pgaPlayer.playerId}) -> ${exactMatch.player_name} (${exactMatch.dg_id})`);
            newMappings.push({
                pga_player_id: pgaPlayer.playerId,
                dg_id: exactMatch.dg_id,
                player_name: pgaPlayer.playerName
            });
            finalMappings.set(pgaPlayer.playerId, exactMatch.dg_id);
            continue;
        }
        // Try fuzzy matching
        let bestMatch = null;
        let bestScore = 70; // Minimum threshold for a good match
        for (const dgPlayer of dataGolfPlayers) {
            const score = getSimilarityScore(pgaPlayer.playerName, dgPlayer.player_name);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = dgPlayer;
            }
        }
        if (bestMatch) {
            console.log(`Fuzzy match found for ${pgaPlayer.playerName} (${pgaPlayer.playerId}) -> ${bestMatch.player_name} (${bestMatch.dg_id}) with score ${bestScore}`);
            newMappings.push({
                pga_player_id: pgaPlayer.playerId,
                dg_id: bestMatch.dg_id,
                player_name: pgaPlayer.playerName
            });
            finalMappings.set(pgaPlayer.playerId, bestMatch.dg_id);
        }
        else {
            console.warn(`No match found for ${pgaPlayer.playerName} (${pgaPlayer.playerId})`);
        }
    }
    // Save new mappings to database
    if (newMappings.length > 0) {
        console.log(`Saving ${newMappings.length} new player mappings to database`);
        try {
            const { error } = await supabase
                .from('player_id_mappings')
                .upsert(newMappings, { onConflict: 'pga_player_id' });
            if (error) {
                console.error('Error saving new mappings:', error);
            }
            else {
                console.log(`Successfully saved ${newMappings.length} new mappings`);
            }
        }
        catch (error) {
            console.error('Error saving new mappings:', error);
        }
    }
    else {
        console.log('No new mappings to save');
    }
    return finalMappings;
}
/**
 * Generate a player ID from name if needed
 * This is a fallback when no better ID is available
 */
function generatePlayerIdFromName(name) {
    if (!name)
        return '';
    // Remove non-alphanumeric characters and convert to lowercase
    const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    // Remove consecutive underscores
    const normalized = cleaned.replace(/_+/g, '_');
    // Trim underscores from start and end
    return normalized.replace(/^_|_$/g, '');
}

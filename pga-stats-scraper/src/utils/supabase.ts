import { createClient } from '@supabase/supabase-js';
import { PlayerStats } from '../types/stats';
import * as dotenv from 'dotenv';
import { matchPlayers } from './player-matcher';

dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or Service Role Key is missing in environment variables');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Store season-long player statistics in database
 * 
 * @param playerStats Array of player statistics to store
 * @returns Object containing success status and counts
 */
export async function storePlayerSeasonStats(playerStats: PlayerStats[]) {
  try {
    console.log(`Processing ${playerStats.length} player stats for storage...`);
    
    // First delete existing records to ensure fresh data
    const { error: deleteError } = await supabase
      .from('player_season_stats')
      .delete()
      .neq('id', 0);  // Delete all rows

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
    
    const playerMappings = await matchPlayers(pgaPlayersData);
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
    
    // Insert data into database - don't try to return a count to avoid aggregate function error
    const { error: insertError } = await supabase
      .from('player_season_stats')
      .insert(dbFormatStats);

    if (insertError) {
      console.error('Error inserting player season stats:', insertError);
      return { success: false, error: insertError.message };
    }

    // Count manually after insert
    const { count, error: countError } = await supabase
      .from('player_season_stats')
      .select('*', { count: 'exact', head: true });
      
    const recordCount = count || dbFormatStats.length;

    return { 
      success: true, 
      message: `Successfully stored ${recordCount} player season stats records with ${playerMappings.size} DataGolf ID mappings`, 
      count: recordCount 
    };
  } catch (error: any) {
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
export async function mapPgaToDataGolfIds(pgaIds: string[]) {
  try {
    const { data, error } = await supabase
      .from('player_id_mappings')
      .select('pga_player_id, dg_id')
      .in('pga_player_id', pgaIds);

    if (error) {
      console.error('Error fetching player ID mappings:', error);
      return new Map<string, number>();
    }

    const idMap = new Map<string, number>();
    data.forEach(row => {
      idMap.set(row.pga_player_id, row.dg_id);
    });

    return idMap;
  } catch (error) {
    console.error('Unexpected error mapping player IDs:', error);
    return new Map<string, number>();
  }
}
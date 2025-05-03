require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSqlFixes() {
  try {
    console.log('Running SQL fixes...');
    
    // Try to drop and recreate the unique constraint
    console.log('Fixing player_id_mappings unique constraint...');
    
    // First check if constraint exists
    const { data: constraintExists, error: constraintCheckError } = await supabase.rpc(
      'check_constraint_exists',
      { table_name: 'player_id_mappings', constraint_name: 'player_id_mappings_unique' }
    ).catch(() => ({ data: null, error: new Error('RPC not available') }));
    
    // If RPC doesn't exist or another error, try directly
    if (constraintCheckError) {
      console.log('Dropping existing constraint if it exists...');
      
      // Try to drop the constraint if it exists
      await supabase.rpc(
        'execute_sql',
        { sql_query: 'ALTER TABLE player_id_mappings DROP CONSTRAINT IF EXISTS player_id_mappings_unique;' }
      ).catch(e => console.log('Drop constraint result:', e.message));
      
      // Try to drop the constraint if it exists (alternative method)
      await supabase.rpc(
        'execute_sql',
        { sql_query: 'ALTER TABLE player_id_mappings DROP CONSTRAINT IF EXISTS player_id_mappings_pga_player_id_key;' }
      ).catch(e => console.log('Drop alt constraint result:', e.message));
    }
    
    // Delete all player_id_mappings to start fresh
    console.log('Clearing all existing player mappings...');
    const { error: deleteError } = await supabase
      .from('player_id_mappings')
      .delete()
      .neq('id', 0);
      
    if (deleteError) {
      console.warn('Error clearing player_id_mappings:', deleteError.message);
    } else {
      console.log('Successfully cleared player_id_mappings table');
    }
    
    // Delete all player_season_stats to start fresh
    console.log('Clearing all existing player season stats...');
    const { error: deleteStatsError } = await supabase
      .from('player_season_stats')
      .delete()
      .neq('id', 0);
      
    if (deleteStatsError) {
      console.warn('Error clearing player_season_stats:', deleteStatsError.message);
    } else {
      console.log('Successfully cleared player_season_stats table');
    }
    
    // Create unique constraint
    console.log('Creating new unique constraint on player_id_mappings...');
    const { error: addConstraintError } = await supabase.rpc(
      'execute_sql',
      { sql_query: 'ALTER TABLE player_id_mappings ADD CONSTRAINT player_id_mappings_pga_player_id_dg_id_key UNIQUE (pga_player_id, dg_id);' }
    ).catch(e => ({ error: e }));
    
    if (addConstraintError) {
      console.warn('Error adding constraint:', addConstraintError.message);
    } else {
      console.log('Successfully added unique constraint');
    }
    
    console.log('SQL fixes completed.');
    console.log('You can now try running the scraper again.');
    
  } catch (error) {
    console.error('Error running SQL fixes:', error);
  }
}

// Run fixes
runSqlFixes();
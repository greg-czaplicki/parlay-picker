require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSimpleFixes() {
  try {
    console.log('Running simple fixes...');
    
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
    
    console.log('Simple fixes completed.');
    console.log('You can now try running the scraper again.');
    
  } catch (error) {
    console.error('Error running simple fixes:', error);
  }
}

// Run fixes
runSimpleFixes();
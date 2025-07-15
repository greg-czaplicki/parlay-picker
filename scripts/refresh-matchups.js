#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function deleteAndRefreshMatchups() {
  try {
    // Delete existing matchups for The Open Championship (event_id: 100)
    console.log('Deleting existing matchups for The Open Championship...');
    const { error: deleteError } = await supabase
      .from('matchups_v2')
      .delete()
      .eq('event_id', 100);
    
    if (deleteError) {
      console.error('Error deleting matchups:', deleteError);
      return;
    }
    
    console.log('Successfully deleted existing matchups');
    
    // Trigger re-ingest
    console.log('Triggering matchup ingest...');
    const response = await fetch('http://localhost:3000/api/matchups/ingest?tour=pga', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INGEST_SECRET}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    console.log('Ingest result:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

deleteAndRefreshMatchups();
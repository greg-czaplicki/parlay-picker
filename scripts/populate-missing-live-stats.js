#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateMissingLiveStats() {
  console.log('🔍 Finding tournaments with settled parlays but missing live stats...');
  
  // Get tournaments that have settlement data but no live stats
  const { data: settledTournaments, error: tournamentsError } = await supabase
    .from('settlement_history')
    .select(`
      event_id,
      tournaments!inner(event_name)
    `)
    .not('settlement_data', 'is', null);

  if (tournamentsError) {
    console.error('Error fetching tournaments:', tournamentsError);
    return;
  }

  const tournamentIds = [...new Set(settledTournaments.map(t => t.event_id))];
  console.log(`📋 Found ${tournamentIds.length} tournaments with settlement data`);

  for (const eventId of tournamentIds) {
    const tournament = settledTournaments.find(t => t.event_id === eventId);
    const eventName = tournament.tournaments.event_name;
    
    console.log(`\n🏌️ Processing ${eventName} (Event ID: ${eventId})`);
    
    // Check if live stats already exist
    const { data: existingStats } = await supabase
      .from('live_tournament_stats')
      .select('id')
      .eq('event_name', eventName)
      .limit(1);
    
    if (existingStats && existingStats.length > 0) {
      console.log(`  ✅ Live stats already exist for ${eventName}`);
      continue;
    }
    
    // Get settlement data for this tournament
    const { data: settlementData, error: settlementError } = await supabase
      .from('settlement_history')
      .select('settlement_data')
      .eq('event_id', eventId)
      .not('settlement_data', 'is', null)
      .limit(1);
    
    if (settlementError || !settlementData.length) {
      console.log(`  ❌ No settlement data found for ${eventName}`);
      continue;
    }
    
    const allPlayerStats = settlementData[0].settlement_data?.all_player_stats;
    if (!allPlayerStats || !Array.isArray(allPlayerStats)) {
      console.log(`  ❌ Invalid player stats data for ${eventName}`);
      continue;
    }
    
    console.log(`  📊 Found ${allPlayerStats.length} player records`);
    
    // Transform and insert player stats
    const liveStatsRecords = allPlayerStats
      .filter(player => player.player_name && player.dg_id)
      .map(player => ({
        dg_id: player.dg_id,
        player_name: player.player_name,
        event_name: eventName,
        round_num: String(player.round_num || 4), // Convert to string as expected by table
        position: player.current_position || 'CUT',
        total: player.total_score || 0,
        today: player.today_score || 0,
        thru: player.thru || 18,
        data_golf_updated_at: new Date().toISOString(),
        fetched_at: new Date().toISOString()
      }));
    
    if (liveStatsRecords.length === 0) {
      console.log(`  ❌ No valid player records for ${eventName}`);
      continue;
    }
    
    // Insert in batches to avoid size limits
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < liveStatsRecords.length; i += batchSize) {
      const batch = liveStatsRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('live_tournament_stats')
        .insert(batch);
      
      if (insertError) {
        console.error(`  ❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
      } else {
        insertedCount += batch.length;
        console.log(`  ✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
      }
    }
    
    console.log(`  🎉 Successfully inserted ${insertedCount} live stats records for ${eventName}`);
  }
  
  console.log('\n✨ Live stats population complete!');
}

// Run the script
populateMissingLiveStats().catch(console.error); 
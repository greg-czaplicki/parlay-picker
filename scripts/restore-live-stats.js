#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function restoreLiveStats() {
  console.log('🔄 Restoring live tournament stats from settlement data...');
  
  try {
    // Get settlement data for tournaments with settled parlays
    const { data: settlements, error: settlementsError } = await supabase
      .from('settlement_history')
      .select(`
        event_id,
        settlement_data,
        tournaments!inner(event_name)
      `)
      .in('event_id', [26, 34]); // U.S. Open and Travelers Championship

    if (settlementsError) {
      throw new Error(`Error fetching settlements: ${settlementsError.message}`);
    }

    console.log(`Found ${settlements.length} settlement records`);

    // Get required rounds for each tournament
    const { data: requiredRounds, error: roundsError } = await supabase
      .from('matchups')
      .select(`
        event_id,
        round_num,
        parlay_picks!inner(
          parlays!inner(outcome)
        )
      `)
      .in('event_id', [26, 34])
      .not('parlay_picks.parlays.outcome', 'is', null);

    if (roundsError) {
      throw new Error(`Error fetching required rounds: ${roundsError.message}`);
    }

    // Group required rounds by event_id
    const roundsByEvent = {};
    requiredRounds.forEach(r => {
      if (!roundsByEvent[r.event_id]) {
        roundsByEvent[r.event_id] = new Set();
      }
      roundsByEvent[r.event_id].add(r.round_num);
    });

    console.log('Required rounds by event:', Object.fromEntries(
      Object.entries(roundsByEvent).map(([k, v]) => [k, Array.from(v)])
    ));

    // Process each settlement
    for (const settlement of settlements) {
      const eventId = settlement.event_id;
      const eventName = settlement.tournaments.event_name;
      const requiredRoundsForEvent = Array.from(roundsByEvent[eventId] || []);
      
      console.log(`\n📊 Processing ${eventName} (Event ID: ${eventId})`);
      console.log(`Required rounds: ${requiredRoundsForEvent.join(', ')}`);

      const playerStats = settlement.settlement_data?.all_player_stats || [];
      console.log(`Found ${playerStats.length} player records in settlement data`);

      // Insert data for each required round
      for (const roundNum of requiredRoundsForEvent) {
        console.log(`  Inserting Round ${roundNum} data...`);
        
        const insertData = playerStats
          .filter(player => player.player_name && player.dg_id)
          .map(player => ({
            event_name: eventName,
            player_name: player.player_name,
            round_num: roundNum,
            position: player.current_position || null,
            total: parseInt(player.total_score) || 0,
            today: parseInt(player.today_score) || 0,
            thru: parseInt(player.thru) || 18,
            dg_id: parseInt(player.dg_id),
            data_golf_updated_at: roundNum === 2 ? '2025-06-20T18:00:00Z' : '2025-06-22T18:00:00Z'
          }));

        // Insert in batches of 100
        for (let i = 0; i < insertData.length; i += 100) {
          const batch = insertData.slice(i, i + 100);
          
          const { error: insertError } = await supabase
            .from('live_tournament_stats')
            .insert(batch);

          if (insertError) {
            console.error(`    Error inserting batch ${Math.floor(i/100) + 1}:`, insertError.message);
            // Continue with next batch
          } else {
            console.log(`    ✅ Inserted batch ${Math.floor(i/100) + 1} (${batch.length} records)`);
          }
        }
      }
    }

    console.log('\n✅ Live stats restoration complete!');
    
    // Verify the restoration
    const { data: verifyData } = await supabase
      .from('live_tournament_stats')
      .select('event_name, round_num')
      .in('event_name', ['U.S. Open', 'Travelers Championship']);

    const summary = {};
    verifyData?.forEach(row => {
      const key = `${row.event_name} R${row.round_num}`;
      summary[key] = (summary[key] || 0) + 1;
    });

    console.log('\n📈 Verification summary:');
    Object.entries(summary).forEach(([key, count]) => {
      console.log(`  ${key}: ${count} players`);
    });

  } catch (error) {
    console.error('❌ Error restoring live stats:', error.message);
    process.exit(1);
  }
}

restoreLiveStats(); 
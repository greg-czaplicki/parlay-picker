const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default course pars for known tournaments
const DEFAULT_COURSE_PARS = {
  'Masters Tournament': 72,
  'PGA Championship': 72,
  'U.S. Open': 70,
  'The Open Championship': 71,
  'THE PLAYERS Championship': 72,
  'FedEx St. Jude Championship': 70,
  'BMW Championship': 72,
  'TOUR Championship': 70,
  'Arnold Palmer Invitational': 72,
  'Memorial Tournament': 72,
  'Genesis Invitational': 71,
  'WM Phoenix Open': 71,
  'AT&T Pebble Beach Pro-Am': 72,
  'Wells Fargo Championship': 72,
  'RBC Canadian Open': 70,
  'Travelers Championship': 70,
  'John Deere Classic': 71,
  'Rocket Mortgage Classic': 72,
  '3M Open': 71,
  'Wyndham Championship': 70,
  'RBC Heritage': 71,
  'Zurich Classic of New Orleans': 72,
  'Valero Texas Open': 72,
  'Houston Open': 72,
  'Sony Open in Hawaii': 70,
  'American Express': 72,
  'Farmers Insurance Open': 72,
  'Mexico Open at Vidanta': 71,
  'Cognizant Classic': 70,
  'Puerto Rico Open': 72,
  'Corales Puntacana Championship': 72,
  'Sanderson Farms Championship': 72,
  'Shriners Children\'s Open': 71,
  'ZOZO Championship': 70,
  'World Wide Technology Championship': 72,
  'Cadence Bank Houston Open': 72,
  'The RSM Classic': 72,
  'Fortinet Championship': 72,
  'Procore Championship': 72,
  'Black Desert Championship': 72,
  'The CJ Cup Byron Nelson': 72
};

async function batchInsert(table, records, batchSize = 100, onConflict = 'id') {
  let inserted = 0;
  let errors = 0;
  
  // Remove onConflict from records
  const cleanRecords = records.map(r => {
    const { onConflict: _, ...cleanRecord } = r;
    return cleanRecord;
  });
  
  for (let i = 0; i < cleanRecords.length; i += batchSize) {
    const batch = cleanRecords.slice(i, i + batchSize);
    try {
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict });
      
      if (error) {
        console.error(`   ❌ Batch error in ${table}:`, error.message);
        errors += batch.length;
      } else {
        inserted += batch.length;
      }
    } catch (err) {
      console.error(`   ❌ Batch exception in ${table}:`, err.message);
      errors += batch.length;
    }
  }
  
  return { inserted, errors };
}

async function migrateData() {
  console.log('🚀 Starting Optimized Data Migration from v1 to v2 Schema...\n');
  
  const stats = {
    tournaments: { total: 0, migrated: 0, errors: 0 },
    players: { total: 0, migrated: 0, errors: 0 },
    scores: { total: 0, migrated: 0, errors: 0, converted: 0 },
    results: { total: 0, migrated: 0, errors: 0 }
  };

  try {
    // Check what's already migrated
    console.log('🔍 Checking existing v2 data...');
    const { count: tournamentsCount } = await supabase
      .from('tournaments_v2')
      .select('*', { count: 'exact', head: true });
    
    const { count: playersCount } = await supabase
      .from('players_v2')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Found ${tournamentsCount || 0} tournaments already migrated`);
    console.log(`   Found ${playersCount || 0} players already migrated\n`);
    
    // Skip tournaments and players if already migrated
    if (!tournamentsCount || tournamentsCount === 0) {
      // Step 1: Migrate Tournaments
      console.log('📋 Step 1: Migrating Tournaments...');
      const { data: tournaments, error: tournamentsError } = await supabase
        .from('tournaments')
        .select('*')
        .order('event_id');
      
      if (tournamentsError) throw tournamentsError;
      
      stats.tournaments.total = tournaments.length;
      console.log(`   Found ${tournaments.length} tournaments to migrate`);
      
      const tournamentRecords = tournaments.map(t => ({
        event_id: t.event_id,
        event_name: t.event_name,
        course_name: t.course,
        course_par: t.course_par || DEFAULT_COURSE_PARS[t.event_name] || 72,
        start_date: t.start_date,
        end_date: t.end_date,
        tour: t.tour || 'pga',
        status: t.status || 'completed',
        onConflict: 'event_id'
      }));
      
      const { inserted, errors } = await batchInsert('tournaments_v2', tournamentRecords, 100, 'event_id');
      stats.tournaments.migrated = inserted;
      stats.tournaments.errors = errors;
      
      console.log(`   ✅ Migrated ${stats.tournaments.migrated}/${stats.tournaments.total} tournaments\n`);
    }
    
    if (!playersCount || playersCount === 0) {
      // Step 2: Migrate Players
      console.log('👥 Step 2: Migrating Players...');
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('dg_id');
      
      if (playersError) throw playersError;
      
      stats.players.total = players.length;
      console.log(`   Found ${players.length} players to migrate`);
      
      const playerRecords = players.map(p => ({
        dg_id: p.dg_id,
        name: p.name,
        country: p.country,
        country_code: p.country_code,
        onConflict: 'dg_id'
      }));
      
      const { inserted, errors } = await batchInsert('players_v2', playerRecords, 100, 'dg_id');
      stats.players.migrated = inserted;
      stats.players.errors = errors;
      
      console.log(`   ✅ Migrated ${stats.players.migrated}/${stats.players.total} players\n`);
    }
    
    // Get tournament pars for score conversion
    const { data: tournamentsV2 } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, course_par');
    
    const tournamentPars = {};
    for (const t of tournamentsV2 || []) {
      tournamentPars[t.event_id] = t.course_par || DEFAULT_COURSE_PARS[t.event_name] || 72;
    }
    
    // Step 3: Migrate Tournament Results and Extract Round Scores
    console.log('🏌️ Step 3: Migrating Tournament Results and Round Scores...');
    const { data: results, error: resultsError } = await supabase
      .from('tournament_results')
      .select('*')
      .order('event_id, dg_id');
    
    if (resultsError) throw resultsError;
    
    stats.results.total = results.length;
    console.log(`   Found ${results.length} tournament results to migrate`);
    
    // Process in batches
    const roundScoreBatch = [];
    const resultBatch = [];
    
    for (const result of results) {
      try {
        const coursePar = tournamentPars[result.event_id] || 72;
        
        // Process round scores
        const roundScores = [];
        if (result.round_scores && Array.isArray(result.round_scores)) {
          for (let i = 0; i < result.round_scores.length && i < 4; i++) {
            const roundScore = result.round_scores[i];
            if (roundScore !== null && roundScore !== 0) {
              let actualScore;
              
              // Detect if score is relative (typically between -20 and +20)
              if (roundScore >= -20 && roundScore <= 20) {
                // Convert relative to actual
                actualScore = coursePar + roundScore;
                stats.scores.converted++;
              } else {
                // Already an actual score
                actualScore = roundScore;
              }
              
              roundScores[i] = actualScore;
              
              // Add to batch
              roundScoreBatch.push({
                event_id: result.event_id,
                dg_id: result.dg_id,
                player_name: result.player_name,
                round_number: i + 1,
                round_score: actualScore,
                position: i === result.round_scores.length - 1 ? result.finish_position : null,
                made_cut: !result.missed_cut,
                holes_completed: 18,
                onConflict: 'event_id,dg_id,round_number'
              });
            }
          }
        }
        
        // Calculate tournament results
        const validScores = result.round_scores ? result.round_scores.filter(s => s !== null && s !== 0) : [];
        if (validScores.length > 0) {
          let totalScore;
          let relativeScore;
          
          // Check if total_score is relative or actual
          if (result.total_score >= -50 && result.total_score <= 50) {
            // Total score is relative to par
            relativeScore = result.total_score;
            totalScore = (coursePar * validScores.length) + result.total_score;
          } else {
            // Total score is actual
            totalScore = result.total_score;
            relativeScore = totalScore - (coursePar * validScores.length);
          }
          
          const scoringAverage = totalScore / validScores.length;
          
          resultBatch.push({
            event_id: result.event_id,
            dg_id: result.dg_id,
            player_name: result.player_name,
            final_position: result.finish_position,
            total_score: totalScore,
            rounds_completed: validScores.length,
            scoring_average: parseFloat(scoringAverage.toFixed(2)),
            relative_to_par: relativeScore,
            made_cut: !result.missed_cut,
            round_1_score: roundScores[0] || null,
            round_2_score: roundScores[1] || null,
            round_3_score: roundScores[2] || null,
            round_4_score: roundScores[3] || null,
            onConflict: 'event_id,dg_id'
          });
        }
      } catch (err) {
        console.error(`   ❌ Exception processing result:`, err.message);
        stats.results.errors++;
      }
    }
    
    // Insert round scores in batches
    console.log(`   Inserting ${roundScoreBatch.length} round scores...`);
    const scoreResult = await batchInsert('player_round_scores_v2', roundScoreBatch, 100, 'event_id,dg_id,round_number');
    stats.scores.migrated = scoreResult.inserted;
    stats.scores.errors = scoreResult.errors;
    
    // Insert tournament results in batches
    console.log(`   Inserting ${resultBatch.length} tournament results...`);
    const resultResult = await batchInsert('tournament_results_v2', resultBatch, 100, 'event_id,dg_id');
    stats.results.migrated = resultResult.inserted;
    stats.results.errors = resultResult.errors;
    
    console.log(`   ✅ Migrated ${stats.results.migrated}/${stats.results.total} results`);
    console.log(`   ✅ Migrated ${stats.scores.migrated} round scores (${stats.scores.converted} converted from relative)\n`);
    
    // Step 4: Migrate Live Stats Data for Current Tournaments
    console.log('📊 Step 4: Migrating Live Stats for Active Tournaments...');
    const { data: liveStats, error: liveStatsError } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .order('event_id, round_number, dg_id')
      .limit(1000);
    
    if (!liveStatsError && liveStats && liveStats.length > 0) {
      console.log(`   Found ${liveStats.length} live stats records`);
      
      const liveStatsBatch = [];
      for (const stat of liveStats) {
        const coursePar = tournamentPars[stat.event_id] || 72;
        let actualScore = stat.round_score;
        
        // Convert if needed
        if (stat.round_score !== null && stat.round_score >= -20 && stat.round_score <= 20) {
          actualScore = coursePar + stat.round_score;
        }
        
        liveStatsBatch.push({
          event_id: stat.event_id,
          dg_id: stat.dg_id,
          player_name: stat.player_name,
          round_number: stat.round_number,
          round_score: actualScore,
          position: stat.position,
          holes_completed: stat.holes_completed || 0,
          made_cut: stat.made_cut,
          tee_time: stat.tee_time,
          onConflict: 'event_id,dg_id,round_number'
        });
      }
      
      const liveResult = await batchInsert('player_round_scores_v2', liveStatsBatch, 100, 'event_id,dg_id,round_number');
      console.log(`   ✅ Migrated ${liveResult.inserted} live stats records\n`);
    }
    
    // Final Summary
    console.log('📈 Migration Summary:');
    console.log('===================');
    console.log(`Tournaments: ${stats.tournaments.migrated}/${stats.tournaments.total} migrated (${stats.tournaments.errors} errors)`);
    console.log(`Players: ${stats.players.migrated}/${stats.players.total} migrated (${stats.players.errors} errors)`);
    console.log(`Results: ${stats.results.migrated}/${stats.results.total} migrated (${stats.results.errors} errors)`);
    console.log(`Round Scores: ${stats.scores.migrated} migrated (${stats.scores.converted} converted from relative)`);
    console.log('\n✅ Data migration completed!');
    
    // Save migration stats
    await fs.writeFile(
      'migration-stats.json',
      JSON.stringify(stats, null, 2)
    );
    console.log('\n📊 Migration statistics saved to migration-stats.json');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateData();
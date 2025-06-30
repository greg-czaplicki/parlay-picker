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

async function migrateData() {
  console.log('🚀 Starting Data Migration from v1 to v2 Schema...\n');
  
  const stats = {
    tournaments: { total: 0, migrated: 0, errors: 0 },
    players: { total: 0, migrated: 0, errors: 0 },
    scores: { total: 0, migrated: 0, errors: 0, converted: 0 },
    results: { total: 0, migrated: 0, errors: 0 }
  };

  try {
    // Step 1: Migrate Tournaments
    console.log('📋 Step 1: Migrating Tournaments...');
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('tournaments')
      .select('*')
      .order('event_id');
    
    if (tournamentsError) throw tournamentsError;
    
    stats.tournaments.total = tournaments.length;
    console.log(`   Found ${tournaments.length} tournaments to migrate`);
    
    for (const tournament of tournaments) {
      try {
        // Determine course par
        let coursePar = tournament.course_par || DEFAULT_COURSE_PARS[tournament.event_name] || 72;
        
        const { error } = await supabase
          .from('tournaments_v2')
          .upsert({
            event_id: tournament.event_id,
            event_name: tournament.event_name,
            course_name: tournament.course,
            course_par: coursePar,
            start_date: tournament.start_date,
            end_date: tournament.end_date,
            tour: tournament.tour || 'pga',
            status: tournament.status || 'completed'
          }, { onConflict: 'event_id' });
        
        if (error) {
          console.error(`   ❌ Error migrating tournament ${tournament.event_id}:`, error.message);
          stats.tournaments.errors++;
        } else {
          stats.tournaments.migrated++;
        }
      } catch (err) {
        console.error(`   ❌ Exception migrating tournament ${tournament.event_id}:`, err.message);
        stats.tournaments.errors++;
      }
    }
    
    console.log(`   ✅ Migrated ${stats.tournaments.migrated}/${stats.tournaments.total} tournaments\n`);
    
    // Step 2: Migrate Players
    console.log('👥 Step 2: Migrating Players...');
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('dg_id');
    
    if (playersError) throw playersError;
    
    stats.players.total = players.length;
    console.log(`   Found ${players.length} players to migrate`);
    
    for (const player of players) {
      try {
        const { error } = await supabase
          .from('players_v2')
          .upsert({
            dg_id: player.dg_id,
            name: player.name,
            country: player.country,
            country_code: player.country_code
          }, { onConflict: 'dg_id' });
        
        if (error) {
          console.error(`   ❌ Error migrating player ${player.dg_id}:`, error.message);
          stats.players.errors++;
        } else {
          stats.players.migrated++;
        }
      } catch (err) {
        console.error(`   ❌ Exception migrating player ${player.dg_id}:`, err.message);
        stats.players.errors++;
      }
    }
    
    console.log(`   ✅ Migrated ${stats.players.migrated}/${stats.players.total} players\n`);
    
    // Step 3: Migrate Tournament Results and Extract Round Scores
    console.log('🏌️ Step 3: Migrating Tournament Results and Round Scores...');
    const { data: results, error: resultsError } = await supabase
      .from('tournament_results')
      .select('*')
      .order('event_id, dg_id');
    
    if (resultsError) throw resultsError;
    
    stats.results.total = results.length;
    console.log(`   Found ${results.length} tournament results to migrate`);
    
    // Create a map of tournament IDs to course pars
    const tournamentPars = {};
    for (const t of tournaments) {
      tournamentPars[t.event_id] = t.course_par || DEFAULT_COURSE_PARS[t.event_name] || 72;
    }
    
    for (const result of results) {
      try {
        const coursePar = tournamentPars[result.event_id] || 72;
        
        // Process round scores
        if (result.round_scores && Array.isArray(result.round_scores)) {
          for (let i = 0; i < result.round_scores.length; i++) {
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
              
              // Insert round score
              const { error: scoreError } = await supabase
                .from('player_round_scores_v2')
                .upsert({
                  event_id: result.event_id,
                  dg_id: result.dg_id,
                  player_name: result.player_name,
                  round_number: i + 1,
                  round_score: actualScore,
                  position: i === result.round_scores.length - 1 ? result.finish_position : null,
                  made_cut: !result.missed_cut,
                  holes_completed: 18 // Assuming complete rounds for historical data
                }, { onConflict: 'event_id,dg_id,round_number' });
              
              if (scoreError) {
                console.error(`   ❌ Error migrating round score:`, scoreError.message);
                stats.scores.errors++;
              } else {
                stats.scores.migrated++;
              }
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
          
          const { error: resultError } = await supabase
            .from('tournament_results_v2')
            .upsert({
              event_id: result.event_id,
              dg_id: result.dg_id,
              player_name: result.player_name,
              final_position: result.finish_position,
              total_score: totalScore,
              rounds_completed: validScores.length,
              scoring_average: parseFloat(scoringAverage.toFixed(2)),
              relative_to_par: relativeScore,
              made_cut: !result.missed_cut
            }, { onConflict: 'event_id,dg_id' });
          
          if (resultError) {
            console.error(`   ❌ Error migrating result:`, resultError.message);
            stats.results.errors++;
          } else {
            stats.results.migrated++;
          }
        }
      } catch (err) {
        console.error(`   ❌ Exception processing result:`, err.message);
        stats.results.errors++;
      }
    }
    
    console.log(`   ✅ Migrated ${stats.results.migrated}/${stats.results.total} results`);
    console.log(`   ✅ Migrated ${stats.scores.migrated} round scores (${stats.scores.converted} converted from relative)\n`);
    
    // Step 4: Migrate Live Stats Data for Current Tournaments
    console.log('📊 Step 4: Migrating Live Stats for Active Tournaments...');
    const { data: liveStats, error: liveStatsError } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .order('event_id, round_number, dg_id')
      .limit(1000);
    
    if (!liveStatsError && liveStats.length > 0) {
      console.log(`   Found ${liveStats.length} live stats records`);
      
      let liveStatsMigrated = 0;
      for (const stat of liveStats) {
        try {
          const coursePar = tournamentPars[stat.event_id] || 72;
          let actualScore = stat.round_score;
          
          // Convert if needed
          if (stat.round_score !== null && stat.round_score >= -20 && stat.round_score <= 20) {
            actualScore = coursePar + stat.round_score;
          }
          
          const { error } = await supabase
            .from('player_round_scores_v2')
            .upsert({
              event_id: stat.event_id,
              dg_id: stat.dg_id,
              player_name: stat.player_name,
              round_number: stat.round_number,
              round_score: actualScore,
              position: stat.position,
              holes_completed: stat.holes_completed || 0,
              made_cut: stat.made_cut,
              tee_time: stat.tee_time
            }, { onConflict: 'event_id,dg_id,round_number' });
          
          if (!error) liveStatsMigrated++;
        } catch (err) {
          // Continue on error
        }
      }
      
      console.log(`   ✅ Migrated ${liveStatsMigrated} live stats records\n`);
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
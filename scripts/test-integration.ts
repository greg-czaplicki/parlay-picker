/**
 * Simple Integration Test for Course DNA Service
 * Verifies the service can connect to database and process real data
 */

import dotenv from 'dotenv';

// Load environment variables from multiple files BEFORE any other imports
dotenv.config(); // Load .env
dotenv.config({ path: '.env.local' }); // Load .env.local

// Now import after env vars are loaded
import { createSupabaseClient } from '../lib/api-utils';
import { CourseDNAService } from '../lib/services/course-dna-service';

async function runIntegrationTest() {
  console.log('🔌 TESTING COURSE DNA INTEGRATION...\n');

  const supabase = createSupabaseClient();
  const courseDNAService = new CourseDNAService();

  try {
    // Test 1: Database connectivity
    console.log('1️⃣ Testing database connectivity...');
    const { data: testConnection, error: connectionError } = await supabase
      .from('live_tournament_stats')
      .select('count')
      .limit(1);

    if (connectionError) {
      console.log(`❌ Database connection failed: ${connectionError.message}`);
      return;
    }
    console.log('✅ Database connection successful');

    // Test 2: Check for SG data availability
    console.log('\n2️⃣ Checking SG data availability...');
    const { data: sgData, error: sgError } = await supabase
      .from('live_tournament_stats')
      .select('event_name, sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .not('sg_total', 'is', null)
      .limit(10);

    if (sgError) {
      console.log(`❌ SG data query failed: ${sgError.message}`);
      return;
    }

    if (!sgData || sgData.length === 0) {
      console.log('❌ No SG data found in database');
      return;
    }

    console.log(`✅ Found ${sgData.length} sample SG records`);
    console.log('   Sample events:', [...new Set(sgData.map(d => d.event_name))].slice(0, 3).join(', '));

    // Test 3: Check for player skill ratings data
    console.log('\n3️⃣ Checking player skill ratings...');
    const { data: playerData, error: playerError } = await supabase
      .from('player_skill_ratings')
      .select('player_name, sg_total')
      .not('sg_total', 'is', null)
      .limit(5);

    if (playerError) {
      console.log(`❌ Player data query failed: ${playerError.message}`);
      return;
    }

    if (!playerData || playerData.length === 0) {
      console.log('❌ No player skill data found');
      return;
    }

    console.log(`✅ Found ${playerData.length} sample player records`);
    console.log('   Sample players:', playerData.map(p => p.player_name).slice(0, 3).join(', '));

    // Test 4: Try generating a Course DNA profile
    console.log('\n4️⃣ Testing Course DNA generation...');
    
    // Get a tournament name that exists in the data
    const tournaments = [...new Set(sgData.map(d => d.event_name))];
    const testTournament = tournaments[0];
    
    console.log(`   Testing with: ${testTournament}`);
    
    const startTime = Date.now();
    const courseDNA = await courseDNAService.generateCourseDNAProfile(testTournament);
    const endTime = Date.now();

    if (!courseDNA) {
      console.log(`❌ Could not generate Course DNA for ${testTournament}`);
      console.log('   This might be due to insufficient data for this tournament');
      
      // Try with a different tournament if available
      if (tournaments.length > 1) {
        console.log(`   Trying with: ${tournaments[1]}`);
        const altDNA = await courseDNAService.generateCourseDNAProfile(tournaments[1]);
        if (altDNA) {
          console.log('✅ Alternative tournament worked');
          console.log(`   Event: ${altDNA.event_name}`);
          console.log(`   Rounds analyzed: ${altDNA.total_rounds_analyzed}`);
          console.log(`   Top skill: ${Object.entries(altDNA.sg_category_weights).sort(([,a], [,b]) => b - a)[0][0]}`);
        } else {
          console.log('❌ Alternative tournament also failed');
        }
      }
    } else {
      console.log('✅ Course DNA generated successfully!');
      console.log(`   Event: ${courseDNA.event_name}`);
      console.log(`   Rounds analyzed: ${courseDNA.total_rounds_analyzed}`);
      console.log(`   Tournaments: ${courseDNA.tournaments_analyzed}`);
      console.log(`   Confidence: ${(courseDNA.confidence_score * 100).toFixed(1)}%`);
      console.log(`   Processing time: ${endTime - startTime}ms`);
      
      const weights = courseDNA.sg_category_weights;
      console.log('\n   📊 SG Category Weights:');
      console.log(`      Off Tee (OTT): ${weights.sg_ott}%`);
      console.log(`      Approach (APP): ${weights.sg_app}%`);
      console.log(`      Around Green (ARG): ${weights.sg_arg}%`);
      console.log(`      Putting (PUTT): ${weights.sg_putt}%`);
      
      const topCategory = Object.entries(weights).sort(([,a], [,b]) => b - a)[0];
      console.log(`\n   🎯 Primary skill: ${topCategory[0].toUpperCase()} (${topCategory[1]}%)`);

      // Test 5: Try player course fit analysis
      if (playerData.length > 0) {
        console.log('\n5️⃣ Testing player course fit...');
        
        // Get a player ID from the data
        const { data: playerWithId } = await supabase
          .from('player_skill_ratings')
          .select('dg_id, player_name')
          .not('dg_id', 'is', null)
          .limit(1)
          .single();

        if (playerWithId) {
          const playerFit = await courseDNAService.analyzePlayerCourseFit(
            playerWithId.dg_id, 
            testTournament
          );

          if (playerFit) {
            console.log('✅ Player course fit analysis successful!');
            console.log(`   Player: ${playerFit.player_name}`);
            console.log(`   Course fit: ${playerFit.fit_score}/100 (${playerFit.fit_grade})`);
            console.log(`   Predicted finish: ${playerFit.predicted_finish_range.realistic}`);
          } else {
            console.log('❌ Player course fit analysis failed');
          }
        }
      }
    }

    console.log('\n🎯 INTEGRATION TEST SUMMARY:');
    console.log('✅ Database connectivity: Working');
    console.log(`✅ SG data availability: ${sgData?.length || 0} records`);
    console.log(`✅ Player data availability: ${playerData?.length || 0} records`);
    console.log(`${courseDNA ? '✅' : '❌'} Course DNA generation: ${courseDNA ? 'Working' : 'Failed'}`);
    
    if (courseDNA) {
      console.log('\n🚀 READY TO PROCEED: The Course DNA engine is working with your real data!');
      console.log('   Next steps: Run full validation suite and build API endpoints');
    } else {
      console.log('\n⚠️  NEEDS INVESTIGATION: Course DNA generation failed');
      console.log('   Possible issues: Insufficient data, tournament name mismatches, or statistical thresholds');
    }

  } catch (error) {
    console.error('❌ Integration test failed:', error);
    console.log('\nPossible issues:');
    console.log('- Environment variables not set correctly');
    console.log('- Database connection configuration');
    console.log('- Missing tables or columns');
    console.log('- Network connectivity');
  }
}

// Run the test
runIntegrationTest(); 
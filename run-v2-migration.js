const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Starting Database Migration to v2 Schema...\n');
  
  try {
    // Read the comprehensive migration file
    console.log('📄 Reading migration file...');
    const migrationSql = fs.readFileSync('migrations/schema-v2/V001__create_complete_v2_schema_with_compatibility.sql', 'utf8');
    
    // Remove all RAISE NOTICE statements and comments
    const cleanedSql = migrationSql
      .split('\n')
      .filter(line => !line.trim().startsWith('RAISE NOTICE'))
      .join('\n');
    
    // Split into individual statements
    const statements = cleanedSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 10 && !stmt.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements to execute\n`);
    
    // Execute migration statements
    console.log('🔧 Executing migration...');
    let executedCount = 0;
    let errors = [];
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        console.log(`   [${i+1}/${statements.length}] Executing: ${statement.substring(0, 50)}...`);
        
        // Execute the raw SQL directly
        const { data, error } = await supabase.rpc('query', { 
          query_text: statement + ';' 
        }).single();
        
        if (error) {
          // Try alternative approach - direct execution
          const { data: directData, error: directError } = await supabase
            .from('_raw_sql')
            .insert({ sql: statement })
            .select();
            
          if (directError) {
            errors.push({ statement: i+1, error: error?.message || directError?.message });
            console.error(`   ❌ Error in statement ${i+1}: ${error?.message || directError?.message}`);
          } else {
            executedCount++;
          }
        } else {
          executedCount++;
        }
      } catch (err) {
        errors.push({ statement: i+1, error: err.message });
        console.error(`   ❌ Exception in statement ${i+1}:`, err.message);
      }
    }
    
    console.log(`\n✅ Migration attempted! Executed ${executedCount}/${statements.length} statements\n`);
    
    if (errors.length > 0) {
      console.log('❌ Errors encountered:');
      errors.slice(0, 5).forEach(err => {
        console.log(`   - Statement ${err.statement}: ${err.error}`);
      });
      if (errors.length > 5) {
        console.log(`   ... and ${errors.length - 5} more errors`);
      }
    }
    
    // Verify migration results
    console.log('\n🔍 Verifying migration results...');
    
    // Check if v2 tables were created by querying them directly
    const tablesToCheck = [
      'tournaments_v2',
      'players_v2', 
      'player_round_scores_v2',
      'tournament_results_v2',
      'player_advanced_stats_v2'
    ];
    
    let tablesCreated = 0;
    for (const table of tablesToCheck) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (!error || error.code === 'PGRST116') { // PGRST116 = no rows, but table exists
        console.log(`   ✅ Table ${table} exists`);
        tablesCreated++;
      } else {
        console.log(`   ❌ Table ${table} not found: ${error.message}`);
      }
    }
    
    if (tablesCreated === tablesToCheck.length) {
      console.log('\n🎉 All v2 tables created successfully!');
      console.log('\nNext steps:');
      console.log('1. Fix data quality issues identified in validation');
      console.log('2. Migrate data from v1 to v2 tables');
      console.log('3. Update application code to use v2 tables');
      console.log('4. Test scoring average calculation');
    } else {
      console.log('\n⚠️  Some tables were not created. Please check the errors above.');
      console.log('\nYou may need to run the migration SQL directly in Supabase SQL editor.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
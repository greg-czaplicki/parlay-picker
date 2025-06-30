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
    
    // Split into individual statements (basic approach)
    const statements = migrationSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements to execute\n`);
    
    // Execute migration statements
    console.log('🔧 Executing migration...');
    let executedCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && statement.length > 10) { // Skip tiny statements
        try {
          console.log(`   [${i+1}/${statements.length}] Executing statement...`);
          const { error } = await supabase.rpc('exec_sql', { sql_statement: statement });
          
          if (error) {
            console.error(`   ❌ Error in statement ${i+1}:`, error.message);
            console.error(`   Statement: ${statement.substring(0, 100)}...`);
          } else {
            executedCount++;
          }
        } catch (err) {
          console.error(`   ❌ Exception in statement ${i+1}:`, err.message);
        }
      }
    }
    
    console.log(`\n✅ Migration completed! Executed ${executedCount} statements successfully\n`);
    
    // Verify migration results
    console.log('🔍 Verifying migration results...');
    
    // Check if v2 tables were created
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%_v2');
    
    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError.message);
    } else {
      console.log(`   ✅ Found ${tables.length} v2 tables:`);
      tables.forEach(t => console.log(`      - ${t.table_name}`));
    }
    
    console.log('\n🎉 Database migration to v2 schema completed!');
    console.log('\nNext steps:');
    console.log('1. Migrate data from v1 to v2 tables');
    console.log('2. Update application code to use v2 tables');
    console.log('3. Test scoring average calculation');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
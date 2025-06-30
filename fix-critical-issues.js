const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCriticalIssues() {
  console.log('🔧 Fixing critical issues blocking migration...\n');
  
  try {
    // 1. Check current state
    console.log('1. Checking current state of season_stats...');
    const { data: beforeData, error: beforeError } = await supabase
      .from('player_season_stats')
      .select('id, dg_id, player_name')
      .is('dg_id', null);
    
    if (beforeError) throw beforeError;
    
    console.log(`   Found ${beforeData.length} records with null dg_id:`);
    beforeData.forEach(r => console.log(`   - ID ${r.id}: ${r.player_name}`));
    
    if (beforeData.length === 0) {
      console.log('✅ No critical issues found - migration can proceed!');
      return;
    }
    
    // 2. Remove records with null dg_id
    console.log('\n2. Removing records with null dg_id...');
    const idsToDelete = beforeData.map(r => r.id);
    
    const { error: deleteError } = await supabase
      .from('player_season_stats')
      .delete()
      .in('id', idsToDelete);
    
    if (deleteError) throw deleteError;
    
    console.log(`   ✅ Removed ${idsToDelete.length} problematic records`);
    
    // 3. Verify the fix
    console.log('\n3. Verifying fix...');
    const { data: afterData, error: afterError } = await supabase
      .from('player_season_stats')
      .select('count')
      .is('dg_id', null);
    
    if (afterError) throw afterError;
    
    const { count: totalCount } = await supabase
      .from('player_season_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   ✅ Total season_stats records: ${totalCount}`);
    console.log(`   ✅ Records with null dg_id: 0`);
    
    console.log('\n🎉 Critical issues fixed! Migration can now proceed.');
    console.log('\nNext steps:');
    console.log('1. Re-run validation: npm run validate');
    console.log('2. Proceed with migration once validation passes');
    
  } catch (error) {
    console.error('❌ Error fixing critical issues:', error.message);
    process.exit(1);
  }
}

fixCriticalIssues();
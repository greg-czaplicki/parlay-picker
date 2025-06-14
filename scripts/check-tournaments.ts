import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

import { createSupabaseClient } from '../lib/api-utils';

async function checkTournaments() {
  const supabase = createSupabaseClient();
  
  console.log('🏌️ CHECKING TOURNAMENT DATA...\n');
  
  const { data } = await supabase
    .from('live_tournament_stats')
    .select('event_name, data_golf_updated_at')
    .not('sg_total', 'is', null)
    .order('data_golf_updated_at', { ascending: false })
    .limit(1000);

  if (!data) {
    console.log('❌ No data found');
    return;
  }

  // Group by event name
  const eventMap = new Map();
  
  data.forEach(row => {
    const event = row.event_name;
    const date = row.data_golf_updated_at;
    
    if (eventMap.has(event)) {
      const existing = eventMap.get(event);
      eventMap.set(event, {
        count: existing.count + 1,
        latestDate: date > existing.latestDate ? date : existing.latestDate,
        earliestDate: date < existing.earliestDate ? date : existing.earliestDate
      });
    } else {
      eventMap.set(event, {
        count: 1,
        latestDate: date,
        earliestDate: date
      });
    }
  });

  console.log('📊 TOURNAMENTS WITH SG DATA:\n');
  
  // Sort by latest date
  const sortedEvents = Array.from(eventMap.entries())
    .sort(([,a], [,b]) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

  sortedEvents.forEach(([event, info]) => {
    const status = info.count >= 100 ? '✅' : '⚠️ ';
    const latest = info.latestDate.slice(0, 10);
    console.log(`   ${status} ${event}`);
    console.log(`      ${info.count} rounds (latest: ${latest})`);
  });

  console.log(`\n🎯 SUMMARY:`);
  console.log(`   Total tournaments: ${eventMap.size}`);
  console.log(`   With 100+ rounds: ${sortedEvents.filter(([,info]) => info.count >= 100).length}`);
  console.log(`   Most recent: ${sortedEvents[0][0]} (${sortedEvents[0][1].latestDate.slice(0, 10)})`);
}

checkTournaments().catch(console.error); 
require('dotenv').config({ path: '.env.local' });

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY;

async function testDataGolfOpp() {
  console.log('🔍 Testing DataGolf OPP tour API...\n');

  // Test 3-ball matchups for OPP tour
  const url3ball = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`;
  
  try {
    console.log('Fetching OPP 3-ball matchups...');
    const response = await fetch(url3ball);
    const data = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Event name:', data.event_name);
    console.log('Tour:', data.tour);
    console.log('Round:', data.round_num);
    console.log('Last updated:', data.last_updated);
    
    if (typeof data.match_list === 'string') {
      console.log('\n⚠️  Match list is a string (error message):', data.match_list);
    } else if (Array.isArray(data.match_list)) {
      console.log(`\n✅ Found ${data.match_list.length} matchups`);
      if (data.match_list.length > 0) {
        console.log('\nFirst matchup sample:', JSON.stringify(data.match_list[0], null, 2));
      }
    } else {
      console.log('\n❌ Match list type:', typeof data.match_list);
    }
    
    // Also test field updates
    console.log('\n\n🔍 Testing field updates for OPP tour...');
    const urlField = `https://feeds.datagolf.com/field-updates?tour=opp&file_format=json&key=${DATA_GOLF_API_KEY}`;
    const fieldResponse = await fetch(urlField);
    const fieldData = await fieldResponse.json();
    
    console.log('\nField updates event name:', fieldData.event_name);
    console.log('Current round:', fieldData.current_round);
    console.log('Field size:', fieldData.field?.length || 0);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDataGolfOpp();
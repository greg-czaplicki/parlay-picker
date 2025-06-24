#!/usr/bin/env node

// Auto-settlement script for completed tournaments
// Usage: node scripts/auto-settle-completed.js
// Recommended: Run daily via cron at 6 AM EST

require('dotenv').config({ path: '.env.local' });

const https = require('https');

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function autoSettleCompleted() {
  console.log('🏌️ Auto-Settlement for Completed Tournaments');
  console.log('=' .repeat(50));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log();

  try {
    // Step 1: Check status
    console.log('📊 Checking status of completed tournaments...');
    const statusResponse = await makeRequest(`${BASE_URL}/api/settle-completed`);
    
    if (statusResponse.status !== 200) {
      console.error('❌ Status check failed:', statusResponse.status);
      console.error('Response:', statusResponse.data);
      process.exit(1);
    }

    const statusData = statusResponse.data.data || statusResponse.data;
    console.log(`Status: ${statusData.status}`);
    console.log(`Unsettled parlays: ${statusData.total_unsettled_parlays}`);
    console.log(`Unsettled picks: ${statusData.total_unsettled_picks}`);

    if (statusData.status === 'all_settled') {
      console.log('✅ All tournaments are settled - no action needed');
      process.exit(0);
    }

    // Step 2: Show tournaments that need settlement
    console.log('\\n🎯 Tournaments requiring settlement:');
    statusData.completed_tournaments.forEach((tournament, index) => {
      console.log(`  ${index + 1}. ${tournament.event_name} (${tournament.tour.toUpperCase()}) - ${tournament.unsettled_parlays} parlays, ${tournament.unsettled_picks} picks`);
    });

    // Step 3: Run settlement
    console.log('\\n⚙️ Running automated settlement...');
    const settlementResponse = await makeRequest(`${BASE_URL}/api/settle-completed`, {
      method: 'POST',
      body: {}
    });

    if (settlementResponse.status !== 200) {
      console.error('❌ Settlement failed:', settlementResponse.status);
      console.error('Response:', settlementResponse.data);
      process.exit(1);
    }

    const settlementData = settlementResponse.data.data || settlementResponse.data;
    console.log('\\n🎉 Settlement completed!');
    console.log(`Tournaments processed: ${settlementData.tournaments_processed}`);
    console.log(`Successful settlements: ${settlementData.successful_settlements}`);
    console.log(`Total picks settled: ${settlementData.total_picks_settled}`);

    // Step 4: Show detailed results
    if (settlementData.results && settlementData.results.length > 0) {
      console.log('\\n📋 Detailed results:');
      settlementData.results.forEach((result, index) => {
        const status = result.status === 'settled' ? '✅' : 
                      result.status === 'failed' ? '❌' : '⚠️';
        console.log(`  ${status} ${result.tournament} (${result.tour.toUpperCase()}): ${result.picks_settled || 0} picks settled`);
        
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
        
        if (result.errors && result.errors.length > 0) {
          console.log(`     Warnings: ${result.errors.join(', ')}`);
        }
      });
    }

    // Step 5: Final verification
    console.log('\\n🔍 Final verification...');
    const finalStatusResponse = await makeRequest(`${BASE_URL}/api/settle-completed`);
    const finalStatusData = finalStatusResponse.data.data || finalStatusResponse.data;
    
    if (finalStatusData.status === 'all_settled') {
      console.log('✅ Verification passed - all tournaments are now settled');
    } else {
      console.log(`⚠️ Verification shows ${finalStatusData.total_unsettled_parlays} parlays still unsettled`);
    }

    console.log('\\n🏁 Auto-settlement process completed');
    console.log(`Final timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('💥 Auto-settlement failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🏌️ Auto-Settlement for Completed Tournaments

Usage: node scripts/auto-settle-completed.js [options]

Options:
  --help, -h     Show this help message
  --dry-run      Check status only, don't run settlement
  --verbose      Show detailed output

Examples:
  node scripts/auto-settle-completed.js
  node scripts/auto-settle-completed.js --dry-run
  
Cron example (daily at 6 AM EST):
  0 6 * * * cd /path/to/project && node scripts/auto-settle-completed.js >> logs/auto-settle.log 2>&1
`);
  process.exit(0);
}

if (args.includes('--dry-run')) {
  console.log('🔍 DRY RUN MODE - checking status only');
  // Modify the function to only check status
  autoSettleCompleted = async function() {
    const statusResponse = await makeRequest(`${BASE_URL}/api/settle-completed`);
    const statusData = statusResponse.data.data || statusResponse.data;
    console.log('Status:', JSON.stringify(statusData, null, 2));
  };
}

// Run the auto-settlement
autoSettleCompleted().catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
}); 
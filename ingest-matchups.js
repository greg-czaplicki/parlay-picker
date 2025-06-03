#!/usr/bin/env node

// Universal script to ingest matchup data for any tour
// Usage: 
//   node ingest-matchups.js                    # Ingest PGA tour (default)
//   node ingest-matchups.js euro               # Ingest Euro tour
//   node ingest-matchups.js all                # Ingest all tours
//   node ingest-matchups.js pga opp euro       # Ingest specific tours

const http = require('http');
const https = require('https');

// Load environment variables from .env.local file (Next.js convention)
require('dotenv').config({ path: '.env.local' });

// Configuration
const BASE_URL = 'http://localhost:3000'; // Change to your deployment URL in production
const INGEST_SECRET = process.env.INGEST_SECRET;
const SUPPORTED_TOURS = ['pga', 'opp', 'euro', 'alt'];
const MAX_DATA_AGE_DAYS = 7; // Only ingest data updated within the last 7 days

if (!INGEST_SECRET) {
  console.error('❌ INGEST_SECRET environment variable is required');
  console.error('   Add INGEST_SECRET=your-secret-here to your .env.local file');
  process.exit(1);
}

function isDataRecent(lastUpdated) {
  const updated = new Date(lastUpdated.replace(' UTC', 'Z'));
  const now = new Date();
  const ageInDays = (now - updated) / (1000 * 60 * 60 * 24);
  return ageInDays <= MAX_DATA_AGE_DAYS;
}

function formatDataAge(lastUpdated) {
  const updated = new Date(lastUpdated.replace(' UTC', 'Z'));
  const now = new Date();
  const ageInDays = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
  return `${ageInDays} days ago`;
}

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    // Use http for localhost, https for everything else
    const protocol = url.startsWith('https://') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function ingestTour(tour) {
  console.log(`🏌️ Starting ${tour.toUpperCase()} tour matchup ingestion...`);
  
  // First, check if the data is recent by fetching just the metadata
  const checkUrl = `${BASE_URL}/api/matchups/check-freshness?tour=${tour}`;
  
  try {
    // Check data freshness first
    const checkResponse = await makeRequest(checkUrl, { method: 'GET' });
    
    if (checkResponse.status === 200 && checkResponse.data.last_updated) {
      const lastUpdated = checkResponse.data.last_updated;
      const eventName = checkResponse.data.event_name;
      const dataAge = formatDataAge(lastUpdated);
      
      if (!isDataRecent(lastUpdated)) {
        console.log(`⚠️  ${tour.toUpperCase()} tour data is stale (${dataAge})`);
        console.log(`   Event: ${eventName}`);
        console.log(`   Last updated: ${lastUpdated}`);
        console.log(`   Skipping ingestion (data older than ${MAX_DATA_AGE_DAYS} days)`);
        return { success: false, error: 'Data too old', skipped: true };
      }
      
      console.log(`📅 ${tour.toUpperCase()} tour data is recent (${dataAge})`);
      console.log(`   Event: ${eventName}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not check data freshness for ${tour.toUpperCase()}, proceeding anyway...`);
  }
  
  // Proceed with normal ingestion
  const url = `${BASE_URL}/api/matchups/ingest?tour=${tour}`;
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${INGEST_SECRET}`,
      'Content-Type': 'application/json'
    }
  };

  try {
    const response = await makeRequest(url, options);
    
    if (response.status === 200) {
      console.log(`✅ ${tour.toUpperCase()} tour matchups ingested successfully!`);
      
      if (response.data.inserted > 0) {
        console.log(`🎯 Inserted ${response.data.inserted} total matchups`);
        console.log(`   - 3-ball: ${response.data.three_ball}`);
        console.log(`   - 2-ball: ${response.data.two_ball}`);
        console.log(`   - Event: ${response.data.debug?.eventName || 'Unknown'}`);
      } else {
        console.log(`📭 No matchups found for ${tour.toUpperCase()} tour`);
      }
      return { success: true, data: response.data };
    } else {
      console.error(`❌ Failed to ingest ${tour.toUpperCase()} tour matchups`);
      console.error(`Status: ${response.status}`);
      console.error('Response:', response.data);
      return { success: false, error: response.data };
    }
  } catch (error) {
    console.error(`❌ Error during ${tour.toUpperCase()} tour ingestion:`, error.message);
    return { success: false, error: error.message };
  }
}

async function ingestMultipleTours(tours) {
  const results = [];
  let totalInserted = 0;
  let totalThreeBall = 0;
  let totalTwoBall = 0;

  console.log(`🚀 Starting multi-tour ingestion for: ${tours.join(', ').toUpperCase()}\n`);

  for (const tour of tours) {
    const result = await ingestTour(tour);
    results.push({ tour, ...result });
    
    if (result.success && result.data && result.data.inserted > 0) {
      totalInserted += result.data.inserted;
      totalThreeBall += result.data.three_ball;
      totalTwoBall += result.data.two_ball;
    }
    
    // Add a small delay between requests to be nice to the API
    if (tours.length > 1 && tour !== tours[tours.length - 1]) {
      console.log('   ⏱️ Waiting 2 seconds before next tour...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🏆 Multi-tour ingestion completed!');
  console.log(`📊 Grand totals across all tours:`);
  console.log(`   - Total matchups: ${totalInserted}`);
  console.log(`   - 3-ball matchups: ${totalThreeBall}`);
  console.log(`   - 2-ball matchups: ${totalTwoBall}`);
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  
  if (successful.length > 0) {
    console.log(`✅ Successful tours: ${successful.map(r => r.tour.toUpperCase()).join(', ')}`);
  }
  if (skipped.length > 0) {
    console.log(`⏭️  Skipped tours (stale data): ${skipped.map(r => r.tour.toUpperCase()).join(', ')}`);
  }
  if (failed.length > 0) {
    console.log(`❌ Failed tours: ${failed.map(r => r.tour.toUpperCase()).join(', ')}`);
  }
}

function printUsage() {
  console.log('🏌️ Universal Golf Matchup Ingestion Tool\n');
  console.log('Usage:');
  console.log('  node ingest-matchups.js                    # Ingest PGA tour (default)');
  console.log('  node ingest-matchups.js euro               # Ingest Euro tour');
  console.log('  node ingest-matchups.js all                # Ingest all supported tours');
  console.log('  node ingest-matchups.js pga opp euro       # Ingest specific tours\n');
  console.log(`Supported tours: ${SUPPORTED_TOURS.join(', ')}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

// Determine which tours to ingest
let toursToIngest = [];

if (args.length === 0) {
  // Default to PGA tour
  toursToIngest = ['pga'];
} else if (args.includes('all')) {
  // Ingest all supported tours
  toursToIngest = SUPPORTED_TOURS;
} else {
  // Validate provided tours
  for (const arg of args) {
    if (SUPPORTED_TOURS.includes(arg)) {
      toursToIngest.push(arg);
    } else {
      console.error(`❌ Invalid tour: ${arg}`);
      console.error(`Supported tours: ${SUPPORTED_TOURS.join(', ')}`);
      process.exit(1);
    }
  }
}

// Remove duplicates
toursToIngest = [...new Set(toursToIngest)];

// Run the ingestion
ingestMultipleTours(toursToIngest); 
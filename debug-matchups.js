// Temporary script to debug 3-ball matchups issue
// Run with: node debug-matchups.js

const https = require('https');

// Replace with your actual API key
const apiKey = "fb03cadc312c2f0015bc8c5354ea";

// URLs for both PGA and opposite field
const pgaUrl = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=3_balls&odds_format=decimal&file_format=json&key=${apiKey}`;
const oppUrl = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=3_balls&odds_format=decimal&file_format=json&key=${apiKey}`;

// Function to make a GET request
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Function to fetch tournament data from database
async function fetchTournaments() {
  console.log("Please manually check your database for the following tournaments:");
  console.log("- 'PGA Championship'");
  console.log("- 'ONEflight Myrtle Beach Classic'");
  console.log("\nEnsure both exist and check the exact spelling in your tournaments table.");
}

// Main execution
async function main() {
  try {
    console.log("Fetching PGA and Opposite Field matchups...");
    const [pgaData, oppData] = await Promise.all([
      fetchData(pgaUrl),
      fetchData(oppUrl)
    ]);
    
    console.log("\n--- PGA EVENT INFO ---");
    console.log("Event name:", pgaData.event_name);
    console.log("Last updated:", pgaData.last_updated);
    console.log("Round number:", pgaData.round_num);
    console.log("Number of matchups:", Array.isArray(pgaData.match_list) ? pgaData.match_list.length : "Not an array");
    
    console.log("\n--- OPPOSITE FIELD EVENT INFO ---");
    console.log("Event name:", oppData.event_name);
    console.log("Last updated:", oppData.last_updated);
    console.log("Round number:", oppData.round_num);
    console.log("Number of matchups:", Array.isArray(oppData.match_list) ? oppData.match_list.length : "Not an array");

    console.log("\nNow checking for potential tournament name mismatches...");
    await fetchTournaments();
    
    console.log("\nPOTENTIAL ISSUES TO CHECK:");
    console.log("1. Event name mismatch between API and database");
    console.log("2. Database constraints that might be causing opposite field inserts to fail");
    console.log("3. Check onConflict settings in the route.ts file");
    console.log("4. Review server logs for any database errors during insert/upsert");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
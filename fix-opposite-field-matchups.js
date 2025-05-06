// Temporary script to manually insert opposite field matchups
// Run with: node fix-opposite-field-matchups.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Replace with your actual API key if needed
const apiKey = process.env.DATAGOLF_API_KEY || "fb03cadc312c2f0015bc8c5354ea";

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Service Role Key missing in environment variables.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// URL for opposite field
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

// Main execution
async function main() {
  try {
    console.log("Fetching opposite field tournament data from database...");
    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("event_id, event_name");
    
    if (tournamentsError) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError.message}`);
    }

    console.log(`Found ${tournaments.length} tournaments in database.`);
    
    console.log("Fetching Opposite Field matchups from API...");
    const oppData = await fetchData(oppUrl);
    
    console.log(`Retrieved data for "${oppData.event_name}"`);
    console.log(`Last updated: ${oppData.last_updated}`);
    console.log(`Round: ${oppData.round_num}`);
    
    if (!Array.isArray(oppData.match_list)) {
      throw new Error("match_list is not an array in API response");
    }
    
    console.log(`Found ${oppData.match_list.length} matchups`);
    
    // Create event name to ID map
    const eventNameToId = new Map();
    tournaments.forEach(t => eventNameToId.set(t.event_name, t.event_id));
    
    // Find event ID for the opposite field event
    let event_id = eventNameToId.get(oppData.event_name);
    
    if (!event_id) {
      console.error(`WARNING: Could not find an exact match for "${oppData.event_name}" in the database!`);
      
      // Try to find a partial match
      const possibleMatches = tournaments.filter(t => {
        const oppName = oppData.event_name.toLowerCase();
        const dbName = t.event_name.toLowerCase();
        return oppName.includes(dbName) || dbName.includes(oppName);
      });
      
      if (possibleMatches.length > 0) {
        console.log("Found possible matches:");
        possibleMatches.forEach((match, i) => {
          console.log(`${i+1}. "${match.event_name}" (ID: ${match.event_id})`);
        });
        
        // Ask for manual selection (only if running interactively)
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
          readline.question('Enter the number of the correct match, or 0 to abort: ', resolve);
        });
        
        readline.close();
        
        const selection = parseInt(answer);
        if (selection > 0 && selection <= possibleMatches.length) {
          event_id = possibleMatches[selection-1].event_id;
          console.log(`Selected event ID ${event_id}`);
        } else {
          console.log("Operation aborted or invalid selection");
          process.exit(0);
        }
      } else {
        console.log("No potential matches found in database.");
        console.log("Please ensure the tournament exists in your database first.");
        process.exit(1);
      }
    }
    
    // Prepare matchups for insertion
    const matchupsToInsert = oppData.match_list.map(matchup => {
      const fanduelOdds = matchup.odds.fanduel;
      const draftkingsOdds = matchup.odds.draftkings;
      const datagolfOdds = matchup.odds.datagolf;
      
      return {
        event_id,
        event_name: oppData.event_name,
        round_num: oppData.round_num,
        data_golf_update_time: new Date(oppData.last_updated.replace(" UTC", "Z")).toISOString(),
        p1_dg_id: matchup.p1_dg_id,
        p1_player_name: matchup.p1_player_name,
        p2_dg_id: matchup.p2_dg_id,
        p2_player_name: matchup.p2_player_name,
        p3_dg_id: matchup.p3_dg_id,
        p3_player_name: matchup.p3_player_name,
        ties_rule: matchup.ties,
        fanduel_p1_odds: fanduelOdds?.p1 ?? null,
        fanduel_p2_odds: fanduelOdds?.p2 ?? null,
        fanduel_p3_odds: fanduelOdds?.p3 ?? null,
        draftkings_p1_odds: draftkingsOdds?.p1 ?? null,
        draftkings_p2_odds: draftkingsOdds?.p2 ?? null,
        draftkings_p3_odds: draftkingsOdds?.p3 ?? null,
        datagolf_p1_odds: datagolfOdds?.p1 ?? null,
        datagolf_p2_odds: datagolfOdds?.p2 ?? null,
        datagolf_p3_odds: datagolfOdds?.p3 ?? null,
      };
    });
    
    console.log(`Prepared ${matchupsToInsert.length} matchups for insertion`);
    
    // Insert into historical table
    console.log("Inserting into three_ball_matchups (historical)...");
    const { error: insertError } = await supabase
      .from("three_ball_matchups")
      .insert(matchupsToInsert);
      
    if (insertError) {
      console.error("Error inserting historical matchups:", insertError);
    } else {
      console.log("Successfully inserted historical matchups");
    }
    
    // Upsert into latest table
    console.log("Upserting into latest_three_ball_matchups...");
    const { error: upsertError } = await supabase
      .from("latest_three_ball_matchups")
      .upsert(matchupsToInsert, {
        onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id, p3_dg_id',
      });
      
    if (upsertError) {
      console.error("Error upserting latest matchups:", upsertError);
    } else {
      console.log("Successfully upserted latest matchups");
    }
    
    console.log("Operation complete!");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
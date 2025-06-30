#!/usr/bin/env node

// Tournament name validation script
// Usage: node scripts/validate-tournament-names.js [tour]
// Example: node scripts/validate-tournament-names.js pga

require('dotenv').config({ path: '.env.local' });

const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const DATA_GOLF_API_KEY = process.env.DATAGOLF_API_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!DATA_GOLF_API_KEY || !supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SUPPORTED_TOURS = ['pga', 'euro', 'opp', 'alt'];

function getDG3BallURL(tour = 'pga') {
  return `https://feeds.datagolf.com/betting-tools/matchups?tour=${tour}&market=3_balls&odds_format=decimal&file_format=json&key=${DATA_GOLF_API_KEY}`;
}

function fetchDG(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

function calculateSimilarity(str1, str2) {
  const normalize = (str) => 
    str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.9;
  }

  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  
  if (maxLength === 0) return 1.0;
  
  return 1 - (distance / maxLength);
}

function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[str2.length][str1.length];
}

async function validateTournamentName(apiEventName, tour) {
  console.log(`\n🔍 Validating: "${apiEventName}" (${tour.toUpperCase()})`);

  // 1. Check for exact match
  const { data: exactMatch } = await supabase
    .from('tournaments_v2')
    .select('event_id, event_name, tour, start_date')
    .eq('event_name', apiEventName)
    .eq('tour', tour)
    .limit(1)
    .single();

  if (exactMatch) {
    console.log(`✅ Exact match found: "${exactMatch.event_name}" (ID: ${exactMatch.event_id})`);
    return { status: 'valid', match: exactMatch };
  }

  // 2. Check for alias match
  const { data: aliasMatches } = await supabase
    .from('tournament_aliases')
    .select(`
      event_id,
      tournaments!inner(event_name, tour, start_date)
    `)
    .eq('alias_name', apiEventName);

  const validAliases = aliasMatches?.filter(item => item.tournaments.tour === tour) || [];
  
  if (validAliases.length > 0) {
    const alias = validAliases[0];
    console.log(`✅ Alias match found: "${alias.tournaments.event_name}" (ID: ${alias.event_id})`);
    return { status: 'valid', match: alias.tournaments };
  }

  // 3. Look for fuzzy matches
  const { data: tournaments } = await supabase
    .from('tournaments_v2')
    .select('event_id, event_name, tour, start_date')
    .eq('tour', tour)
    .order('start_date', { ascending: false })
    .limit(20);

  const fuzzyMatches = tournaments
    ?.map(t => ({
      ...t,
      similarity: calculateSimilarity(apiEventName, t.event_name)
    }))
    .filter(t => t.similarity > 0.6)
    .sort((a, b) => b.similarity - a.similarity) || [];

  if (fuzzyMatches.length > 0) {
    console.log(`⚠️  Potential matches found:`);
    fuzzyMatches.slice(0, 3).forEach(match => {
      console.log(`   - "${match.event_name}" (${(match.similarity * 100).toFixed(1)}% similar, ID: ${match.event_id})`);
    });

    const bestMatch = fuzzyMatches[0];
    if (bestMatch.similarity > 0.8) {
      return { 
        status: 'fuzzy_match', 
        match: bestMatch,
        recommendation: 'add_alias'
      };
    }
  }

  console.log(`❌ No match found for "${apiEventName}"`);
  return { 
    status: 'no_match', 
    suggestions: fuzzyMatches.slice(0, 3),
    recommendation: 'add_tournament_or_update_name'
  };
}

async function addTournamentAlias(eventId, aliasName, source = 'validation_script') {
  try {
    const { error } = await supabase
      .from('tournament_aliases')
      .upsert({
        event_id: eventId,
        alias_name: aliasName,
        source,
        is_primary: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'event_id,alias_name'
      });

    if (error) throw error;
    console.log(`✅ Added alias: "${aliasName}" for event_id: ${eventId}`);
  } catch (error) {
    console.error(`❌ Failed to add alias:`, error.message);
  }
}

async function validateTour(tour) {
  console.log(`\n🏌️ Validating ${tour.toUpperCase()} tour tournament names...\n`);

  try {
    // Fetch current DataGolf data
    const dgData = await fetchDG(getDG3BallURL(tour));
    
    if (!dgData.event_name) {
      console.log(`⚠️  No current event data for ${tour.toUpperCase()} tour`);
      return;
    }

    console.log(`📅 Current event: "${dgData.event_name}"`);
    console.log(`📊 Last updated: ${dgData.last_updated}`);
    console.log(`🎯 Round: ${dgData.round_num}`);

    const validation = await validateTournamentName(dgData.event_name, tour);

    // Handle validation results
    switch (validation.status) {
      case 'valid':
        console.log(`\n✅ Tournament name validation passed!`);
        break;

      case 'fuzzy_match':
        console.log(`\n⚠️  Fuzzy match detected. Recommend adding alias.`);
        console.log(`Would you like to add "${dgData.event_name}" as an alias for "${validation.match.event_name}"?`);
        
        // Auto-add alias for high-confidence fuzzy matches
        if (validation.match.similarity > 0.85) {
          await addTournamentAlias(validation.match.event_id, dgData.event_name);
        }
        break;

      case 'no_match':
        console.log(`\n❌ Tournament name mismatch detected!`);
        console.log(`\nRecommended actions:`);
        console.log(`1. Update database tournament name to: "${dgData.event_name}"`);
        console.log(`2. Or add "${dgData.event_name}" as an alias to existing tournament`);
        
        if (validation.suggestions.length > 0) {
          console.log(`\nPossible matches:`);
          validation.suggestions.forEach(s => {
            console.log(`   - "${s.event_name}" (${(s.similarity * 100).toFixed(1)}% similar)`);
          });
        }
        break;
    }

  } catch (error) {
    console.error(`❌ Error validating ${tour.toUpperCase()} tour:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const requestedTour = args[0];

  console.log('🔍 Tournament Name Validation Tool\n');

  if (requestedTour && !SUPPORTED_TOURS.includes(requestedTour)) {
    console.error(`❌ Invalid tour: ${requestedTour}`);
    console.log(`Supported tours: ${SUPPORTED_TOURS.join(', ')}`);
    process.exit(1);
  }

  const toursToValidate = requestedTour ? [requestedTour] : SUPPORTED_TOURS;

  for (const tour of toursToValidate) {
    await validateTour(tour);
    
    // Add delay between tours to be respectful to the API
    if (toursToValidate.length > 1 && tour !== toursToValidate[toursToValidate.length - 1]) {
      console.log('\n⏱️  Waiting 2 seconds before next tour...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n🏁 Validation complete!');
}

main().catch(console.error); 
#!/usr/bin/env node

// Test script for tournament name resolver
// Usage: node scripts/test-tournament-resolver.js

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Simple logger for testing
const logger = {
  info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[WARN] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[ERROR] ${msg}`, ...args)
};

// Simplified tournament resolver for testing
class TournamentNameResolver {
  constructor() {
    this.supabase = supabase;
  }

  async resolveTournamentName(apiEventName, tour, startDate) {
    logger.info(`Resolving tournament name: "${apiEventName}" for tour: ${tour}`);

    // 1. Try exact match first
    const exactMatch = await this.findExactMatch(apiEventName, tour, startDate);
    if (exactMatch) {
      logger.info(`Found exact match for "${apiEventName}"`);
      return { ...exactMatch, confidence: 1.0, match_type: 'exact' };
    }

    // 2. Try alias match
    const aliasMatch = await this.findAliasMatch(apiEventName, tour, startDate);
    if (aliasMatch) {
      logger.info(`Found alias match for "${apiEventName}"`);
      return { ...aliasMatch, confidence: 0.95, match_type: 'alias' };
    }

    // 3. Try fuzzy matching
    const fuzzyMatch = await this.findFuzzyMatch(apiEventName, tour, startDate);
    if (fuzzyMatch) {
      logger.info(`Found fuzzy match for "${apiEventName}": "${fuzzyMatch.event_name}"`);
      return fuzzyMatch;
    }

    logger.warn(`No tournament match found for "${apiEventName}"`);
    return null;
  }

  async findExactMatch(eventName, tour, startDate) {
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date')
      .eq('event_name', eventName);

    if (tour) query = query.eq('tour', tour);
    if (startDate) query = query.gte('start_date', startDate).lte('end_date', startDate);

    const { data, error } = await query.limit(1).single();

    if (error || !data) return null;
    return data;
  }

  async findAliasMatch(eventName, tour, startDate) {
    let query = this.supabase
      .from('tournament_aliases')
      .select(`
        event_id,
        tournaments!inner(event_name, tour, start_date, end_date)
      `)
      .eq('alias_name', eventName);

    const { data, error } = await query;

    if (error || !data || data.length === 0) return null;

    // Filter by tour and date if provided
    const filtered = data.filter(item => {
      const tournament = item.tournaments;
      if (tour && tournament.tour !== tour) return false;
      if (startDate) {
        const start = new Date(tournament.start_date);
        const end = new Date(tournament.end_date);
        const date = new Date(startDate);
        if (date < start || date > end) return false;
      }
      return true;
    });

    if (filtered.length === 0) return null;

    const match = filtered[0];
    const tournament = match.tournaments;
    return {
      event_id: match.event_id,
      event_name: tournament.event_name,
      tour: tournament.tour,
      start_date: tournament.start_date
    };
  }

  async findFuzzyMatch(eventName, tour, startDate) {
    // Get tournaments for fuzzy matching
    let query = this.supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date, end_date');

    if (tour) query = query.eq('tour', tour);

    // If we have a start date, look for tournaments around that time (±7 days)
    if (startDate) {
      const date = new Date(startDate);
      const weekBefore = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekAfter = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
      query = query
        .gte('start_date', weekBefore.toISOString().split('T')[0])
        .lte('start_date', weekAfter.toISOString().split('T')[0]);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) return null;

    // Calculate similarity scores
    const matches = data
      .map(tournament => ({
        ...tournament,
        confidence: this.calculateSimilarity(eventName, tournament.event_name),
        match_type: 'fuzzy'
      }))
      .filter(match => match.confidence > 0.7) // Only consider matches above 70% similarity
      .sort((a, b) => b.confidence - a.confidence);

    return matches.length > 0 ? matches[0] : null;
  }

  calculateSimilarity(str1, str2) {
    // Normalize strings for comparison
    const normalize = (str) => 
      str.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')    // Normalize whitespace
        .trim();

    const norm1 = normalize(str1);
    const norm2 = normalize(str2);

    // Check if one is contained in the other (high confidence)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.9;
    }

    // Use Levenshtein distance for similarity
    const distance = this.levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

async function runTests() {
  console.log('🧪 Testing Tournament Name Resolver\n');
  
  const resolver = new TournamentNameResolver();
  
  // Test cases
  const testCases = [
    {
      name: 'Exact match test',
      input: 'Rocket Classic',
      tour: 'pga',
      expected: 'exact'
    },
    {
      name: 'Alias match test', 
      input: 'Rocket Mortgage Classic',
      tour: 'pga',
      expected: 'alias'
    },
    {
      name: 'Fuzzy match test',
      input: 'U.S Open',
      tour: 'pga', 
      expected: 'fuzzy'
    },
    {
      name: 'No match test',
      input: 'Nonexistent Tournament',
      tour: 'pga',
      expected: null
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.name} ---`);
    console.log(`Input: "${testCase.input}" (${testCase.tour})`);
    
    try {
      const result = await resolver.resolveTournamentName(testCase.input, testCase.tour);
      
      if (result) {
        console.log(`✅ Found: "${result.event_name}" (ID: ${result.event_id})`);
        console.log(`   Match type: ${result.match_type}, Confidence: ${result.confidence}`);
        
        if (testCase.expected && result.match_type === testCase.expected) {
          console.log(`✅ Test passed - expected ${testCase.expected}`);
        } else if (testCase.expected) {
          console.log(`❌ Test failed - expected ${testCase.expected}, got ${result.match_type}`);
        }
      } else {
        console.log(`❌ No match found`);
        if (testCase.expected === null) {
          console.log(`✅ Test passed - expected no match`);
        } else {
          console.log(`❌ Test failed - expected ${testCase.expected}, got null`);
        }
      }
    } catch (error) {
      console.error(`❌ Error:`, error.message);
    }
  }

  console.log('\n🏁 Testing complete!');
}

runTests().catch(console.error); 
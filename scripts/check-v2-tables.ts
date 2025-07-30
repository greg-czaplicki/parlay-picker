#!/usr/bin/env tsx

import { createSupabaseClient } from '../lib/api-utils'

async function checkV2Tables() {
  const supabase = createSupabaseClient()
  
  console.log('🔍 Checking v2 tables and their data...\n')
  
  const v2Tables = [
    'matchups_v2',
    'parlays_v2', 
    'parlay_picks_v2',
    'tournaments_v2',
    'players_v2',
    'courses_v2'
  ]
  
  for (const tableName of v2Tables) {
    try {
      // Check if table exists and get row count
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${tableName}: Does not exist`)
        } else {
          console.log(`⚠️  ${tableName}: Error - ${error.message}`)
        }
      } else {
        console.log(`✅ ${tableName}: ${count} rows`)
        
        // Get a sample of recent data
        const { data: sample } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3)
        
        if (sample && sample.length > 0) {
          console.log(`   Latest entries:`)
          sample.forEach((row: any, i: number) => {
            const id = row.id || row.uuid || row.event_id || 'no-id'
            const created = row.created_at || row.updated_at || 'no-date'
            console.log(`   ${i + 1}. ID: ${id}, Created: ${created}`)
          })
        }
        console.log('')
      }
    } catch (err) {
      console.log(`❌ ${tableName}: Connection error - ${err}`)
    }
  }
  
  // Check current tables too for comparison
  console.log('\n🔍 Checking current schema tables...\n')
  
  const currentTables = [
    'betting_markets',
    'parlays',
    'parlay_picks', 
    'tournaments',
    'players',
    'courses'
  ]
  
  for (const tableName of currentTables) {
    try {
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      console.log(`✅ ${tableName}: ${count} rows`)
    } catch (err) {
      console.log(`❌ ${tableName}: Error or doesn't exist`)
    }
  }
}

checkV2Tables().catch(console.error)
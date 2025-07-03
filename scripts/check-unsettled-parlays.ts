#!/usr/bin/env tsx

import { createSupabaseClient } from '../lib/api-utils'

async function checkUnsettledParlays() {
  const supabase = createSupabaseClient()
  
  console.log('Checking for unsettled parlays...\n')
  
  // 1. Check for unsettled picks
  const { data: unsettledPicks, error: picksError } = await supabase
    .from('parlay_picks_v2')
    .select(`
      id,
      parlay_id,
      picked_player_name,
      settlement_status,
      pick_outcome,
      event_id,
      matchups_v2!inner(
        event_id,
        round_num
      )
    `)
    .eq('settlement_status', 'pending')
    .limit(20)
  
  if (picksError) {
    console.error('Error fetching picks:', picksError)
    return
  }
  
  console.log(`Found ${unsettledPicks?.length || 0} unsettled picks`)
  
  if (unsettledPicks && unsettledPicks.length > 0) {
    // Get unique event IDs
    const eventIds = [...new Set(unsettledPicks.map(p => p.event_id || p.matchups_v2?.event_id).filter(Boolean))]
    
    // Get tournament info for these events
    const { data: tournaments } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, tour, start_date, end_date')
      .in('event_id', eventIds)
    
    console.log('\nTournaments with unsettled picks:')
    tournaments?.forEach(t => {
      const pickCount = unsettledPicks.filter(p => 
        (p.event_id || p.matchups_v2?.event_id) === t.event_id
      ).length
      console.log(`- ${t.event_name} (${t.tour}): ${pickCount} picks`)
      console.log(`  Dates: ${t.start_date} to ${t.end_date}`)
    })
    
    // Show sample of unsettled picks
    console.log('\nSample unsettled picks:')
    unsettledPicks.slice(0, 5).forEach(pick => {
      console.log(`- Pick ID: ${pick.id}, Player: ${pick.picked_player_name}, Status: ${pick.settlement_status}`)
    })
  }
  
  // 2. Check for parlays without outcomes
  const { data: unsettledParlays } = await supabase
    .from('parlays_v2')
    .select(`
      id,
      created_at,
      amount,
      outcome,
      parlay_picks_v2!inner(
        settlement_status,
        pick_outcome
      )
    `)
    .is('outcome', null)
    .limit(10)
  
  console.log(`\nFound ${unsettledParlays?.length || 0} parlays without outcomes`)
  
  // 3. Check if columns exist
  const { data: columns } = await supabase
    .rpc('get_table_columns', { table_name: 'parlay_picks_v2' })
    .select('column_name')
    .in('column_name', ['settled_at', 'settlement_notes'])
  
  console.log('\nChecking for required columns:')
  console.log(`- settled_at: ${columns?.some(c => c.column_name === 'settled_at') ? '✓ exists' : '✗ missing'}`)
  console.log(`- settlement_notes: ${columns?.some(c => c.column_name === 'settlement_notes') ? '✓ exists' : '✗ missing'}`)
}

checkUnsettledParlays().catch(console.error)
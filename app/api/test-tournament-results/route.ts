import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const supabase = createServerClient()

export async function GET(request: NextRequest) {
  try {
    console.log('=== TESTING TOURNAMENT RESULTS ===')
    
    // Test for The Open specifically (event_id 100)
    console.log('1. Testing tournament_results_v2 for The Open (event_id 100)...')
    const { data: openResults, error: openError } = await supabase
      .from('tournament_results_v2')
      .select(`
        *,
        tournaments_v2!inner(event_name, course_name)
      `)
      .eq('event_id', 100)
      .not('final_position', 'is', null)
      .order('final_position', { ascending: true })
      .limit(20)
    
    console.log('Open results:', openResults?.length || 0)
    if (openError) console.error('Open error:', openError)
    
    // Test for any tournament results
    console.log('2. Testing tournament_results_v2 for any recent data...')
    const { data: anyResults, error: anyError } = await supabase
      .from('tournament_results_v2')
      .select(`
        *,
        tournaments_v2!inner(event_name, course_name)
      `)
      .not('final_position', 'is', null)
      .order('final_position', { ascending: true })
      .limit(10)
    
    console.log('Any results:', anyResults?.length || 0)
    if (anyError) console.error('Any error:', anyError)
    
    // Test for specific event IDs we know exist
    console.log('3. Testing for events 100, 472 (current tournaments)...')
    const { data: eventResults, error: eventError } = await supabase
      .from('tournament_results_v2')
      .select(`
        *,
        tournaments_v2!inner(event_name, course_name)
      `)
      .in('event_id', [100, 472])
      .not('final_position', 'is', null)
      .order('final_position', { ascending: true })
      .limit(20)
    
    console.log('Event results:', eventResults?.length || 0)
    if (eventError) console.error('Event error:', eventError)
    
    // Check what data is in tournament_results_v2 table
    console.log('4. Testing raw tournament_results_v2 data...')
    const { data: rawResults, error: rawError } = await supabase
      .from('tournament_results_v2')
      .select('*')
      .limit(5)
    
    console.log('Raw results:', rawResults?.length || 0)
    if (rawError) console.error('Raw error:', rawError)
    
    return NextResponse.json({
      openResults: {
        count: openResults?.length || 0,
        data: openResults || [],
        error: openError
      },
      anyResults: {
        count: anyResults?.length || 0,
        data: anyResults || [],
        error: anyError
      },
      eventResults: {
        count: eventResults?.length || 0,
        data: eventResults || [],
        error: eventError
      },
      rawResults: {
        count: rawResults?.length || 0,
        data: rawResults || [],
        error: rawError
      }
    })
    
  } catch (error) {
    console.error('Test tournament results error:', error)
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 })
  }
}
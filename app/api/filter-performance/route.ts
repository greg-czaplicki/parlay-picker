import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// GET: Fetch filter performance data
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const filterPreset = searchParams.get('filter')
  const eventId = searchParams.get('eventId')
  const roundNum = searchParams.get('roundNum')
  const timePeriod = searchParams.get('period') || 'last_30_days'
  const includeHistorical = searchParams.get('includeHistorical') === 'true'

  try {
    // If requesting specific event/round data
    if (eventId && roundNum) {
      return await getEventRoundPerformance(supabase, parseInt(eventId), parseInt(roundNum), filterPreset)
    }

    // If requesting historical performance
    if (includeHistorical) {
      return await getHistoricalPerformance(supabase, filterPreset, timePeriod)
    }

    // Default: recent performance snapshots
    return await getRecentPerformance(supabase, filterPreset)

  } catch (error: any) {
    console.error('Error in filter performance API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Get performance for specific event/round
async function getEventRoundPerformance(
  supabase: any, 
  eventId: number, 
  roundNum: number, 
  filterPreset?: string | null
) {
  let query = supabase
    .from('filter_performance_snapshots')
    .select('*')
    .eq('event_id', eventId)
    .eq('round_num', roundNum)

  if (filterPreset) {
    query = query.eq('filter_preset', filterPreset)
  }

  const { data, error } = await query.order('analysis_timestamp', { ascending: false })

  if (error) {
    throw error
  }

  return NextResponse.json({ 
    performances: data || [],
    eventId,
    roundNum,
    filterPreset 
  })
}

// Get historical performance data
async function getHistoricalPerformance(
  supabase: any,
  filterPreset?: string | null,
  timePeriod: string = 'last_30_days'
) {
  let query = supabase
    .from('filter_historical_performance')
    .select('*')
    .eq('analysis_period', timePeriod)

  if (filterPreset) {
    query = query.eq('filter_preset', filterPreset)
  }

  const { data, error } = await query.order('overall_edge', { ascending: false })

  if (error) {
    throw error
  }

  return NextResponse.json({
    historical: data || [],
    period: timePeriod,
    filterPreset
  })
}

// Get recent performance snapshots
async function getRecentPerformance(
  supabase: any,
  filterPreset?: string | null
) {
  let query = supabase
    .from('latest_filter_performance')
    .select('*')

  if (filterPreset) {
    query = query.eq('filter_preset', filterPreset)
  }

  const { data, error } = await query
    .order('analysis_timestamp', { ascending: false })
    .limit(50)

  if (error) {
    throw error
  }

  return NextResponse.json({
    recent: data || [],
    filterPreset
  })
}

// POST: Trigger filter performance analysis for an event/round
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { eventId, roundNum, forceReanalysis = false } = body

    if (!eventId || !roundNum) {
      return NextResponse.json(
        { error: 'eventId and roundNum are required' },
        { status: 400 }
      )
    }

    // Check if analysis already exists (unless forcing reanalysis)
    if (!forceReanalysis) {
      const { data: existing } = await supabase
        .from('filter_performance_snapshots')
        .select('id')
        .eq('event_id', eventId)
        .eq('round_num', roundNum)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({
          message: 'Analysis already exists for this event/round',
          eventId,
          roundNum,
          existing: true
        })
      }
    }

    // Trigger background analysis (in a real app, this would be a queue job)
    // For now, we'll return a success response and let the analysis happen async
    // TODO: Implement actual background job processing

    return NextResponse.json({
      message: 'Filter performance analysis triggered',
      eventId,
      roundNum,
      status: 'queued'
    })

  } catch (error: any) {
    console.error('Error triggering filter analysis:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
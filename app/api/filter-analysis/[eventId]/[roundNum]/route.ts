import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { MatchupFilterPerformanceEngine, FilterPerformanceSnapshot } from '@/lib/matchup-filter-performance-engine'
import { FilterPreset } from '@/types/matchup-filters'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

interface RouteParams {
  params: {
    eventId: string
    roundNum: string
  }
}

// GET: Get filter analysis for specific event/round
export async function GET(
  req: NextRequest,
  { params }: RouteParams
) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const eventId = parseInt(params.eventId)
  const roundNum = parseInt(params.roundNum)
  const filterPreset = searchParams.get('filter') as FilterPreset | null
  const includeRawAnalysis = searchParams.get('includeRaw') === 'true'

  try {
    // Fetch existing performance snapshots
    let query = supabase
      .from('filter_performance_snapshots')
      .select('*')
      .eq('event_id', eventId)
      .eq('round_num', roundNum)

    if (filterPreset) {
      query = query.eq('filter_preset', filterPreset)
    }

    const { data: snapshots, error } = await query
      .order('analysis_timestamp', { ascending: false })

    if (error) {
      throw error
    }

    let result: any = {
      eventId,
      roundNum,
      snapshots: snapshots || [],
      hasAnalysis: (snapshots?.length || 0) > 0
    }

    // If requested, include raw analysis data
    if (includeRawAnalysis && !result.hasAnalysis) {
      // Fetch matchups for this event/round
      const matchupsResult = await fetch(
        `${req.nextUrl.origin}/api/matchups?eventId=${eventId}&roundNum=${roundNum}&type=3ball`
      )
      
      if (matchupsResult.ok) {
        const { matchups } = await matchupsResult.json()
        
        if (matchups && matchups.length > 0) {
          // Fetch player stats and tournament stats
          const [playerStatsResult, tournamentStatsResult] = await Promise.all([
            supabase.from('player_skill_ratings').select('*'),
            supabase.from('tournament_round_snapshots')
              .select('*')
              .eq('event_id', eventId)
              .eq('round_num', roundNum.toString())
          ])

          const playerStats = playerStatsResult.data || []
          const tournamentStats = tournamentStatsResult.data || []

          // Create performance engine and run analysis
          const engine = new MatchupFilterPerformanceEngine(playerStats, tournamentStats)
          const allAnalyses = engine.analyzeAllFilters(matchups, eventId, roundNum)

          // Convert to raw analysis format
          const rawAnalysis: any = {}
          allAnalyses.forEach((analyses, preset) => {
            rawAnalysis[preset] = {
              totalMatchups: matchups.length,
              flaggedMatchups: analyses.filter(a => a.flaggedByFilter).length,
              analyses: analyses
            }
          })

          result.rawAnalysis = rawAnalysis
        }
      }
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Error in filter analysis API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Trigger complete filter analysis for event/round
export async function POST(
  req: NextRequest,
  { params }: RouteParams
) {
  const supabase = createSupabaseClient()
  const eventId = parseInt(params.eventId)
  const roundNum = parseInt(params.roundNum)

  try {
    const body = await req.json()
    const { forceReanalysis = false, includeResultsOnly = false } = body

    // Check if analysis already exists
    if (!forceReanalysis) {
      const { data: existing } = await supabase
        .from('filter_performance_snapshots')
        .select('id')
        .eq('event_id', eventId)
        .eq('round_num', roundNum)
        .limit(1)

      if (existing && existing.length > 0) {
        return NextResponse.json({
          message: 'Analysis already exists',
          eventId,
          roundNum,
          existing: true
        })
      }
    }

    // Fetch required data for analysis
    const [matchupsResponse, resultsResponse, eventResponse] = await Promise.all([
      // Get matchups for this event/round
      fetch(`${req.nextUrl.origin}/api/matchups?eventId=${eventId}&roundNum=${roundNum}`),
      
      // Get results for this event/round (if available)
      fetch(`${req.nextUrl.origin}/api/matchup-results?eventId=${eventId}&roundNum=${roundNum}`),
      
      // Get event info
      supabase
        .from('tournaments')
        .select('name')
        .eq('dg_id', eventId)
        .single()
    ])

    if (!matchupsResponse.ok) {
      throw new Error('Failed to fetch matchups')
    }

    const { matchups } = await matchupsResponse.json()
    const { results } = resultsResponse.ok ? await resultsResponse.json() : { results: [] }
    const eventName = eventResponse.data?.name || `Event ${eventId}`

    if (!matchups || matchups.length === 0) {
      return NextResponse.json({
        error: 'No matchups found for this event/round',
        eventId,
        roundNum
      }, { status: 404 })
    }

    // If only doing results analysis and no results available, return early
    if (includeResultsOnly && (!results || results.length === 0)) {
      return NextResponse.json({
        message: 'No results available for performance calculation',
        eventId,
        roundNum,
        matchupsFound: matchups.length,
        resultsFound: 0
      })
    }

    // Fetch player and tournament stats
    const [playerStatsResult, tournamentStatsResult] = await Promise.all([
      supabase.from('player_skill_ratings').select('*'),
      supabase.from('tournament_round_snapshots')
        .select('*')
        .eq('event_id', eventId)
        .eq('round_num', roundNum.toString())
    ])

    const playerStats = playerStatsResult.data || []
    const tournamentStats = tournamentStatsResult.data || []

    // Create performance engine
    const engine = new MatchupFilterPerformanceEngine(playerStats, tournamentStats)
    
    // Analyze all filters
    const allAnalyses = engine.analyzeAllFilters(matchups, eventId, roundNum)
    
    const performanceSnapshots: FilterPerformanceSnapshot[] = []
    const filterPresets: FilterPreset[] = ['fade-chalk', 'stat-dom', 'form-play', 'value', 'data-intel']

    // Calculate performance for each filter
    for (const preset of filterPresets) {
      const analyses = allAnalyses.get(preset) || []
      
      const performance = engine.calculateFilterPerformance(
        analyses,
        results || [],
        eventId,
        eventName,
        roundNum,
        preset
      )
      
      performanceSnapshots.push(performance)
    }

    // Store performance snapshots in database
    const snapshotRecords = performanceSnapshots.map(snapshot => ({
      event_id: snapshot.eventId,
      event_name: snapshot.eventName,
      round_num: snapshot.roundNum,
      filter_preset: snapshot.filterPreset,
      filter_config: snapshot.filterConfig,
      total_matchups_analyzed: snapshot.totalMatchupsAnalyzed,
      matchups_flagged_by_filter: snapshot.matchupsFlaggedByFilter,
      flagged_matchups_won: snapshot.flaggedMatchupsWon,
      flagged_matchups_lost: snapshot.flaggedMatchupsLost,
      win_rate: snapshot.winRate,
      expected_win_rate: snapshot.expectedWinRate,
      edge_detected: snapshot.edgeDetected,
      total_potential_payout: snapshot.totalPotentialPayout,
      actual_payout: snapshot.actualPayout,
      roi_percentage: snapshot.roiPercentage,
      sample_size_confidence: snapshot.sampleSizeConfidence,
      statistical_significance: snapshot.statisticalSignificance,
      performance_2ball: snapshot.performance2Ball,
      performance_3ball: snapshot.performance3Ball,
      analysis_timestamp: snapshot.analysisTimestamp.toISOString()
    }))

    const { data: insertedSnapshots, error: insertError } = await supabase
      .from('filter_performance_snapshots')
      .upsert(snapshotRecords, {
        onConflict: 'event_id,round_num,filter_preset',
        ignoreDuplicates: false
      })
      .select()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      message: 'Filter analysis completed successfully',
      eventId,
      roundNum,
      eventName,
      matchupsAnalyzed: matchups.length,
      resultsProcessed: results?.length || 0,
      snapshotsCreated: insertedSnapshots?.length || 0,
      snapshots: performanceSnapshots
    })

  } catch (error: any) {
    console.error('Error running filter analysis:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
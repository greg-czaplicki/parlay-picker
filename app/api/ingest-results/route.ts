import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { MatchupResultProcessor } from '@/lib/matchup-result-processor'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// POST: Ingest matchup results for specific event/round
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { 
      eventId, 
      roundNum, 
      forceReprocess = false,
      options = {}
    } = body

    if (!eventId || !roundNum) {
      return NextResponse.json(
        { error: 'eventId and roundNum are required' },
        { status: 400 }
      )
    }

    // Check if results already exist (unless forcing reprocess)
    if (!forceReprocess) {
      const { data: existingResults } = await supabase
        .from('matchup_results')
        .select('id')
        .eq('event_id', eventId)
        .eq('round_num', roundNum)
        .limit(1)

      if (existingResults && existingResults.length > 0) {
        return NextResponse.json({
          message: 'Results already exist for this event/round',
          eventId,
          roundNum,
          existing: true
        })
      }
    }

    // Create result processor with options
    const processor = new MatchupResultProcessor(supabase, options)

    // Process and ingest results
    const ingestionResult = await processor.ingestEventRoundResults(eventId, roundNum)

    // If results were successfully processed, trigger filter analysis
    if (ingestionResult.saved > 0) {
      try {
        // Trigger filter performance analysis
        const analysisResponse = await fetch(
          `${req.nextUrl.origin}/api/filter-analysis/${eventId}/${roundNum}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceReanalysis: forceReprocess })
          }
        )

        if (analysisResponse.ok) {
          const analysisResult = await analysisResponse.json()
          ingestionResult.analysisTriggered = true
          ingestionResult.analysisResult = analysisResult
        } else {
          ingestionResult.analysisTriggered = false
          ingestionResult.analysisError = 'Failed to trigger analysis'
        }
      } catch (analysisError) {
        console.error('Error triggering filter analysis:', analysisError)
        ingestionResult.analysisTriggered = false
        ingestionResult.analysisError = analysisError instanceof Error ? analysisError.message : 'Unknown analysis error'
      }
    }

    return NextResponse.json({
      message: 'Result ingestion completed',
      eventId,
      roundNum,
      ...ingestionResult
    })

  } catch (error: any) {
    console.error('Error in result ingestion API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET: Check ingestion status for event/round
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const eventId = searchParams.get('eventId')
  const roundNum = searchParams.get('roundNum')

  if (!eventId || !roundNum) {
    return NextResponse.json(
      { error: 'eventId and roundNum are required' },
      { status: 400 }
    )
  }

  try {
    // Check for existing results
    const { data: results, error: resultsError } = await supabase
      .from('matchup_results')
      .select('id, created_at, winner_name')
      .eq('event_id', parseInt(eventId))
      .eq('round_num', parseInt(roundNum))

    if (resultsError) {
      throw resultsError
    }

    // Check for filter analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('filter_performance_snapshots')
      .select('id, analysis_timestamp, filter_preset, win_rate')
      .eq('event_id', parseInt(eventId))
      .eq('round_num', parseInt(roundNum))

    if (analysisError) {
      throw analysisError
    }

    // Check total matchups for comparison
    const matchupsResponse = await fetch(
      `${req.nextUrl.origin}/api/matchups?eventId=${eventId}&roundNum=${roundNum}&checkOnly=true`
    )
    
    let totalMatchups = 0
    if (matchupsResponse.ok) {
      const { count } = await matchupsResponse.json()
      totalMatchups = count
    }

    return NextResponse.json({
      eventId: parseInt(eventId),
      roundNum: parseInt(roundNum),
      status: {
        hasResults: (results?.length || 0) > 0,
        hasAnalysis: (analysis?.length || 0) > 0,
        resultsCount: results?.length || 0,
        analysisCount: analysis?.length || 0,
        totalMatchups,
        completionPercentage: totalMatchups > 0 ? ((results?.length || 0) / totalMatchups) * 100 : 0
      },
      results: results || [],
      analysis: analysis || []
    })

  } catch (error: any) {
    console.error('Error checking ingestion status:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
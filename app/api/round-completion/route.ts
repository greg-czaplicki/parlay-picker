import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { RoundCompletionDetector } from '@/lib/round-completion-detector'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

// GET: Check round completion status
export async function GET(req: NextRequest) {
  const supabase = createSupabaseClient()
  const { searchParams } = new URL(req.url)
  
  const eventId = searchParams.get('eventId')
  const roundNum = searchParams.get('roundNum')
  const checkAll = searchParams.get('checkAll') === 'true'
  const recentlyCompleted = searchParams.get('recentlyCompleted') === 'true'

  try {
    const detector = new RoundCompletionDetector(supabase)

    // Check specific event/round
    if (eventId && roundNum && !checkAll) {
      const status = await detector.checkRoundCompletion(
        parseInt(eventId), 
        parseInt(roundNum)
      )
      
      return NextResponse.json({ status })
    }

    // Check recently completed rounds
    if (recentlyCompleted) {
      const hoursBack = parseInt(searchParams.get('hoursBack') || '6')
      const rounds = await detector.getRecentlyCompletedRounds(hoursBack)
      
      return NextResponse.json({ 
        recentlyCompleted: rounds,
        count: rounds.length 
      })
    }

    // Check all active rounds
    if (checkAll) {
      const allStatuses = await detector.checkAllActiveRounds()
      
      // Group by completion status
      const completed = allStatuses.filter(s => s.isComplete)
      const inProgress = allStatuses.filter(s => !s.isComplete && s.inProgressPlayers > 0)
      const notStarted = allStatuses.filter(s => s.notStartedPlayers === s.totalPlayers)
      
      return NextResponse.json({
        summary: {
          total: allStatuses.length,
          completed: completed.length,
          inProgress: inProgress.length,
          notStarted: notStarted.length
        },
        completed,
        inProgress,
        notStarted,
        all: allStatuses
      })
    }

    return NextResponse.json(
      { error: 'Must specify eventId/roundNum, checkAll=true, or recentlyCompleted=true' },
      { status: 400 }
    )

  } catch (error: any) {
    console.error('Error in round completion API:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Process newly completed rounds (trigger result ingestion)
export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { 
      autoProcess = true,
      criteria = {}
    } = body

    const detector = new RoundCompletionDetector(supabase, criteria)

    if (autoProcess) {
      // Automatically process newly completed rounds
      const processingResult = await detector.processNewlyCompletedRounds()
      
      return NextResponse.json({
        message: 'Auto-processing completed',
        ...processingResult
      })
    } else {
      // Just return recently completed rounds without processing
      const recentlyCompleted = await detector.getRecentlyCompletedRounds()
      
      return NextResponse.json({
        message: 'Recently completed rounds found',
        rounds: recentlyCompleted,
        count: recentlyCompleted.length
      })
    }

  } catch (error: any) {
    console.error('Error in round completion processing:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
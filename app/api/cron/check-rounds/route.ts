import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { RoundCompletionDetector } from '@/lib/round-completion-detector'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute max

// This endpoint will be called by Vercel Cron every 4 hours
export async function GET(req: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseClient()
  
  try {
    console.log('🕐 Cron job: Checking for completed rounds...')
    
    const detector = new RoundCompletionDetector(supabase, {
      minCompletionPercentage: 80
    })

    // Get recently completed rounds (last 6 hours to avoid missing any)
    const recentlyCompleted = await detector.getRecentlyCompletedRounds(6)
    
    if (recentlyCompleted.length === 0) {
      console.log('✅ No new completed rounds found')
      return NextResponse.json({
        message: 'No new completed rounds',
        timestamp: new Date().toISOString(),
        roundsFound: 0
      })
    }

    console.log(`🎯 Found ${recentlyCompleted.length} newly completed rounds`)
    
    // Process each completed round
    const results = []
    for (const round of recentlyCompleted) {
      try {
        // Trigger result ingestion (this calls the existing API)
        const ingestionResponse = await fetch(`${req.nextUrl.origin}/api/ingest-results`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}` // Internal auth
          },
          body: JSON.stringify({
            eventId: round.eventId,
            roundNum: round.roundNum,
            forceReprocess: false
          })
        })

        if (ingestionResponse.ok) {
          const ingestionResult = await ingestionResponse.json()
          results.push({
            eventId: round.eventId,
            roundNum: round.roundNum,
            success: true,
            resultsIngested: ingestionResult.saved || 0,
            analysisTriggered: ingestionResult.analysisTriggered || false
          })
        } else {
          const errorData = await ingestionResponse.json()
          results.push({
            eventId: round.eventId,
            roundNum: round.roundNum,
            success: false,
            error: errorData.error
          })
        }
      } catch (error) {
        console.error(`Error processing round ${round.roundNum} for event ${round.eventId}:`, error)
        results.push({
          eventId: round.eventId,
          roundNum: round.roundNum,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalResults = results.reduce((sum, r) => sum + (r.resultsIngested || 0), 0)

    console.log(`✅ Cron job completed: ${successCount}/${results.length} rounds processed, ${totalResults} results ingested`)

    return NextResponse.json({
      message: 'Cron job completed',
      timestamp: new Date().toISOString(),
      roundsFound: recentlyCompleted.length,
      roundsProcessed: successCount,
      totalResultsIngested: totalResults,
      results
    })

  } catch (error: any) {
    console.error('❌ Cron job failed:', error)
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Also allow POST for manual triggering
export async function POST(req: NextRequest) {
  return GET(req)
}
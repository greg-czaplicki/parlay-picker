import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'

// Helper to check if tournaments are active
function getCurrentWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0,0,0,0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23,59,59,999);
  return {
    monday: monday.toISOString().split('T')[0],
    sunday: sunday.toISOString().split('T')[0],
  }
}

async function getActiveTournaments() {
  const { createSupabaseClient } = await import('@/lib/api-utils')
  const supabase = createSupabaseClient()
  
  const { monday, sunday } = getCurrentWeekRange()
  logger.info(`Checking for active tournaments in current week: ${monday} to ${sunday}`)
  
  const { data: activeTournaments, error } = await supabase
    .from('tournaments')
    .select('dg_id, name, tour')
    .gte('start_date', monday)
    .lte('start_date', sunday)
  
  if (error) {
    logger.error('Error fetching active tournaments:', error)
    return []
  }
  
  logger.info(`Found ${activeTournaments?.length || 0} active tournaments:`, activeTournaments)
  return activeTournaments || []
}

// Helper to determine if it's during tournament hours (EST)
function isDuringTournamentHours(): boolean {
  const now = new Date()
  const est = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}))
  const hour = est.getHours()
  const day = est.getDay() // 0 = Sunday, 6 = Saturday
  
  // Tournament hours: Thursday-Sunday, 6 AM - 8 PM EST
  const isTournamentDay = day >= 4 || day === 0 // Thu(4), Fri(5), Sat(6), Sun(0)
  const isTournamentHour = hour >= 6 && hour <= 20
  
  return isTournamentDay && isTournamentHour
}

// Helper to sync tournaments using multiple APIs intelligently
async function smartTournamentSync(): Promise<{ success: boolean; count: number; events: string[] }> {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000'
  
  let totalCount = 0
  const events: string[] = []
  
  try {
    // 1. First run in-play predictions API for accurate round progression
    logger.info('🎯 Running in-play predictions API for accurate round progression')
    const inPlayResponse = await fetch(`${baseUrl}/api/live-stats/sync`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (inPlayResponse.ok) {
      const inPlayData = await inPlayResponse.json()
      logger.info('📊 In-play API response:', inPlayData)
      if (inPlayData.success) {
        totalCount += inPlayData.processedCount || 0
        events.push(...(inPlayData.eventNames || []))
        logger.info(`✅ In-play sync successful: ${inPlayData.processedCount} records with correct round progression`)
      } else {
        logger.warn('⚠️ In-play sync returned success: false')
      }
    } else {
      logger.error(`❌ In-play API failed with status: ${inPlayResponse.status}`)
    }
    
    // 2. Then run auto-sync to add SG data while preserving round progression
    logger.info('🔄 Running auto-sync to add stroke gained data')
    const autoSyncResponse = await fetch(`${baseUrl}/api/live-stats/auto-sync`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
    
    if (autoSyncResponse.ok) {
      const autoSyncData = await autoSyncResponse.json()
      logger.info('📊 Auto-sync API response:', autoSyncData)
      if (autoSyncData.success) {
        totalCount += autoSyncData.data?.totalProcessed || 0
        logger.info(`✅ Auto-sync successful: ${autoSyncData.data?.totalProcessed} additional records with SG data`)
      } else {
        logger.warn('⚠️ Auto-sync returned success: false')
      }
    } else {
      logger.error(`❌ Auto-sync API failed with status: ${autoSyncResponse.status}`)
    }
    
    return { success: true, count: totalCount, events: [...new Set(events)] }
    
  } catch (error) {
    logger.error('❌ Smart tournament sync failed:', error)
    return { success: false, count: 0, events: [] }
  }
}

export async function GET(request: NextRequest) {
  // Verify this is coming from authorized source (Vercel Cron or GitHub Actions)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  logger.info('🏌️ Live tournament sync triggered - v2')

  try {
    // Check if we should run during current time
    const isDuringHours = isDuringTournamentHours()
    if (!isDuringHours) {
      logger.info('⏰ Outside tournament hours - skipping live sync')
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: 'Outside tournament hours',
        duringTournamentHours: false,
        timestamp: new Date().toISOString()
      })
    }

    // Check if we have active tournaments
    const activeTournaments = await getActiveTournaments()
    if (activeTournaments.length === 0) {
      logger.info('🏌️ No active tournaments - skipping live sync')
      return NextResponse.json({
        success: true,
        action: 'skipped',
        reason: 'No active tournaments',
        activeTournaments: [],
        duringTournamentHours: true,
        timestamp: new Date().toISOString()
      })
    }

    logger.info(`🎯 Found ${activeTournaments.length} active tournaments during tournament hours`)

    // Run smart tournament sync
    const syncResult = await smartTournamentSync()
    
    // Initialize snapshot service for automatic triggers
    const snapshotService = new TournamentSnapshotService()
    
    // Check for round completions and trigger snapshots if needed
    // (This will be implemented in the next phase)
    
    const duration = Date.now() - startTime
    const message = syncResult.success 
      ? `Live sync complete: ${syncResult.count} records processed for ${syncResult.events.length} events`
      : 'Live sync failed'
    
    logger.info(`✅ ${message} (${duration}ms)`)
    
    return NextResponse.json({
      success: syncResult.success,
      action: 'completed',
      activeTournaments: activeTournaments.map((t: any) => ({ name: t.name, tour: t.tour })),
      duringTournamentHours: true,
      processedCount: syncResult.count,
      events: syncResult.events,
      duration,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('❌ Live tournament sync failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
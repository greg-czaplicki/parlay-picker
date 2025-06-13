import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

// Helper to check if tournaments are active
async function getActiveTournaments() {
  const supabase = createSupabaseClient()
  const today = new Date().toISOString().split('T')[0]
  
  const { data, error } = await supabase
    .from('tournaments')
    .select('event_id, event_name, start_date, end_date, tour')
    .lte('start_date', today)
    .gte('end_date', today)
  
  if (error) {
    logger.error('Error fetching active tournaments:', error)
    return []
  }
  
  return data || []
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

// Helper to sync a specific tour
async function syncTour(tour: 'pga' | 'opp'): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/live-stats/sync-tour?tour=${tour}`, {
      method: 'GET'
    })
    
    const data = await response.json()
    
    if (data.success) {
      return { success: true, count: data.data.processedCount }
    } else {
      return { success: false, count: 0, error: data.message }
    }
  } catch (error) {
    return { success: false, count: 0, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function GET() {
  logger.info('Auto-sync triggered')
  
  try {
    // Check if we have active tournaments
    const activeTournaments = await getActiveTournaments()
    
    if (activeTournaments.length === 0) {
      logger.info('No active tournaments - skipping auto-sync')
      return jsonSuccess({
        action: 'skipped',
        reason: 'No active tournaments',
        tournaments: [],
      }, 'No active tournaments found - sync skipped')
    }
    
    const isDuringHours = isDuringTournamentHours()
    logger.info(`Active tournaments found: ${activeTournaments.length}, During tournament hours: ${isDuringHours}`)
    
    // Determine which tours to sync based on active tournaments
    const toursToSync = new Set<'pga' | 'opp'>()
    activeTournaments.forEach(tournament => {
      if (tournament.tour === 'pga') toursToSync.add('pga')
      if (tournament.tour === 'opp') toursToSync.add('opp')
    })
    
    const results = []
    let totalProcessed = 0
    
    // Sync each required tour
    for (const tour of toursToSync) {
      const result = await syncTour(tour)
      results.push({
        tour,
        success: result.success,
        count: result.count,
        error: result.error
      })
      totalProcessed += result.count
      
      // Add delay between requests to be respectful to the API
      if (toursToSync.size > 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const message = `Auto-sync complete: ${successCount}/${results.length} tours synced, ${totalProcessed} records processed`
    
    logger.info(message, { results, activeTournaments: activeTournaments.map(t => t.event_name) })
    
    return jsonSuccess({
      action: 'completed',
      activeTournaments: activeTournaments.map(t => ({ name: t.event_name, tour: t.tour })),
      duringTournamentHours: isDuringHours,
      results,
      totalProcessed,
      timestamp: new Date().toISOString()
    }, message)
    
  } catch (error) {
    logger.error('Auto-sync failed:', error)
    return handleApiError(error)
  }
} 
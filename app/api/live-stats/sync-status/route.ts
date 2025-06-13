import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createSupabaseClient()
    
    // Get active tournaments
    const today = new Date().toISOString().split('T')[0]
    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('event_id, event_name, start_date, end_date, tour')
      .lte('start_date', today)
      .gte('end_date', today)
    
    if (!activeTournaments || activeTournaments.length === 0) {
      return jsonSuccess({
        status: 'no_active_tournaments',
        activeTournaments: [],
        syncHealth: 'healthy',
        lastSync: null,
        message: 'No active tournaments - sync not needed'
      }, 'No active tournaments found')
    }
    
    // Check sync freshness for each active tournament
    const syncStatus = []
    const now = new Date()
    
    for (const tournament of activeTournaments) {
      const { data: stats } = await supabase
        .from('latest_live_tournament_stats_view')
        .select('data_golf_updated_at, round_num')
        .eq('event_name', tournament.event_name)
        .order('data_golf_updated_at', { ascending: false })
        .limit(1)
      
      const lastSync = stats?.[0]?.data_golf_updated_at
      const minutesSinceSync = lastSync 
        ? Math.floor((now.getTime() - new Date(lastSync).getTime()) / (1000 * 60))
        : null
      
      // Check if we have SG data
      const { data: sgCheck } = await supabase
        .from('latest_live_tournament_stats_view')
        .select('sg_total')
        .eq('event_name', tournament.event_name)
        .not('sg_total', 'is', null)
        .limit(1)
      
      const hasSGData = (sgCheck?.length || 0) > 0
      
      syncStatus.push({
        tournament: tournament.event_name,
        tour: tournament.tour,
        lastSync,
        minutesSinceSync,
        hasSGData,
        health: minutesSinceSync === null ? 'no_data' 
               : minutesSinceSync > 90 ? 'stale'     // 1.5 hours
               : minutesSinceSync > 45 ? 'warning'   // 45 minutes  
               : 'fresh'                             // Under 45 minutes
      })
    }
    
    // Overall health assessment
    const overallHealth = syncStatus.every(s => s.health === 'fresh') ? 'healthy'
                        : syncStatus.some(s => s.health === 'stale') ? 'degraded'
                        : 'warning'
    
    return jsonSuccess({
      status: 'active_tournaments',
      activeTournaments: activeTournaments.map(t => ({ 
        name: t.event_name, 
        tour: t.tour,
        dates: `${t.start_date} to ${t.end_date}`
      })),
      syncHealth: overallHealth,
      syncStatus,
      timestamp: now.toISOString(),
      recommendations: syncStatus
        .filter(s => s.health !== 'fresh')
        .map(s => `${s.tournament}: ${s.health} (${s.minutesSinceSync} minutes old)`)
    }, `Sync status: ${overallHealth}`)
    
  } catch (error) {
    logger.error('Error checking sync status:', error)
    return handleApiError(error)
  }
} 
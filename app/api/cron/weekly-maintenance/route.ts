import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: any[] = []
  const startTime = Date.now()

  try {
    console.log('🧹 Starting weekly maintenance...')
    
    const supabase = createSupabaseClient()

    // 1. Clean up old live stats data (keep last 30 days)
    console.log('🗑️ Cleaning up old live stats...')
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: deletedStats, error: statsError } = await supabase
        .from('live_stats')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (statsError) {
        throw new Error(`Live stats cleanup failed: ${statsError.message}`)
      }

      results.push({
        task: 'cleanup_live_stats',
        success: true,
        message: 'Old live stats cleaned up',
        cutoff_date: thirtyDaysAgo.toISOString()
      })
      console.log('✅ Old live stats cleaned up')
    } catch (error: any) {
      console.error('❌ Live stats cleanup failed:', error)
      results.push({
        task: 'cleanup_live_stats',
        success: false,
        error: error.message
      })
    }

    // 2. Clean up old unused matchup data (preserve historical data needed for filter performance)
    console.log('🗑️ Cleaning up old unused matchups...')
    try {
      // Only delete matchups that are NOT needed for filter performance tracking
      // Keep all matchups that have results in matchup_results table
      // Only delete very old matchups (1+ year) that have no results
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

      // Delete only matchups older than 1 year that don't have results
      const { data: deletedMatchups, error: matchupsError } = await supabase
        .from('betting_markets')
        .delete()
        .lt('created_at', oneYearAgo.toISOString())
        .not('id', 'in', 
          `(SELECT DISTINCT matchup_id FROM matchup_results WHERE matchup_id IS NOT NULL)`
        )

      if (matchupsError) {
        throw new Error(`Matchups cleanup failed: ${matchupsError.message}`)
      }

      results.push({
        task: 'cleanup_unused_matchups',
        success: true,
        message: 'Old unused matchups cleaned up (preserved historical data for filter tracking)',
        cutoff_date: oneYearAgo.toISOString(),
        note: 'Kept all matchups with filter performance results'
      })
      console.log('✅ Old unused matchups cleaned up (preserved filter performance data)')
    } catch (error: any) {
      console.error('❌ Matchups cleanup failed:', error)
      results.push({
        task: 'cleanup_unused_matchups',
        success: false,
        error: error.message
      })
    }

    // 3. Clean up old parlay data (keep last 180 days for better historical analysis)
    console.log('🗑️ Cleaning up old parlays...')
    try {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180)

      const { data: deletedParlays, error: parlaysError } = await supabase
        .from('parlays')
        .delete()
        .lt('created_at', sixMonthsAgo.toISOString())

      if (parlaysError) {
        throw new Error(`Parlays cleanup failed: ${parlaysError.message}`)
      }

      results.push({
        task: 'cleanup_old_parlays',
        success: true,
        message: 'Old parlays cleaned up (extended retention for better analysis)',
        cutoff_date: sixMonthsAgo.toISOString(),
        note: 'Extended retention from 90 to 180 days for historical analysis'
      })
      console.log('✅ Old parlays cleaned up (6-month retention)')
    } catch (error: any) {
      console.error('❌ Parlays cleanup failed:', error)
      results.push({
        task: 'cleanup_old_parlays',
        success: false,
        error: error.message
      })
    }

    // 4. Filter performance data maintenance (preserve ALL historical data)
    console.log('📊 Managing filter performance data...')
    try {
      // Check filter performance table sizes
      const { count: resultsCount } = await supabase
        .from('matchup_results')
        .select('*', { count: 'exact', head: true })

      const { count: performanceCount } = await supabase
        .from('filter_performance_snapshots')
        .select('*', { count: 'exact', head: true })

      const { count: historicalCount } = await supabase
        .from('filter_historical_performance')
        .select('*', { count: 'exact', head: true })

      // Only clean up filter_performance_events older than 2 years (these are just event logs)
      const twoYearsAgo = new Date()
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

      const { data: deletedEvents, error: eventsError } = await supabase
        .from('filter_performance_events')
        .delete()
        .lt('created_at', twoYearsAgo.toISOString())

      results.push({
        task: 'filter_performance_maintenance',
        success: true,
        message: 'Filter performance data maintained',
        data_stats: {
          matchup_results: resultsCount || 0,
          performance_snapshots: performanceCount || 0,
          historical_performance: historicalCount || 0,
          old_events_cleaned: 'Events older than 2 years removed'
        },
        note: 'ALL matchup results and performance data preserved for historical analysis'
      })
      console.log('✅ Filter performance data maintained (preserved all historical data)')
    } catch (error: any) {
      console.error('❌ Filter performance maintenance failed:', error)
      results.push({
        task: 'filter_performance_maintenance',
        success: false,
        error: error.message
      })
    }

    // 5. Database optimization - analyze tables
    console.log('📊 Running database optimization...')
    try {
      // Get table statistics
      const { data: tableStats, error: statsAnalysisError } = await supabase
        .from('information_schema.tables')
        .select('table_name, table_rows')
        .eq('table_schema', 'public')

      if (statsAnalysisError) {
        throw new Error(`Table analysis failed: ${statsAnalysisError.message}`)
      }

      results.push({
        task: 'database_analysis',
        success: true,
        message: 'Database statistics collected',
        table_stats: tableStats
      })
      console.log('✅ Database analysis completed')
    } catch (error: any) {
      console.error('❌ Database analysis failed:', error)
      results.push({
        task: 'database_analysis',
        success: false,
        error: error.message
      })
    }

    // 6. Health check - verify critical tables have recent data
    console.log('🏥 Running system health check...')
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      // Check for recent live stats
      const { count: recentStatsCount, error: recentStatsError } = await supabase
        .from('live_stats')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())

      // Check for recent matchups
      const { count: recentMatchupsCount, error: recentMatchupsError } = await supabase
        .from('betting_markets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())

      const healthStatus = {
        recent_stats: recentStatsCount || 0,
        recent_matchups: recentMatchupsCount || 0,
        data_freshness: 'good',
        timestamp: new Date().toISOString()
      }

      // Determine overall health
      if ((recentStatsCount || 0) === 0 && (recentMatchupsCount || 0) === 0) {
        healthStatus.data_freshness = 'stale'
      }

      results.push({
        task: 'health_check',
        success: true,
        health_status: healthStatus
      })
      console.log('✅ Health check completed')
    } catch (error: any) {
      console.error('❌ Health check failed:', error)
      results.push({
        task: 'health_check',
        success: false,
        error: error.message
      })
    }

    const endTime = Date.now()
    const executionTime = endTime - startTime
    
    // Calculate success rate
    const successfulTasks = results.filter(r => r.success).length
    const totalTasks = results.length
    const successRate = (successfulTasks / totalTasks) * 100

    console.log(`✅ Weekly maintenance completed in ${executionTime}ms`)
    console.log(`📊 Success rate: ${successfulTasks}/${totalTasks} (${successRate.toFixed(1)}%)`)
    
    return NextResponse.json({
      success: true,
      message: 'Weekly maintenance completed',
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      success_rate: successRate,
      results
    })

  } catch (error: any) {
    console.error('❌ Weekly maintenance failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
      results
    }, { status: 500 })
  }
} 
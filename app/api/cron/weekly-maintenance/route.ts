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

    // 2. Clean up old matchup data (keep last 60 days)
    console.log('🗑️ Cleaning up old matchups...')
    try {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const { data: deletedMatchups, error: matchupsError } = await supabase
        .from('betting_markets')
        .delete()
        .lt('created_at', sixtyDaysAgo.toISOString())

      if (matchupsError) {
        throw new Error(`Matchups cleanup failed: ${matchupsError.message}`)
      }

      results.push({
        task: 'cleanup_matchups',
        success: true,
        message: 'Old matchups cleaned up',
        cutoff_date: sixtyDaysAgo.toISOString()
      })
      console.log('✅ Old matchups cleaned up')
    } catch (error: any) {
      console.error('❌ Matchups cleanup failed:', error)
      results.push({
        task: 'cleanup_matchups',
        success: false,
        error: error.message
      })
    }

    // 3. Clean up old parlay data (keep last 90 days)
    console.log('🗑️ Cleaning up old parlays...')
    try {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const { data: deletedParlays, error: parlaysError } = await supabase
        .from('parlays')
        .delete()
        .lt('created_at', ninetyDaysAgo.toISOString())

      if (parlaysError) {
        throw new Error(`Parlays cleanup failed: ${parlaysError.message}`)
      }

      results.push({
        task: 'cleanup_parlays',
        success: true,
        message: 'Old parlays cleaned up',
        cutoff_date: ninetyDaysAgo.toISOString()
      })
      console.log('✅ Old parlays cleaned up')
    } catch (error: any) {
      console.error('❌ Parlays cleanup failed:', error)
      results.push({
        task: 'cleanup_parlays',
        success: false,
        error: error.message
      })
    }

    // 4. Database optimization - analyze tables
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

    // 5. Health check - verify critical tables have recent data
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
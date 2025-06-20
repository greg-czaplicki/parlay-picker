import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Verify this is coming from Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: any[] = []
  const startTime = Date.now()

  try {
    console.log('🤖 Starting daily data sync...')
    
    // Get the base URL for internal API calls
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    // 1. Sync tournament schedules first (foundation data)
    console.log('📅 Syncing tournament schedules...')
    try {
      const scheduleResponse = await fetch(`${baseUrl}/api/schedule/sync`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (scheduleResponse.ok) {
        const scheduleResult = await scheduleResponse.json()
        results.push({
          task: 'schedule_sync',
          success: true,
          data: scheduleResult
        })
        console.log('✅ Tournament schedules synced')
      } else {
        throw new Error(`Schedule sync failed: ${scheduleResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Schedule sync failed:', error)
      results.push({
        task: 'schedule_sync',
        success: false,
        error: error.message
      })
    }

    // 2. Sync live stats (most critical for active tournaments)
    console.log('📊 Syncing live stats...')
    try {
      const liveStatsResponse = await fetch(`${baseUrl}/api/live-stats/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INGEST_SECRET}`
        }
      })

      if (liveStatsResponse.ok) {
        const liveStatsResult = await liveStatsResponse.json()
        results.push({
          task: 'live_stats_sync',
          success: true,
          data: liveStatsResult
        })
        console.log('✅ Live stats synced')
      } else {
        throw new Error(`Live stats sync failed: ${liveStatsResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Live stats sync failed:', error)
      results.push({
        task: 'live_stats_sync',
        success: false,
        error: error.message
      })
    }

    // 3. Refresh matchups data (all tours)
    console.log('🏌️ Refreshing matchups data...')
    try {
      const matchupsResponse = await fetch(`${baseUrl}/api/matchups/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INGEST_SECRET}`
        }
      })

      if (matchupsResponse.ok) {
        const matchupsResult = await matchupsResponse.json()
        results.push({
          task: 'matchups_refresh',
          success: true,
          data: matchupsResult
        })
        console.log('✅ Matchups data refreshed')
      } else {
        throw new Error(`Matchups refresh failed: ${matchupsResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Matchups refresh failed:', error)
      results.push({
        task: 'matchups_refresh',
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

    console.log(`✅ Daily sync completed in ${executionTime}ms`)
    console.log(`📊 Success rate: ${successfulTasks}/${totalTasks} (${successRate.toFixed(1)}%)`)
    
    return NextResponse.json({
      success: true,
      message: 'Daily data sync completed',
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTime,
      success_rate: successRate,
      results
    })

  } catch (error: any) {
    console.error('❌ Daily sync failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      execution_time_ms: Date.now() - startTime,
      results
    }, { status: 500 })
  }
} 
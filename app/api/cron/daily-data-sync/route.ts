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

    // 4. Check and settle completed rounds (new round-based settlement)
    console.log('🏆 Checking for completed rounds to settle...')
    try {
      const settleResponse = await fetch(`${baseUrl}/api/settle-rounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (settleResponse.ok) {
        const settleResult = await settleResponse.json()
        results.push({
          task: 'settle_rounds',
          success: true,
          data: settleResult
        })
        console.log('✅ Round settlement check completed')
      } else {
        throw new Error(`Round settlement check failed: ${settleResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Round settlement check failed:', error)
      results.push({
        task: 'settle_rounds',
        success: false,
        error: error.message
      })
    }

    // 5. Also check and settle completed tournaments (legacy fallback)
    console.log('🏆 Checking for completed tournaments to settle (legacy)...')
    try {
      const settleResponse = await fetch(`${baseUrl}/api/settle-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (settleResponse.ok) {
        const settleResult = await settleResponse.json()
        results.push({
          task: 'settle_completed',
          success: true,
          data: settleResult
        })
        console.log('✅ Tournament settlement check completed')
      } else {
        throw new Error(`Tournament settlement check failed: ${settleResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Tournament settlement check failed:', error)
      results.push({
        task: 'settle_completed',
        success: false,
        error: error.message
      })
    }

    // 6. Populate tournament results from live stats
    console.log('🏆 Populating tournament results from live stats...')
    try {
      const populateResponse = await fetch(`${baseUrl}/api/trends/populate-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (populateResponse.ok) {
        const populateResult = await populateResponse.json()
        results.push({
          task: 'populate_tournament_results',
          success: true,
          data: populateResult
        })
        console.log('✅ Tournament results populated from live stats')
      } else {
        throw new Error(`Tournament results population failed: ${populateResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Tournament results population failed:', error)
      results.push({
        task: 'populate_tournament_results',
        success: false,
        error: error.message
      })
    }

    // 7. Calculate player trends (daily update)
    console.log('📈 Calculating player trends...')
    try {
      const trendsResponse = await fetch(`${baseUrl}/api/trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recalculate: true,
          period: 'last_10'
        })
      })

      if (trendsResponse.ok) {
        const trendsResult = await trendsResponse.json()
        results.push({
          task: 'calculate_trends',
          success: true,
          data: trendsResult
        })
        console.log('✅ Player trends calculated')
      } else {
        throw new Error(`Trends calculation failed: ${trendsResponse.statusText}`)
      }
    } catch (error: any) {
      console.error('❌ Trends calculation failed:', error)
      results.push({
        task: 'calculate_trends',
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
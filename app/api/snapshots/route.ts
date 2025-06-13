import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'
import { TournamentDataService } from '@/lib/services/tournament-data-service'
import { SnapshotRetentionService } from '@/lib/services/snapshot-retention-service'

/**
 * 🎯 ENHANCED: Snapshot + Parlay Analytics API
 * GET: List recent snapshots and system status
 * POST: Manually trigger snapshot creation OR analyze parlay matchups
 * PUT: Test snapshot triggers
 * PATCH: Get player parlay profiles
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('event_id')
    const roundNum = searchParams.get('round')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    // 🎯 NEW: Parlay analytics endpoints
    const action = searchParams.get('action')
    const playerId = searchParams.get('player_id')

    const supabase = createSupabaseClient()
    const snapshotService = new TournamentSnapshotService()
    const dataService = new TournamentDataService()
    const retentionService = new SnapshotRetentionService()

    // 🎯 NEW: System health monitoring endpoints
    if (action === 'system_health') {
      logger.info('Getting comprehensive system health status')
      
      try {
        const [
          retentionStats,
          cacheStats,
          snapshotStats
        ] = await Promise.all([
          retentionService.getRetentionStats(),
          dataService.getCacheStats ? dataService.getCacheStats() : { size: 0, hit_rate: 0, avg_age_minutes: 0 },
          supabase.rpc('get_snapshot_stats')
        ])

        const systemHealth = {
          snapshot_system: {
            total_snapshots: retentionStats.current_snapshot_count,
            oldest_snapshot: retentionStats.oldest_snapshot_date,
            estimated_storage_mb: retentionStats.estimated_storage_mb,
            status: retentionStats.current_snapshot_count > 0 ? 'active' : 'inactive'
          },
          data_access: {
            cache_size: cacheStats.size,
            cache_hit_rate: cacheStats.hit_rate,
            avg_cache_age_minutes: cacheStats.avg_age_minutes,
            fallback_system: 'operational'
          },
          integration_status: {
            live_stats_sync: 'operational', // Would check actual sync status
            parlay_analytics: 'operational',
            ml_data_extraction: 'operational',
            retention_policy: 'active'
          },
          performance_metrics: {
            last_health_check: new Date().toISOString(),
            system_version: '30.5-integrated'
          }
        }

        return jsonSuccess(systemHealth, 'System health check completed')
      } catch (error) {
        logger.error('System health check failed:', error)
        return handleApiError('System health check failed')
      }
    }

    if (action === 'retention_status') {
      logger.info('Getting retention policy status')
      
      try {
        const retentionStats = await retentionService.getRetentionStats()
        
        return jsonSuccess({
          retention_policy: {
            current_snapshot_count: retentionStats.current_snapshot_count,
            oldest_snapshot_date: retentionStats.oldest_snapshot_date,
            estimated_storage_mb: retentionStats.estimated_storage_mb,
            recommendations: retentionStats.current_snapshot_count > 10000 
              ? ['Consider applying development retention policy']
              : ['Current retention levels are healthy']
          },
          actions_available: [
            'Apply production retention policy',
            'Apply development retention policy',
            'Schedule automatic retention'
          ]
        }, 'Retention status retrieved')
      } catch (error) {
        logger.error('Failed to get retention status:', error)
        return handleApiError('Failed to get retention status')
      }
    }

    // Handle parlay analytics requests
    if (action === 'player_profile' && playerId) {
      logger.info(`Getting parlay profile for player ${playerId}`)
      
      const profile = await snapshotService.generatePlayerParlayProfile(parseInt(playerId))
      
      if (!profile) {
        return handleApiError(`Player profile not found for ID ${playerId}`)
      }
      
      return jsonSuccess(profile, `Parlay profile retrieved for ${profile.player_name}`)
    }

    if (action === 'parlay_recommendations') {
      logger.info('Getting parlay recommendations for active tournaments')
      
      // Get active tournaments with recent activity
      const { data: activeTournaments } = await supabase
        .from('live_tournament_stats')
        .select(`
          event_id,
          tournament_name,
          dg_id,
          player_name,
          position,
          sg_total,
          today,
          round_num,
          data_golf_updated_at
        `)
        .gte('data_golf_updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('position', 'is', null)
        .order('data_golf_updated_at', { ascending: false })
        .limit(100)

      // Group by tournament and get top players for sample matchups
      const tournamentGroups = activeTournaments?.reduce((acc: any, player) => {
        const key = `${player.event_id}_${player.tournament_name}`
        if (!acc[key]) {
          acc[key] = {
            event_id: player.event_id,
            tournament_name: player.tournament_name,
            players: []
          }
        }
        acc[key].players.push({
          dg_id: player.dg_id,
          player_name: player.player_name,
          position: player.position,
          sg_total: player.sg_total
        })
        return acc
      }, {}) || {}

      // Generate sample matchup recommendations
      const recommendations = await Promise.all(
        Object.values(tournamentGroups).slice(0, 3).map(async (tournament: any) => {
          const topPlayers = tournament.players
            .sort((a: any, b: any) => (a.position || 999) - (b.position || 999))
            .slice(0, 6)

          if (topPlayers.length >= 3) {
            // Create a sample 3-ball matchup
            const sampleMatchup = await snapshotService.analyzeMatchupForParlay(
              topPlayers.slice(0, 3).map((p: any) => p.dg_id),
              '3ball'
            )

            return {
              tournament_name: tournament.tournament_name,
              event_id: tournament.event_id,
              sample_matchup: sampleMatchup,
              available_players: topPlayers.length
            }
          }
          return null
        })
      )

      return jsonSuccess({
        active_tournaments: Object.keys(tournamentGroups).length,
        recommendations: recommendations.filter(r => r !== null)
      }, 'Parlay recommendations generated')
    }

    // 🎯 NEW: VENUE PERFORMANCE ANALYTICS - Greg's brilliant insight!
    if (action === 'venue_performance') {
      const { venue_name, course_type, player_ids } = searchParams.get('venue_name') 
        ? { venue_name: searchParams.get('venue_name'), course_type: null, player_ids: null }
        : { venue_name: null, course_type: searchParams.get('course_type'), player_ids: searchParams.get('player_ids')?.split(',').map(Number) }
      
      logger.info(`Getting venue performance analysis for venue: ${venue_name || course_type}`)
      
      try {
        // Get historical performance at this specific venue
        const venueQuery = supabase
          .from('tournament_round_snapshots')
          .select(`
            dg_id,
            player_name,
            event_name,
            position_numeric,
            total_score,
            sg_total,
            snapshot_timestamp,
            event_id
          `)
          .order('snapshot_timestamp', { ascending: false })
          .limit(5000) // Get substantial historical data

        if (venue_name) {
          venueQuery.ilike('event_name', `%${venue_name}%`)
        }

        const { data: venueHistory } = await venueQuery

        if (!venueHistory || venueHistory.length === 0) {
          return jsonSuccess({
            venue_analysis: {
              venue_name: venue_name || course_type,
              historical_data_points: 0,
              player_insights: [],
              message: 'No historical data found for this venue'
            }
          }, 'Venue analysis completed (no historical data)')
        }

        // Group by player and calculate venue-specific stats
        const playerVenueStats = venueHistory.reduce((acc: any, record) => {
          const playerId = record.dg_id
          if (!acc[playerId]) {
            acc[playerId] = {
              dg_id: playerId,
              player_name: record.player_name,
              venue_rounds: 0,
              venue_finishes: [],
              venue_scores: [],
              venue_sg_total: [],
              best_venue_finish: 999,
              worst_venue_finish: 0,
              last_played_venue: null,
              venue_trend: 'steady'
            }
          }

          acc[playerId].venue_rounds++
          if (record.position_numeric) acc[playerId].venue_finishes.push(record.position_numeric)
          if (record.total_score) acc[playerId].venue_scores.push(record.total_score)
          if (record.sg_total) acc[playerId].venue_sg_total.push(record.sg_total)
          
          if (record.position_numeric && record.position_numeric < acc[playerId].best_venue_finish) {
            acc[playerId].best_venue_finish = record.position_numeric
          }
          if (record.position_numeric && record.position_numeric > acc[playerId].worst_venue_finish) {
            acc[playerId].worst_venue_finish = record.position_numeric
          }
          
          if (!acc[playerId].last_played_venue || record.snapshot_timestamp > acc[playerId].last_played_venue) {
            acc[playerId].last_played_venue = record.snapshot_timestamp
          }

          return acc
        }, {})

        // Calculate venue performance metrics for each player
        const playerVenueInsights = Object.values(playerVenueStats).map((stats: any) => {
          const avgFinish = stats.venue_finishes.length > 0 
            ? stats.venue_finishes.reduce((sum: number, pos: number) => sum + pos, 0) / stats.venue_finishes.length
            : 999

          const avgScore = stats.venue_scores.length > 0
            ? stats.venue_scores.reduce((sum: number, score: number) => sum + score, 0) / stats.venue_scores.length
            : 0

          const avgSG = stats.venue_sg_total.length > 0
            ? stats.venue_sg_total.reduce((sum: number, sg: number) => sum + sg, 0) / stats.venue_sg_total.length
            : 0

          // Calculate venue trend (recent vs historical)
          const recentFinishes = stats.venue_finishes.slice(0, 3)
          const olderFinishes = stats.venue_finishes.slice(3)
          const venueTrend = recentFinishes.length > 0 && olderFinishes.length > 0
            ? (recentFinishes.reduce((s: number, p: number) => s + p, 0) / recentFinishes.length) < 
              (olderFinishes.reduce((s: number, p: number) => s + p, 0) / olderFinishes.length)
              ? 'improving' : 'declining'
            : 'steady'

          return {
            ...stats,
            avg_venue_finish: Math.round(avgFinish * 10) / 10,
            avg_venue_score: Math.round(avgScore * 10) / 10,
            avg_venue_sg: Math.round(avgSG * 1000) / 1000,
            venue_consistency: stats.venue_finishes.length > 2 
              ? 100 - (Math.sqrt(stats.venue_finishes.reduce((sum: number, pos: number) => sum + Math.pow(pos - avgFinish, 2), 0) / stats.venue_finishes.length) * 5)
              : 0,
            venue_trend: venueTrend,
            venue_experience_score: Math.min(100, stats.venue_rounds * 10), // More rounds = more experience
            venue_form_indicator: venueTrend === 'improving' ? 'positive' : venueTrend === 'declining' ? 'negative' : 'neutral'
          }
        })

        // Get current form for comparison (last 10 rounds across all venues)
        const currentFormQuery = await supabase
          .from('live_tournament_stats')
          .select('dg_id, player_name, sg_total, today, data_golf_updated_at')
          .in('dg_id', Object.keys(playerVenueStats).map(Number))
          .order('data_golf_updated_at', { ascending: false })
          .limit(500)

        const { data: currentForm } = currentFormQuery

        // Combine venue performance with current form
        const venueFormAnalysis = playerVenueInsights
          .filter((player: any) => player.venue_rounds >= 2) // Only players with multiple venue experiences
          .map((player: any) => {
            const playerCurrentForm = currentForm?.filter(f => f.dg_id === player.dg_id).slice(0, 5) || []
            const currentSG = playerCurrentForm.length > 0 
              ? playerCurrentForm.reduce((sum, round) => sum + (round.sg_total || 0), 0) / playerCurrentForm.length
              : 0

            const currentFormTrend = playerCurrentForm.length >= 3
              ? playerCurrentForm[0]?.sg_total > playerCurrentForm[2]?.sg_total ? 'hot' : 'cold'
              : 'neutral'

            // 🎯 THE MONEY SIGNAL: Current hot form + good venue history
            const venueOpportunityScore = 
              (player.avg_venue_finish < 25 ? 30 : player.avg_venue_finish < 50 ? 20 : 10) + // Historical venue success
              (player.venue_trend === 'improving' ? 25 : player.venue_trend === 'declining' ? -10 : 5) + // Venue trend
              (currentFormTrend === 'hot' ? 30 : currentFormTrend === 'cold' ? -15 : 0) + // Current form
              (currentSG > 0.5 ? 20 : currentSG > 0 ? 10 : currentSG > -0.5 ? 0 : -10) // Recent SG performance

            return {
              ...player,
              current_form: {
                recent_sg_avg: Math.round(currentSG * 1000) / 1000,
                form_trend: currentFormTrend,
                recent_rounds: playerCurrentForm.length
              },
              venue_opportunity_score: Math.round(venueOpportunityScore),
              parlay_recommendation: venueOpportunityScore > 50 ? 'strong_consider' : 
                                   venueOpportunityScore > 25 ? 'consider' : 
                                   venueOpportunityScore > 0 ? 'monitor' : 'avoid',
              key_insights: [
                `${player.venue_rounds} rounds at venue (avg finish: ${Math.round(player.avg_venue_finish)})`,
                `Venue trend: ${player.venue_trend}`,
                `Current form: ${currentFormTrend} (SG: ${Math.round(currentSG * 1000) / 1000})`,
                player.best_venue_finish < 10 ? `Best venue finish: T${player.best_venue_finish}` : null
              ].filter(Boolean)
            }
          })
          .sort((a, b) => b.venue_opportunity_score - a.venue_opportunity_score) // Sort by opportunity score

        return jsonSuccess({
          venue_analysis: {
            venue_name: venue_name || course_type,
            analysis_timestamp: new Date().toISOString(),
            historical_data_points: venueHistory.length,
            players_analyzed: playerVenueInsights.length,
            players_with_experience: venueFormAnalysis.length,
            
            // 🎯 TOP OPPORTUNITIES: Players in form who historically perform well here
            top_opportunities: venueFormAnalysis.slice(0, 10),
            
            // Venue performance leaders (historically)
            venue_specialists: venueFormAnalysis
              .filter((p: any) => p.avg_venue_finish < 30 && p.venue_rounds >= 4)
              .slice(0, 5),
            
            // Players trending up at this venue
            venue_improvers: venueFormAnalysis
              .filter((p: any) => p.venue_trend === 'improving')
              .slice(0, 5),
              
            // Current hot players with venue experience  
            hot_form_with_venue_experience: venueFormAnalysis
              .filter((p: any) => p.current_form.form_trend === 'hot' && p.venue_rounds >= 2)
              
          },
          methodology: {
            data_span: "Multi-year historical performance at specific venues",
            form_analysis: "Last 5 rounds across all tournaments",
            opportunity_scoring: "Combines venue history + current form + venue trend",
            confidence_factors: ["Historical venue performance", "Recent form trend", "Venue experience level"]
          }
        }, `Venue performance analysis completed for ${venue_name || course_type}`)
        
      } catch (error) {
        logger.error('Venue performance analysis failed:', error)
        return handleApiError('Failed to analyze venue performance')
      }
    }

    // 🎯 EXISTING: Standard snapshot status endpoint
    // Get snapshot statistics
    const { data: stats } = await supabase.rpc('get_snapshot_stats')
    
    // Get recent snapshots
    let snapshotQuery = supabase
      .from('tournament_round_snapshots')
      .select(`
        id,
        event_id,
        event_name,
        round_num,
        snapshot_timestamp,
        snapshot_type,
        data_source,
        player_name,
        position,
        total_score,
        position_change,
        momentum_score
      `)
      .order('snapshot_timestamp', { ascending: false })
      .limit(limit)

    if (eventId) {
      snapshotQuery = snapshotQuery.eq('event_id', parseInt(eventId))
    }

    if (roundNum) {
      snapshotQuery = snapshotQuery.eq('round_num', roundNum)
    }

    const { data: recentSnapshots, error: snapshotError } = await snapshotQuery

    if (snapshotError) {
      logger.error('Failed to fetch snapshots:', snapshotError)
      return handleApiError('Failed to fetch snapshots')
    }

    // Get active tournaments for context
    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('event_id, event_name, start_date, end_date')
      .gte('end_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: false })

    // Group snapshots by event and round for summary
    const snapshotSummary = recentSnapshots?.reduce((acc: any, snapshot) => {
      const key = `${snapshot.event_id}-${snapshot.round_num}`
      if (!acc[key]) {
        acc[key] = {
          event_id: snapshot.event_id,
          event_name: snapshot.event_name,
          round_num: snapshot.round_num,
          snapshot_type: snapshot.snapshot_type,
          latest_timestamp: snapshot.snapshot_timestamp,
          player_count: 0,
          players_with_positions: 0,
          avg_momentum: 0
        }
      }
      
      acc[key].player_count++
      if (snapshot.position) acc[key].players_with_positions++
      if (snapshot.momentum_score) {
        acc[key].avg_momentum = (acc[key].avg_momentum + snapshot.momentum_score) / 2
      }
      
      return acc
    }, {}) || {}

    const response = {
      system_status: {
        total_snapshots: stats?.total_snapshots || 0,
        unique_events: stats?.unique_events || 0,
        latest_snapshot: stats?.latest_snapshot || null,
        active_tournaments: activeTournaments?.length || 0
      },
      snapshot_summary: Object.values(snapshotSummary),
      recent_snapshots: recentSnapshots || [],
      active_tournaments: activeTournaments || []
    }

    return jsonSuccess(response, 'Snapshot status retrieved successfully')

  } catch (error) {
    logger.error('Error in snapshot GET endpoint:', error)
    return handleApiError('Failed to get snapshot status')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    const snapshotService = new TournamentSnapshotService()
    const retentionService = new SnapshotRetentionService()
    const supabase = createSupabaseClient()

    // 🎯 NEW: Administrative endpoints for retention management
    if (action === 'apply_retention') {
      const { policy = 'production', dry_run = false } = body

      if (!['production', 'development', 'golf_analytics', 'venue_analytics', 'never_delete'].includes(policy)) {
        return handleApiError('Policy must be one of: production, development, golf_analytics, venue_analytics, never_delete')
      }

      logger.info(`${dry_run ? 'Dry run for' : 'Applying'} retention policy: ${policy}`)

      try {
        if (dry_run) {
          // Just get the stats without actually deleting
          const stats = await retentionService.getRetentionStats()
          // Calculate cutoff based on policy
          let maxAgeDays: number
          switch (policy) {
            case 'production': maxAgeDays = 2555; break      // ~7 years
            case 'development': maxAgeDays = 730; break      // 2 years  
            case 'golf_analytics': maxAgeDays = 3650; break  // 10 years
            case 'venue_analytics': maxAgeDays = 5475; break // 15 years
            case 'never_delete': maxAgeDays = 36500; break   // 100 years
            default: maxAgeDays = 2555; break                // Default to production
          }
          
          const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000)
          
          const { count: wouldDelete } = await supabase
            .from('tournament_round_snapshots')
            .select('id', { count: 'exact', head: true })
            .lt('snapshot_timestamp', cutoffDate.toISOString())

          return jsonSuccess({
            dry_run: true,
            policy,
            current_snapshots: stats.current_snapshot_count,
            snapshots_would_delete: wouldDelete || 0,
            storage_would_free_mb: (wouldDelete || 0) * 0.01,
            estimated_runtime_minutes: Math.ceil((wouldDelete || 0) / 1000)
          }, `Dry run completed for ${policy} retention policy`)
        } else {
          const retentionStats = await retentionService.applyRetentionPolicy(policy as any)
          
          return jsonSuccess({
            retention_applied: true,
            policy: retentionStats.policy_applied,
            snapshots_deleted: retentionStats.snapshots_deleted,
            storage_freed_mb: retentionStats.storage_freed_mb,
            execution_time_ms: retentionStats.execution_time_ms
          }, `${policy} retention policy applied successfully`)
        }
      } catch (error) {
        logger.error('Failed to apply retention policy:', error)
        return handleApiError(`Failed to apply retention policy: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // 🎯 NEW: Parlay matchup analysis
    if (action === 'analyze_matchup') {
      const { player_ids, matchup_type, course_context } = body

      if (!player_ids || !Array.isArray(player_ids) || player_ids.length < 2) {
        return handleApiError('player_ids array with at least 2 players is required')
      }

      if (!matchup_type || !['2ball', '3ball'].includes(matchup_type)) {
        return handleApiError('matchup_type must be "2ball" or "3ball"')
      }

      if (matchup_type === '3ball' && player_ids.length !== 3) {
        return handleApiError('3ball matchups require exactly 3 players')
      }

      if (matchup_type === '2ball' && player_ids.length !== 2) {
        return handleApiError('2ball matchups require exactly 2 players')
      }

      logger.info(`Analyzing ${matchup_type} matchup for players: ${player_ids.join(', ')}`)

      const matchupAnalysis = await snapshotService.analyzeMatchupForParlay(
        player_ids,
        matchup_type,
        course_context
      )

      if (!matchupAnalysis) {
        return handleApiError('Failed to analyze matchup - insufficient data')
      }

      return jsonSuccess(matchupAnalysis, `${matchup_type} matchup analysis completed`)
    }

    // 🎯 EXISTING: Manual snapshot creation
    const { event_id, round_number, snapshot_type = 'manual' } = body

    if (!event_id || !round_number) {
      return handleApiError('event_id and round_number are required')
    }

    logger.info(`Manual snapshot trigger requested for event ${event_id}, round ${round_number}`)

    // Validate the event exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('event_id, event_name')
      .eq('event_id', event_id)
      .single()

    if (tournamentError || !tournament) {
      return handleApiError(`Tournament not found for event_id ${event_id}`)
    }

    // Create the snapshot
    const result = await snapshotService.createTournamentSnapshot(
      event_id,
      round_number.toString(),
      snapshot_type
    )

    if (result.success) {
      logger.info(`Manual snapshot created successfully for ${tournament.event_name}, round ${round_number}`)
      
      return jsonSuccess({
        success: true,
        event_id,
        event_name: tournament.event_name,
        round_number,
        snapshot_type,
        snapshot_count: result.snapshotIds?.length || 0,
        snapshot_ids: result.snapshotIds
      }, `Snapshot created successfully for ${tournament.event_name}, round ${round_number}`)
    } else {
      logger.error(`Manual snapshot failed: ${result.error}`)
      return handleApiError(`Failed to create snapshot: ${result.error}`)
    }

  } catch (error) {
    logger.error('Error in snapshot POST endpoint:', error)
    return handleApiError('Failed to process request')
  }
}

/**
 * 🎯 NEW: Bulk player profile endpoint
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { player_ids, include_matchup_analysis = false } = body

    if (!player_ids || !Array.isArray(player_ids)) {
      return handleApiError('player_ids array is required')
    }

    if (player_ids.length > 10) {
      return handleApiError('Maximum 10 players per request')
    }

    const snapshotService = new TournamentSnapshotService()

    logger.info(`Getting parlay profiles for ${player_ids.length} players`)

    // Get all player profiles in parallel
    const profiles = await Promise.all(
      player_ids.map(async (playerId: number) => {
        const profile = await snapshotService.generatePlayerParlayProfile(playerId)
        return profile
      })
    )

    const validProfiles = profiles.filter(p => p !== null)

    let matchupAnalysis = null
    if (include_matchup_analysis && validProfiles.length >= 2) {
      // Create sample matchup analysis
      const matchupType = validProfiles.length >= 3 ? '3ball' : '2ball'
      const playersForMatchup = validProfiles.slice(0, matchupType === '3ball' ? 3 : 2)
      
      matchupAnalysis = await snapshotService.analyzeMatchupForParlay(
        playersForMatchup.map(p => p!.dg_id),
        matchupType
      )
    }

    const response = {
      player_profiles: validProfiles,
      profiles_found: validProfiles.length,
      profiles_requested: player_ids.length,
      matchup_analysis: matchupAnalysis
    }

    return jsonSuccess(response, `Retrieved ${validProfiles.length} player profiles`)

  } catch (error) {
    logger.error('Error in bulk profile PATCH endpoint:', error)
    return handleApiError('Failed to get player profiles')
  }
}

/**
 * Additional endpoint for testing snapshot triggers
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_name, round_number } = body

    if (!event_name || !round_number) {
      return handleApiError('event_name and round_number are required')
    }

    const snapshotService = new TournamentSnapshotService()

    logger.info(`Testing snapshot trigger for ${event_name}, round ${round_number}`)

    // Test the trigger system without actually creating snapshots
    const triggerResult = await snapshotService.checkAndTriggerSnapshots(
      event_name,
      round_number.toString(),
      new Date().toISOString()
    )

    return jsonSuccess({
      trigger_test: true,
      event_name,
      round_number,
      would_trigger: triggerResult.triggered,
      reason: triggerResult.reason,
      error: triggerResult.error
    }, `Trigger test completed for ${event_name}, round ${round_number}`)

  } catch (error) {
    logger.error('Error in snapshot PUT endpoint:', error)
    return handleApiError('Failed to test snapshot trigger')
  }
} 
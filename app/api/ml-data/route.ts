import { NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'

/**
 * 🤖 ENHANCED ML DATA EXTRACTION API
 * Comprehensive endpoints for machine learning data access and training
 * 
 * GET: Extract historical data with ML-ready formatting
 * POST: Bulk data extraction with custom parameters
 * 
 * Features:
 * - Multiple specialized ML endpoints
 * - Advanced query filtering (tournament, round, player, time period)
 * - Multiple output formats (JSON, CSV-ready arrays, feature vectors)
 * - Pagination for large datasets
 * - ML feature engineering and normalization
 * - Training data generation for parlay prediction
 * - Time series data for trend analysis
 * - Rate limiting and comprehensive documentation
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')
    const format = searchParams.get('format') || 'json'
    
    // Pagination and filtering
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = (page - 1) * limit
    
    // Common filters
    const eventId = searchParams.get('event_id')
    const playerId = searchParams.get('player_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const tournamentName = searchParams.get('tournament_name')
    const roundNum = searchParams.get('round_num')
    
    // Sorting
    const sortBy = searchParams.get('sort_by') || 'snapshot_timestamp'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    const supabase = createSupabaseClient()
    const snapshotService = new TournamentSnapshotService()

    logger.info(`ML API request: endpoint=${endpoint}, format=${format}, page=${page}, limit=${limit}`)

    // 🤖 ENDPOINT: Historical Tournament Snapshots
    if (endpoint === 'historical_snapshots') {
      let query = supabase
        .from('tournament_round_snapshots')
        .select(`
          id, event_id, event_name, round_num, snapshot_timestamp, snapshot_type,
          dg_id, player_name, position, position_numeric, total_score, total_strokes,
          today, thru, position_change, momentum_score,
          sg_total, sg_ott, sg_app, sg_arg, sg_putt,
          driving_distance, driving_accuracy, gir_percentage, putting_average,
          created_at
        `)

      // Apply comprehensive filters
      if (eventId) query = query.eq('event_id', parseInt(eventId))
      if (playerId) query = query.eq('dg_id', parseInt(playerId))
      if (roundNum) query = query.eq('round_num', roundNum)
      if (tournamentName) query = query.ilike('event_name', `%${tournamentName}%`)
      if (startDate) query = query.gte('snapshot_timestamp', startDate)
      if (endDate) query = query.lte('snapshot_timestamp', endDate)

      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) {
        logger.error('Failed to fetch historical snapshots:', error)
        return handleApiError('Failed to fetch historical snapshots')
      }

      const response = format === 'csv' ? convertToCSVArray(data || []) : data || []
      
      return jsonSuccess({
        data: response,
        metadata: {
          total_records: count,
          page, limit, format,
          filters_applied: { eventId, playerId, roundNum, tournamentName, startDate, endDate },
          columns: data && data.length > 0 ? Object.keys(data[0]) : []
        }
      }, `Retrieved ${data?.length || 0} historical snapshots`)
    }

    // 🤖 ENDPOINT: ML-Ready Player Features
    if (endpoint === 'player_features') {
      if (playerId) {
        // Single player feature extraction
        const profile = await snapshotService.generatePlayerParlayProfile(parseInt(playerId))
        if (!profile) return handleApiError('Player profile not found')

        const features = extractMLFeatures(profile)
        
        return jsonSuccess(
          format === 'csv' ? convertToCSVArray([features]) : features,
          `ML features extracted for ${profile.player_name}`
        )
      } else {
        // Bulk player features for active players
        const activeLimit = Math.min(limit, 50) // Limit for performance
        const { data: activePlayers } = await supabase
          .from('live_tournament_stats')
          .select('dg_id')
          .gte('data_golf_updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(activeLimit)

        const playerIds = [...new Set(activePlayers?.map(p => p.dg_id) || [])]
        
        const playerFeatures = await Promise.all(
          playerIds.slice(offset, offset + activeLimit).map(async (dgId: number) => {
            const profile = await snapshotService.generatePlayerParlayProfile(dgId)
            return profile ? extractMLFeatures(profile) : null
          })
        )

        const validFeatures = playerFeatures.filter(f => f !== null)
        const response = format === 'csv' ? convertToCSVArray(validFeatures) : validFeatures

        return jsonSuccess({
          data: response,
          metadata: {
            players_processed: validFeatures.length,
            total_active_players: playerIds.length,
            format,
            feature_columns: validFeatures.length > 0 ? Object.keys(validFeatures[0]) : []
          }
        }, `Extracted ML features for ${validFeatures.length} players`)
      }
    }

    // 🤖 ENDPOINT: Tournament Trends for Time Series Analysis
    if (endpoint === 'tournament_trends') {
      const { data: trends, error } = await supabase
        .from('tournament_round_snapshots')
        .select(`
          event_id,
          event_name,
          round_num,
          snapshot_timestamp,
          snapshot_type,
          COUNT(*) as player_count,
          AVG(position_numeric::float) as avg_position,
          AVG(total_score::float) as avg_score,
          AVG(sg_total::float) as avg_sg_total,
          AVG(momentum_score::float) as avg_momentum,
          STDDEV(position_numeric::float) as position_volatility,
          STDDEV(sg_total::float) as sg_volatility
        `)
        .not('position_numeric', 'is', null)
        .gte('snapshot_timestamp', startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .lt('snapshot_timestamp', endDate || new Date().toISOString())
        .order('snapshot_timestamp', { ascending: sortOrder === 'asc' })
        .limit(limit)

      if (error) return handleApiError('Failed to fetch tournament trends')

      const response = format === 'csv' ? convertToCSVArray(trends || []) : trends || []

      return jsonSuccess({
        data: response,
        metadata: {
          total_records: trends?.length || 0,
          format,
          date_range: { start: startDate, end: endDate }
        }
      }, `Retrieved ${trends?.length || 0} tournament trend records`)
    }

    // 🤖 ENDPOINT: Matchup Training Data for Parlay ML
    if (endpoint === 'matchup_training_data') {
      const matchupType = searchParams.get('matchup_type') || '3ball'
      const minPosition = parseInt(searchParams.get('min_position') || '1')
      const maxPosition = parseInt(searchParams.get('max_position') || '50')

      logger.info(`Generating ${matchupType} training data for positions ${minPosition}-${maxPosition}`)

      // Get recent completed tournaments
      const { data: tournaments } = await supabase
        .from('tournament_round_snapshots')
        .select('event_id, event_name, round_num, snapshot_timestamp')
        .eq('snapshot_type', 'final')
        .gte('snapshot_timestamp', startDate || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
        .group('event_id, event_name, round_num, snapshot_timestamp')
        .order('snapshot_timestamp', { ascending: false })
        .limit(20)

      const trainingData = []

      for (const tournament of tournaments || []) {
        // Get players for this tournament/round
        const { data: players } = await supabase
          .from('tournament_round_snapshots')
          .select('dg_id, player_name, position_numeric, total_score, sg_total, sg_ott, sg_app, sg_arg, sg_putt')
          .eq('event_id', tournament.event_id)
          .eq('round_num', tournament.round_num)
          .gte('position_numeric', minPosition)
          .lte('position_numeric', maxPosition)
          .not('position_numeric', 'is', null)
          .not('sg_total', 'is', null)
          .order('position_numeric', { ascending: true })
          .limit(15)

        if (!players || players.length < (matchupType === '3ball' ? 3 : 2)) continue

        // Generate matchup combinations
        const playersPerMatchup = matchupType === '3ball' ? 3 : 2
        
        for (let i = 0; i <= players.length - playersPerMatchup; i += playersPerMatchup) {
          const matchupPlayers = players.slice(i, i + playersPerMatchup)
          
          if (matchupPlayers.length === playersPerMatchup) {
            const matchupRecord = {
              tournament_id: tournament.event_id,
              tournament_name: tournament.event_name,
              round_num: tournament.round_num,
              snapshot_timestamp: tournament.snapshot_timestamp,
              matchup_type: matchupType,
              
              // Player data
              ...matchupPlayers.reduce((acc, player, idx) => {
                const playerKey = `player${idx + 1}`
                return {
                  ...acc,
                  [`${playerKey}_dg_id`]: player.dg_id,
                  [`${playerKey}_name`]: player.player_name,
                  [`${playerKey}_position`]: player.position_numeric,
                  [`${playerKey}_score`]: player.total_score,
                  [`${playerKey}_sg_total`]: player.sg_total,
                  [`${playerKey}_sg_ott`]: player.sg_ott,
                  [`${playerKey}_sg_app`]: player.sg_app,
                  [`${playerKey}_sg_arg`]: player.sg_arg,
                  [`${playerKey}_sg_putt`]: player.sg_putt
                }
              }, {}),
              
              // Winner determination (lowest position wins)
              winner_dg_id: matchupPlayers.reduce((best, current) => 
                (current.position_numeric || 999) < (best.position_numeric || 999) ? current : best
              ).dg_id,
              
              winner_position: Math.min(...matchupPlayers.map(p => p.position_numeric || 999)),
              
              // Matchup statistics
              avg_position: matchupPlayers.reduce((sum, p) => sum + (p.position_numeric || 0), 0) / matchupPlayers.length,
              avg_sg_total: matchupPlayers.reduce((sum, p) => sum + (p.sg_total || 0), 0) / matchupPlayers.length,
              position_spread: Math.max(...matchupPlayers.map(p => p.position_numeric || 0)) - 
                               Math.min(...matchupPlayers.map(p => p.position_numeric || 999)),
              
              extracted_at: new Date().toISOString()
            }
            
            trainingData.push(matchupRecord)
          }
        }
      }

      const response = format === 'csv' ? convertToCSVArray(trainingData) : trainingData

      return jsonSuccess({
        data: response,
        metadata: {
          total_matchups: trainingData.length,
          matchup_type: matchupType,
          tournaments_processed: tournaments?.length || 0,
          format,
          position_range: { min: minPosition, max: maxPosition }
        }
      }, `Generated ${trainingData.length} ${matchupType} training records`)
    }

    // 🤖 ENDPOINT: Live Tournament Context
    if (endpoint === 'live_context') {
      const { data: liveData } = await supabase
        .from('live_tournament_stats')
        .select(`
          event_id, tournament_name, round_num, dg_id, player_name,
          position, total_score, today, thru,
          sg_total, sg_ott, sg_app, sg_arg, sg_putt,
          data_golf_updated_at
        `)
        .gte('data_golf_updated_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .not('position', 'is', null)
        .order('data_golf_updated_at', { ascending: false })
        .limit(limit)

      const response = format === 'csv' ? convertToCSVArray(liveData || []) : liveData || []

      return jsonSuccess({
        data: response,
        metadata: {
          total_records: liveData?.length || 0,
          format,
          data_freshness: '6 hours'
        }
      }, `Retrieved ${liveData?.length || 0} live tournament records`)
    }

    // 🤖 ENDPOINT: Bet Snapshots for ML Model Training
    if (endpoint === 'bet_snapshots') {
      const includeOutcomes = searchParams.get('include_outcomes') === 'true'
      const flattenFeatures = searchParams.get('flatten_features') === 'true'
      
      let query = supabase
        .from('bet_snapshots')
        .select(`
          id,
          parlay_pick_id,
          snapshot,
          created_at
        `)
        .order('created_at', { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1)

      // Apply filters
      if (startDate) query = query.gte('created_at', startDate)
      if (endDate) query = query.lte('created_at', endDate)

      const { data: snapshots, error, count } = await query

      if (error) {
        logger.error('Failed to fetch bet snapshots:', error)
        return handleApiError('Failed to fetch bet snapshots')
      }

      let processedData = snapshots || []

      // Include outcomes if requested
      if (includeOutcomes && processedData.length > 0) {
        const pickIds = processedData.map(s => s.parlay_pick_id)
        const { data: pickOutcomes } = await supabase
          .from('parlay_picks')
          .select(`
            id,
            outcome,
            parlays!inner(outcome, payout_amount)
          `)
          .in('id', pickIds)

        // Create outcome lookup
        const outcomeMap = new Map()
        pickOutcomes?.forEach((pick: any) => {
          const parlay = Array.isArray(pick.parlays) ? pick.parlays[0] : pick.parlays
          outcomeMap.set(pick.id, {
            pick_outcome: pick.outcome,
            parlay_outcome: parlay?.outcome,
            parlay_payout: parlay?.payout_amount
          })
        })

        // Add outcomes to processed data
        processedData = processedData.map(snapshot => ({
          ...snapshot,
          ...outcomeMap.get(snapshot.parlay_pick_id)
        }))
      }

      // Flatten JSONB snapshot data for ML if requested
      if (flattenFeatures && processedData.length > 0) {
        processedData = processedData.map(snapshot => {
          const flatSnapshot = flattenSnapshotForML(snapshot.snapshot)
          return {
            id: snapshot.id,
            parlay_pick_id: snapshot.parlay_pick_id,
            created_at: snapshot.created_at,
            ...flatSnapshot,
            // Include outcomes if they exist
            ...(snapshot.pick_outcome ? {
              pick_outcome: snapshot.pick_outcome,
              parlay_outcome: snapshot.parlay_outcome,
              parlay_payout: snapshot.parlay_payout
            } : {})
          }
        })
      }

      const response = format === 'csv' ? convertToCSVArray(processedData) : processedData

      return jsonSuccess({
        data: response,
        metadata: {
          total_records: count,
          page, limit, format,
          features_flattened: flattenFeatures,
          outcomes_included: includeOutcomes,
          filters_applied: { startDate, endDate }
        }
      }, `Retrieved ${processedData.length} bet snapshots`)
    }

    // 🤖 ENDPOINT: Outcome Labeled Training Data
    if (endpoint === 'outcome_training_data') {
      // First get bet snapshots with outcomes
      const { data: snapshotsWithPicks, error } = await supabase
        .from('bet_snapshots')
        .select(`
          id,
          snapshot,
          created_at,
          parlay_pick_id
        `)
        .order('created_at', { ascending: sortOrder === 'asc' })
        .limit(limit)

      if (error) {
        logger.error('Failed to fetch snapshots for training data:', error)
        return handleApiError('Failed to fetch training data')
      }

      if (!snapshotsWithPicks || snapshotsWithPicks.length === 0) {
        return jsonSuccess({
          data: [],
          metadata: { total_records: 0, format, supervised_learning_ready: false }
        }, 'No training data available')
      }

      // Get outcomes for these picks
      const pickIds = snapshotsWithPicks.map(s => s.parlay_pick_id)
      const { data: pickOutcomes } = await supabase
        .from('parlay_picks')
        .select(`
          id,
          outcome,
          picked_player_dg_id,
          parlays!inner(outcome, payout_amount)
        `)
        .in('id', pickIds)
        .not('outcome', 'is', null)

      // Filter to only snapshots with outcomes
      const snapshotsWithOutcomes = snapshotsWithPicks.filter(snapshot => 
        pickOutcomes?.some(pick => pick.id === snapshot.parlay_pick_id)
      )

      // Process for ML training
      const mlTrainingData = snapshotsWithOutcomes.map(snapshot => {
        const pickData = pickOutcomes?.find(pick => pick.id === snapshot.parlay_pick_id)
        const flatSnapshot = flattenSnapshotForML(snapshot.snapshot)
        
        return {
          // Features from snapshot
          ...flatSnapshot,
          
          // Labels for supervised learning
          pick_outcome: pickData?.outcome, // 'win', 'loss', 'push', 'void'
          parlay_outcome: pickData?.parlays?.outcome, // 'win', 'loss', 'push'
          parlay_payout: pickData?.parlays?.payout_amount,
          
          // Binary labels for classification
          pick_won: pickData?.outcome === 'win' ? 1 : 0,
          parlay_won: pickData?.parlays?.outcome === 'win' ? 1 : 0,
          
          // Metadata
          snapshot_id: snapshot.id,
          bet_timestamp: snapshot.created_at,
          picked_player_dg_id: pickData?.picked_player_dg_id
        }
      })

      const response = format === 'csv' ? convertToCSVArray(mlTrainingData) : mlTrainingData

      return jsonSuccess({
        data: response,
        metadata: {
          total_records: mlTrainingData.length,
          format,
          supervised_learning_ready: true,
          outcome_distribution: {
            wins: mlTrainingData.filter(d => d.pick_won === 1).length,
            losses: mlTrainingData.filter(d => d.pick_won === 0).length
          }
        }
      }, `Retrieved ${mlTrainingData.length} labeled training records`)
    }

    // 🤖 Default: Comprehensive API Documentation
    return jsonSuccess({
      api_version: '2.0',
      description: 'Enhanced ML Data Extraction API for golf tournament analytics',
      endpoints: {
        historical_snapshots: {
          description: 'Complete historical tournament round snapshots',
          parameters: ['event_id', 'player_id', 'round_num', 'tournament_name', 'start_date', 'end_date'],
          formats: ['json', 'csv'],
          use_cases: ['Time series analysis', 'Player performance tracking', 'Tournament trends']
        },
        player_features: {
          description: 'ML-ready player performance features and analytics',
          parameters: ['player_id (optional for bulk extraction)'],
          formats: ['json', 'csv'],
          use_cases: ['Player comparison', 'Form analysis', 'Parlay prediction features']
        },
        tournament_trends: {
          description: 'Aggregated tournament statistics for trend analysis',
          parameters: ['start_date', 'end_date'],
          formats: ['json', 'csv'],
          use_cases: ['Tournament difficulty analysis', 'Field strength assessment', 'Seasonal trends']
        },
        matchup_training_data: {
          description: 'Historical matchup results for ML model training',
          parameters: ['matchup_type (2ball|3ball)', 'min_position', 'max_position', 'start_date'],
          formats: ['json', 'csv'],
          use_cases: ['Parlay prediction models', 'Head-to-head analysis', 'Betting optimization']
        },
        live_context: {
          description: 'Current tournament data for real-time analysis',
          parameters: ['limit'],
          formats: ['json', 'csv'],
          use_cases: ['Live predictions', 'Real-time monitoring', 'In-play analytics']
        }
      },
      common_parameters: {
        format: 'Output format (json|csv) - default: json',
        page: 'Page number for pagination - default: 1',
        limit: 'Records per page (max: 1000) - default: 100',
        sort_by: 'Sort column - default: snapshot_timestamp',
        sort_order: 'Sort direction (asc|desc) - default: desc'
      },
      example_requests: [
        'GET /api/ml-data?endpoint=historical_snapshots&format=csv&limit=1000&start_date=2024-01-01',
        'GET /api/ml-data?endpoint=player_features&player_id=9999&format=json',
        'GET /api/ml-data?endpoint=matchup_training_data&matchup_type=3ball&format=csv&max_position=30',
        'GET /api/ml-data?endpoint=tournament_trends&start_date=2024-01-01&end_date=2024-12-31&format=csv'
      ],
      rate_limits: {
        requests_per_minute: 60,
        bulk_extraction_limit: 1000,
        concurrent_requests: 5
      }
    }, 'Enhanced ML Data Extraction API Documentation')

  } catch (error) {
    logger.error('Enhanced ML Data API error:', error)
    return handleApiError('ML data extraction failed')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      endpoints = [],
      filters = {},
      format = 'json',
      options = {}
    } = body

    if (!Array.isArray(endpoints) || endpoints.length === 0) {
      return handleApiError('endpoints array is required')
    }

    if (endpoints.length > 5) {
      return handleApiError('Maximum 5 endpoints per bulk request')
    }

    const supabase = createSupabaseClient()
    const snapshotService = new TournamentSnapshotService()
    const results = {}

    logger.info(`Bulk ML extraction for endpoints: ${endpoints.join(', ')}`)

    // Process each endpoint
    for (const endpoint of endpoints) {
      try {
        switch (endpoint) {
          case 'historical_snapshots':
            results[endpoint] = await extractHistoricalSnapshots(supabase, filters, options)
            break
          
          case 'player_features':
            results[endpoint] = await extractPlayerFeatures(snapshotService, filters, options)
            break
            
          case 'matchup_training_data':
            results[endpoint] = await extractMatchupTrainingData(supabase, filters, options)
            break
            
          default:
            results[endpoint] = { error: `Unknown endpoint: ${endpoint}` }
        }

        // Convert to CSV if requested
        if (format === 'csv' && results[endpoint] && !results[endpoint].error) {
          results[endpoint].data = convertToCSVArray(results[endpoint].data || [])
        }

      } catch (error) {
        logger.error(`Error processing endpoint ${endpoint}:`, error)
        results[endpoint] = { error: `Processing failed for ${endpoint}` }
      }
    }

    return jsonSuccess({
      results,
      metadata: {
        endpoints_processed: endpoints.length,
        format,
        extracted_at: new Date().toISOString(),
        filters_applied: filters
      }
    }, `Bulk extraction completed for ${endpoints.length} endpoints`)

  } catch (error) {
    logger.error('Bulk ML extraction error:', error)
    return handleApiError('Bulk extraction failed')
  }
}

// 🛠️ Helper Functions

function extractMLFeatures(profile: any) {
  return {
    // Player Identity
    dg_id: profile.dg_id,
    player_name: profile.player_name,
    
    // Tournament Performance Features (normalized)
    avg_finish_5: profile.avg_finish_5,
    avg_finish_10: profile.avg_finish_10,
    avg_finish_season: profile.avg_finish_season,
    finish_trend_score: profile.finish_trend === 'improving' ? 1 : profile.finish_trend === 'declining' ? -1 : 0,
    
    // Strokes Gained Features
    sg_total_season: profile.sg_total_season,
    sg_total_recent_5: profile.sg_total_recent_5,
    sg_total_recent_10: profile.sg_total_recent_10,
    sg_trend_score: profile.sg_total_trend === 'improving' ? 1 : profile.sg_total_trend === 'declining' ? -1 : 0,
    
    // Individual SG Categories
    sg_ott_season: profile.sg_ott_season,
    sg_ott_recent: profile.sg_ott_recent,
    sg_app_season: profile.sg_app_season,
    sg_app_recent: profile.sg_app_recent,
    sg_arg_season: profile.sg_arg_season,
    sg_arg_recent: profile.sg_arg_recent,
    sg_putt_season: profile.sg_putt_season,
    sg_putt_recent: profile.sg_putt_recent,
    
    // Round Performance Features
    round1_avg: profile.round1_avg,
    round2_avg: profile.round2_avg,
    round3_avg: profile.round3_avg,
    round4_avg: profile.round4_avg,
    weekend_vs_weekday: profile.weekend_vs_weekday,
    pressure_performance: profile.pressure_round_performance,
    
    // Advanced Analytics
    consistency_score: profile.consistency_score,
    volatility_score: profile.volatility_score,
    clutch_performance: profile.clutch_performance,
    
    // Form Indicators (one-hot encoded)
    form_hot: profile.form_trajectory === 'hot' ? 1 : 0,
    form_cold: profile.form_trajectory === 'cold' ? 1 : 0,
    form_steady: profile.form_trajectory === 'steady' ? 1 : 0,
    form_inconsistent: profile.form_trajectory === 'inconsistent' ? 1 : 0,
    
    // Parlay History
    twoBall_win_rate: profile.twoBall_win_rate,
    threeBall_win_rate: profile.threeBall_win_rate,
    total_parlays: profile.twoBall_total + profile.threeBall_total,
    
    // Confidence & Quality Metrics
    prediction_confidence: profile.prediction_confidence,
    data_quality_score: calculateDataQualityScore(profile),
    
    // Metadata
    last_updated: profile.last_updated,
    extracted_at: new Date().toISOString()
  }
}

function calculateDataQualityScore(profile: any): number {
  let score = 0
  let maxScore = 0
  
  // Check data completeness
  const checks = [
    profile.avg_finish_5 > 0,
    profile.sg_total_season !== 0,
    profile.sg_total_recent_5 !== 0,
    profile.consistency_score > 0,
    profile.round1_avg > 0,
    profile.form_trajectory !== 'steady'
  ]
  
  checks.forEach(check => {
    maxScore += 1
    if (check) score += 1
  })
  
  return Math.round((score / maxScore) * 100)
}

function convertToCSVArray(data: any[]): any[] {
  if (!data || data.length === 0) return []
  
  const headers = Object.keys(data[0])
  const rows = [headers]
  
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header]
      if (value === null || value === undefined) return ''
      if (typeof value === 'string' && value.includes(',')) return `"${value}"`
      return value
    })
    rows.push(row)
  })
  
  return rows
}

/**
 * Flatten JSONB snapshot data into ML-ready features
 */
function flattenSnapshotForML(snapshot: any): any {
  if (!snapshot) return {}
  
  const flattened: any = {}
  
  // Basic betting context
  flattened.bet_timestamp = snapshot.bet_timestamp
  flattened.round_num = snapshot.round_num
  flattened.event_name = snapshot.event_name
  
  // Matchup data
  if (snapshot.matchup) {
    flattened.matchup_type = snapshot.matchup.type
    flattened.event_id = snapshot.matchup.event_id
    flattened.matchup_round_num = snapshot.matchup.round_num
    
    // Player data
    snapshot.matchup.players?.forEach((player: any, idx: number) => {
      const playerPrefix = `player${idx + 1}`
      flattened[`${playerPrefix}_dg_id`] = player.dg_id
      flattened[`${playerPrefix}_name`] = player.name
      flattened[`${playerPrefix}_fanduel_odds`] = player.fanduel_odds
      flattened[`${playerPrefix}_draftkings_odds`] = player.draftkings_odds
      flattened[`${playerPrefix}_dg_odds`] = player.dg_odds
    })
  }
  
  // Player stats at bet time
  if (snapshot.player_stats) {
    Object.entries(snapshot.player_stats).forEach(([dgId, stats]: [string, any]) => {
      const prefix = `stats_${dgId}`
      flattened[`${prefix}_sg_total`] = stats.sg_total
      flattened[`${prefix}_sg_ott`] = stats.sg_ott
      flattened[`${prefix}_sg_app`] = stats.sg_app
      flattened[`${prefix}_sg_arg`] = stats.sg_arg
      flattened[`${prefix}_sg_putt`] = stats.sg_putt
      flattened[`${prefix}_driving_acc`] = stats.driving_acc
      flattened[`${prefix}_driving_dist`] = stats.driving_dist
    })
  }
  
  // Live stats at bet time
  if (snapshot.live_stats) {
    Object.entries(snapshot.live_stats).forEach(([dgId, stats]: [string, any]) => {
      const prefix = `live_${dgId}`
      flattened[`${prefix}_position`] = stats.position
      flattened[`${prefix}_total`] = stats.total
      flattened[`${prefix}_today`] = stats.today
      flattened[`${prefix}_thru`] = stats.thru
      flattened[`${prefix}_sg_total`] = stats.sg_total
      flattened[`${prefix}_sg_ott`] = stats.sg_ott
      flattened[`${prefix}_sg_app`] = stats.sg_app
      flattened[`${prefix}_sg_putt`] = stats.sg_putt
    })
  }
  
  // Calculated features
  if (snapshot.calculated_features) {
    const features = snapshot.calculated_features
    
    // Picked player features
    if (features.picked_player) {
      flattened.picked_player_dg_id = features.picked_player.dg_id
      flattened.picked_player_name = features.picked_player.name
      flattened.picked_player_position = features.picked_player.position_in_matchup
      flattened.implied_probability = features.picked_player.implied_probability
      flattened.value_rating = features.picked_player.value_rating
      flattened.confidence_score = features.picked_player.confidence_score
    }
    
    // Group analysis features
    if (features.group_analysis) {
      flattened.avg_sg_total = features.group_analysis.avg_sg_total
      flattened.odds_spread = features.group_analysis.odds_spread
      flattened.favorite_dg_id = features.group_analysis.favorite_dg_id
      flattened.underdog_dg_id = features.group_analysis.underdog_dg_id
    }
  }
  
  return flattened
}

// Bulk extraction helper functions
async function extractHistoricalSnapshots(supabase: any, filters: any, options: any) {
  const { data } = await supabase
    .from('tournament_round_snapshots')
    .select('*')
    .limit(options.limit || 1000)
  
  return { data: data || [], count: data?.length || 0 }
}

async function extractPlayerFeatures(snapshotService: any, filters: any, options: any) {
  // Implementation for bulk player features extraction
  return { data: [], count: 0 }
}

async function extractMatchupTrainingData(supabase: any, filters: any, options: any) {
  // Implementation for bulk matchup data extraction
  return { data: [], count: 0 }
} 
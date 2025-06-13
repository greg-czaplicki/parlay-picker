import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'
import { TournamentSnapshotService } from './tournament-snapshot-service'

/**
 * 🔄 TOURNAMENT DATA SERVICE WITH FALLBACK MECHANISMS
 * Provides reliable access to tournament data with automatic fallback
 * from snapshots to live data when needed
 */

export interface TournamentDataQuery {
  event_id?: number
  event_name?: string
  round_num?: string
  player_id?: number
  start_date?: string
  end_date?: string
  prefer_snapshots?: boolean
}

export interface DataSourceInfo {
  source: 'snapshot' | 'live' | 'hybrid'
  snapshot_available: boolean
  live_available: boolean
  data_freshness: string
  query_performance_ms: number
}

export class TournamentDataService {
  private supabase = createSupabaseClient()
  private snapshotService = new TournamentSnapshotService()
  
  // Configuration
  private readonly FALLBACK_TIMEOUT_MS = 5000
  private readonly CACHE_TTL_MS = 5 * 60 * 1000

  // Simple in-memory cache
  private cache = new Map<string, { data: any; timestamp: number; source: string }>()

  /**
   * 🎯 PRIMARY DATA ACCESS METHOD
   * Get tournament data with automatic fallback logic
   */
  async getTournamentData(query: TournamentDataQuery): Promise<{
    data: any[]
    source_info: DataSourceInfo
    cached: boolean
  }> {
    const startTime = Date.now()
    const cacheKey = this.generateCacheKey(query)
    
    // Check cache first
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      return {
        data: cached.data,
        source_info: {
          source: cached.source as any,
          snapshot_available: true,
          live_available: true,
          data_freshness: 'cached',
          query_performance_ms: Date.now() - startTime
        },
        cached: true
      }
    }

    // Determine data access strategy
    const strategy = await this.determineDataStrategy(query)
    let data: any[] = []
    let actualSource: 'snapshot' | 'live' | 'hybrid' = 'live'

    try {
      switch (strategy.approach) {
        case 'snapshot_only':
          data = await this.getFromSnapshots(query)
          actualSource = 'snapshot'
          break
          
        case 'live_only':
          data = await this.getFromLive(query)
          actualSource = 'live'
          break
          
        case 'snapshot_with_fallback':
          try {
            data = await Promise.race([
              this.getFromSnapshots(query),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Snapshot timeout')), this.FALLBACK_TIMEOUT_MS)
              )
            ]) as any[]
            actualSource = 'snapshot'
          } catch (error) {
            logger.warn('Snapshot query failed, falling back to live data:', error)
            data = await this.getFromLive(query)
            actualSource = 'live'
          }
          break
      }

      // Cache the results
      this.setCache(cacheKey, data, actualSource)

      return {
        data,
        source_info: {
          source: actualSource,
          snapshot_available: strategy.snapshot_available,
          live_available: strategy.live_available,
          data_freshness: this.calculateDataFreshness(data),
          query_performance_ms: Date.now() - startTime
        },
        cached: false
      }

    } catch (error) {
      logger.error('All data sources failed:', error)
      throw new Error(`Tournament data unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 🎯 SPECIALIZED: Get player performance data with fallback
   */
  async getPlayerPerformanceHistory(
    playerId: number, 
    eventId?: number,
    options: { include_snapshots?: boolean; max_tournaments?: number } = {}
  ): Promise<{
    data: any[]
    source_info: DataSourceInfo
  }> {
    const { include_snapshots = true, max_tournaments = 10 } = options
    
    const query: TournamentDataQuery = {
      player_id: playerId,
      event_id: eventId,
      prefer_snapshots: include_snapshots
    }

    if (include_snapshots) {
      // Try to get comprehensive history from snapshots first
      try {
        const snapshotData = await this.getFromSnapshots({
          ...query,
          start_date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString() // Last year
        })
        
        if (snapshotData.length > 0) {
          return {
            data: snapshotData.slice(0, max_tournaments),
            source_info: {
              source: 'snapshot',
              snapshot_available: true,
              live_available: true,
              data_freshness: 'historical',
              query_performance_ms: 0
            }
          }
        }
      } catch (error) {
        logger.warn('Failed to get player history from snapshots, falling back to live data')
      }
    }

    // Fallback to live data
    return this.getTournamentData(query)
  }

  /**
   * 🎯 SPECIALIZED: Get tournament trends with optimal data source
   */
  async getTournamentTrends(
    eventId: number,
    options: { include_historical?: boolean; rounds?: string[] } = {}
  ): Promise<{
    data: any[]
    source_info: DataSourceInfo
  }> {
    const { include_historical = true, rounds = ['1', '2', '3', '4'] } = options

    if (include_historical) {
      // For trends, snapshots are ideal since they preserve historical state
      const query: TournamentDataQuery = {
        event_id: eventId,
        prefer_snapshots: true,
        start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last week
      }

      try {
        const result = await this.getTournamentData(query)
        
        // Filter and organize by rounds
        const trendData = result.data.filter(record => 
          rounds.includes(record.round_num)
        ).sort((a, b) => {
          // Sort by round, then timestamp
          const roundCompare = parseInt(a.round_num) - parseInt(b.round_num)
          if (roundCompare !== 0) return roundCompare
          return new Date(a.snapshot_timestamp || a.data_golf_updated_at).getTime() - 
                 new Date(b.snapshot_timestamp || b.data_golf_updated_at).getTime()
        })

        return {
          data: trendData,
          source_info: result.source_info
        }
      } catch (error) {
        logger.warn('Failed to get tournament trends, falling back to current data only')
      }
    }

    // Fallback: just get current live data
    return this.getTournamentData({ event_id: eventId })
  }

  private async determineDataStrategy(query: TournamentDataQuery) {
    const snapshotAvailable = await this.checkSnapshotAvailability(query)
    const liveAvailable = await this.checkLiveDataAvailability(query)

    if (query.start_date || query.end_date) {
      return {
        approach: snapshotAvailable ? 'snapshot_with_fallback' : 'live_only',
        snapshot_available: snapshotAvailable,
        live_available: liveAvailable,
        reason: 'Historical query'
      }
    }

    return {
      approach: query.prefer_snapshots ? 'snapshot_with_fallback' : 'live_only',
      snapshot_available: snapshotAvailable,
      live_available: liveAvailable,
      reason: 'Standard query'
    }
  }

  private async getFromSnapshots(query: TournamentDataQuery): Promise<any[]> {
    let snapshotQuery = this.supabase.from('tournament_round_snapshots').select('*')

    if (query.event_id) snapshotQuery = snapshotQuery.eq('event_id', query.event_id)
    if (query.event_name) snapshotQuery = snapshotQuery.eq('event_name', query.event_name)
    if (query.round_num) snapshotQuery = snapshotQuery.eq('round_num', query.round_num)
    if (query.player_id) snapshotQuery = snapshotQuery.eq('dg_id', query.player_id)
    if (query.start_date) snapshotQuery = snapshotQuery.gte('snapshot_timestamp', query.start_date)
    if (query.end_date) snapshotQuery = snapshotQuery.lte('snapshot_timestamp', query.end_date)

    const { data, error } = await snapshotQuery.order('snapshot_timestamp', { ascending: false }).limit(1000)

    if (error) throw new Error(`Snapshot query failed: ${error.message}`)
    return data || []
  }

  private async getFromLive(query: TournamentDataQuery): Promise<any[]> {
    let liveQuery = this.supabase.from('live_tournament_stats').select('*')

    if (query.event_name) liveQuery = liveQuery.eq('event_name', query.event_name)
    if (query.round_num) liveQuery = liveQuery.eq('round_num', query.round_num)
    if (query.player_id) liveQuery = liveQuery.eq('dg_id', query.player_id)

    const { data, error } = await liveQuery.order('data_golf_updated_at', { ascending: false }).limit(1000)

    if (error) throw new Error(`Live data query failed: ${error.message}`)
    return data || []
  }

  private async checkSnapshotAvailability(query: TournamentDataQuery): Promise<boolean> {
    try {
      const { count } = await this.supabase
        .from('tournament_round_snapshots')
        .select('id', { count: 'exact', head: true })
        .limit(1)
      return (count || 0) > 0
    } catch {
      return false
    }
  }

  private async checkLiveDataAvailability(query: TournamentDataQuery): Promise<boolean> {
    try {
      const { count } = await this.supabase
        .from('live_tournament_stats')
        .select('dg_id', { count: 'exact', head: true })
        .gte('data_golf_updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
      return (count || 0) > 0
    } catch {
      return false
    }
  }

  private generateCacheKey(query: TournamentDataQuery): string {
    return Buffer.from(JSON.stringify(query)).toString('base64').slice(0, 32)
  }

  private getFromCache(key: string): { data: any; source: string } | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return { data: cached.data, source: cached.source }
    }
    if (cached) this.cache.delete(key)
    return null
  }

  private setCache(key: string, data: any, source: string): void {
    this.cache.set(key, { data, source, timestamp: Date.now() })
  }

  private calculateDataFreshness(data: any[]): string {
    if (!data || data.length === 0) return 'no_data'
    
    const latestTimestamp = Math.max(
      ...data.map(item => 
        new Date(item.snapshot_timestamp || item.data_golf_updated_at || 0).getTime()
      )
    )

    const ageHours = (Date.now() - latestTimestamp) / (1000 * 60 * 60)
    
    if (ageHours < 1) return 'very_fresh'
    if (ageHours < 6) return 'fresh'
    if (ageHours < 24) return 'recent'
    return 'historical'
  }

  public clearCache(): void {
    this.cache.clear()
  }

  public getCacheStats(): {
    size: number
    hit_rate: number
    avg_age_minutes: number
  } {
    const entries = Array.from(this.cache.values())
    const now = Date.now()
    const avgAge = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0) / entries.length / (1000 * 60)
      : 0

    return {
      size: this.cache.size,
      hit_rate: 0, // Would need to track hits/misses
      avg_age_minutes: Math.round(avgAge * 100) / 100
    }
  }
} 
import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

/**
 * 🧹 SNAPSHOT DATA RETENTION & CLEANUP SERVICE
 * Manages snapshot lifecycle and implements retention policies
 */

export interface RetentionPolicy {
  name: string
  max_age_days: number
  keep_every_nth: number
  min_snapshots_to_keep: number
}

export interface RetentionStats {
  total_snapshots: number
  snapshots_deleted: number
  storage_freed_mb: number
  policy_applied: string
  execution_time_ms: number
}

export class SnapshotRetentionService {
  private supabase = createSupabaseClient()

  private readonly DEFAULT_POLICIES: Record<string, RetentionPolicy> = {
    production: {
      name: 'Production',
      max_age_days: 365,
      keep_every_nth: 4,
      min_snapshots_to_keep: 100
    },
    
    development: {
      name: 'Development', 
      max_age_days: 90,
      keep_every_nth: 10,
      min_snapshots_to_keep: 50
    }
  }

  /**
   * 🧹 Apply retention policy to snapshot data
   */
  async applyRetentionPolicy(
    policyName: keyof typeof this.DEFAULT_POLICIES = 'production'
  ): Promise<RetentionStats> {
    const startTime = Date.now()
    const policy = this.DEFAULT_POLICIES[policyName]

    logger.info(`Applying retention policy: ${policy.name}`)

    let stats: RetentionStats = {
      total_snapshots: 0,
      snapshots_deleted: 0,
      storage_freed_mb: 0,
      policy_applied: policy.name,
      execution_time_ms: 0
    }

    try {
      // Get current snapshot count
      const { count: totalCount } = await this.supabase
        .from('tournament_round_snapshots')
        .select('id', { count: 'exact', head: true })

      stats.total_snapshots = totalCount || 0

      if (stats.total_snapshots <= policy.min_snapshots_to_keep) {
        logger.info(`Total snapshots (${stats.total_snapshots}) below minimum threshold`)
        stats.execution_time_ms = Date.now() - startTime
        return stats
      }

      // Delete old snapshots
      const deletionStats = await this.deleteOldSnapshots(policy)
      stats.snapshots_deleted = deletionStats.deleted_count
      stats.storage_freed_mb = deletionStats.storage_freed_mb

      // Clean up orphaned data
      const orphanStats = await this.cleanupOrphanedData()
      stats.snapshots_deleted += orphanStats.deleted_count

      stats.execution_time_ms = Date.now() - startTime
      logger.info('Retention policy applied successfully', stats)
      return stats

    } catch (error) {
      logger.error('Failed to apply retention policy:', error)
      stats.execution_time_ms = Date.now() - startTime
      throw error
    }
  }

  private async deleteOldSnapshots(policy: RetentionPolicy): Promise<{
    deleted_count: number
    storage_freed_mb: number
  }> {
    const cutoffDate = new Date(Date.now() - policy.max_age_days * 24 * 60 * 60 * 1000)
    
    const { count } = await this.supabase
      .from('tournament_round_snapshots')
      .select('id', { count: 'exact', head: true })
      .lt('snapshot_timestamp', cutoffDate.toISOString())

    if (!count || count === 0) {
      return { deleted_count: 0, storage_freed_mb: 0 }
    }

    const estimatedStorageMB = count * 0.01 // ~10KB per snapshot

    const { error } = await this.supabase
      .from('tournament_round_snapshots')
      .delete()
      .lt('snapshot_timestamp', cutoffDate.toISOString())

    if (error) {
      logger.error('Failed to delete old snapshots:', error)
      return { deleted_count: 0, storage_freed_mb: 0 }
    }

    logger.info(`Deleted ${count} old snapshots, freed ${estimatedStorageMB.toFixed(2)}MB`)
    return { deleted_count: count, storage_freed_mb: estimatedStorageMB }
  }

  private async cleanupOrphanedData(): Promise<{ deleted_count: number }> {
    // Clean up orphaned data would require more complex queries
    // For now, just return 0 - this can be enhanced later
    logger.info('Orphaned data cleanup placeholder - would implement with more complex queries')
    return { deleted_count: 0 }
  }

  /**
   * 📊 Get retention statistics
   */
  async getRetentionStats(): Promise<{
    current_snapshot_count: number
    oldest_snapshot_date: string | null
    estimated_storage_mb: number
  }> {
    const { count } = await this.supabase
      .from('tournament_round_snapshots')
      .select('id', { count: 'exact', head: true })

    const { data: dateRange } = await this.supabase
      .from('tournament_round_snapshots')
      .select('snapshot_timestamp')
      .order('snapshot_timestamp', { ascending: true })
      .limit(1)

    const estimatedStorageMB = (count || 0) * 0.01

    return {
      current_snapshot_count: count || 0,
      oldest_snapshot_date: dateRange?.[0]?.snapshot_timestamp || null,
      estimated_storage_mb: estimatedStorageMB
    }
  }

  /**
   * 🔄 Schedule automatic retention
   */
  async scheduleRetention(environment: 'production' | 'development' = 'production'): Promise<RetentionStats> {
    logger.info(`Running scheduled retention cleanup for ${environment}`)
    
    try {
      return await this.applyRetentionPolicy(environment)
    } catch (error) {
      logger.error('Scheduled retention failed:', error)
      throw error
    }
  }
} 
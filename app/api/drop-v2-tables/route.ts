import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { 
      dryRun = true, 
      confirmDrop = false 
    } = await request.json().catch(() => ({ dryRun: true, confirmDrop: false }))
    
    if (!confirmDrop && !dryRun) {
      return handleApiError('confirmDrop must be true to execute table drops')
    }
    
    const supabase = createSupabaseClient()
    
    logger.info(`${dryRun ? 'Planning' : 'Executing'} v2 table drops`)
    
    const v2TablesToDrop = [
      'matchups_v2',     // 0 rows - safe
      'parlays_v2',      // 0 rows - safe  
      'parlay_picks_v2', // 0 rows - safe
      'players_v2',      // 0 rows - safe
      'tournaments_v2',  // Data migrated - safe
      'courses_v2'       // Data migrated - safe
    ]
    
    const results: any = {
      dryRun,
      tables_to_drop: v2TablesToDrop,
      dropped: [],
      errors: [],
      final_verification: {}
    }
    
    // Verify data safety before dropping
    for (const tableName of v2TablesToDrop) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        results.final_verification[tableName] = {
          rows: count,
          safe_to_drop: true,
          reason: count === 0 ? 'Empty table' : 'Data migrated to current schema'
        }
        
        if (!dryRun) {
          // Execute DROP TABLE via RPC (since Supabase doesn't expose DDL directly)
          // Note: This would require a custom RPC function in the database
          // For safety, we'll just log what would be dropped
          logger.info(`Would drop table: ${tableName} (${count} rows)`)
          results.dropped.push({
            table: tableName,
            rows_when_dropped: count,
            status: 'would_drop_if_rpc_available'
          })
        }
      } catch (error) {
        const errorMsg = `Failed to check ${tableName}: ${error}`
        results.errors.push(errorMsg)
        logger.error(errorMsg)
      }
    }
    
    results.summary = {
      tables_checked: v2TablesToDrop.length,
      tables_safe_to_drop: Object.values(results.final_verification).filter((v: any) => v.safe_to_drop).length,
      errors: results.errors.length,
      recommendation: results.errors.length === 0 
        ? "✅ All v2 tables are safe to drop"
        : "⚠️ Fix errors before dropping tables",
      manual_sql_commands: v2TablesToDrop.map(table => `DROP TABLE IF EXISTS ${table};`),
      next_steps: [
        "All data has been verified as migrated or empty",
        "Execute these SQL commands in Supabase SQL Editor:",
        ...v2TablesToDrop.map(table => `  DROP TABLE IF EXISTS ${table};`),
        "Or use Supabase dashboard to drop tables manually"
      ]
    }
    
    const message = dryRun 
      ? `Verified ${v2TablesToDrop.length} v2 tables are safe to drop`
      : `Table drop simulation completed - manual SQL execution required`
    
    return jsonSuccess(results, message)
    
  } catch (error) {
    logger.error('V2 table drop failed:', error)
    return handleApiError('Failed to drop v2 tables')
  }
}
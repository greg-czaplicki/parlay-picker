import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { confirm = false } = await request.json().catch(() => ({ confirm: false }))
    
    if (!confirm) {
      return handleApiError('confirm must be true to execute table drops')
    }
    
    const supabase = createSupabaseClient()
    
    logger.info('Executing v2 table drops')
    
    const dropCommands = [
      'DROP TABLE IF EXISTS matchups_v2',
      'DROP TABLE IF EXISTS parlays_v2',
      'DROP TABLE IF EXISTS parlay_picks_v2', 
      'DROP TABLE IF EXISTS players_v2',
      'DROP TABLE IF EXISTS tournaments_v2',
      'DROP TABLE IF EXISTS courses_v2'
    ]
    
    const results = {
      tables_dropped: [],
      errors: [],
      verification: {}
    }
    
    // Execute each drop command using rpc
    for (const command of dropCommands) {
      const tableName = command.split(' ')[4] // Extract table name
      try {
        // Use Supabase RPC to execute DDL
        const { data, error } = await supabase.rpc('execute_sql', { 
          sql_command: command 
        })
        
        if (error) {
          // If RPC doesn't exist, try direct SQL execution
          if (error.message.includes('function execute_sql') || error.message.includes('does not exist')) {
            logger.warn(`RPC not available, attempting direct execution for ${tableName}`)
            // This won't work directly, but we'll log it
            results.errors.push(`${tableName}: RPC function not available - manual execution required`)
          } else {
            results.errors.push(`${tableName}: ${error.message}`)
          }
        } else {
          results.tables_dropped.push(tableName)
          logger.info(`Successfully dropped table: ${tableName}`)
        }
      } catch (err) {
        results.errors.push(`${tableName}: ${err}`)
        logger.error(`Failed to drop ${tableName}:`, err)
      }
    }
    
    // Verify which tables still exist
    const v2Tables = ['matchups_v2', 'parlays_v2', 'parlay_picks_v2', 'players_v2', 'tournaments_v2', 'courses_v2']
    
    for (const tableName of v2Tables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        if (error && error.message.includes('does not exist')) {
          results.verification[tableName] = { exists: false, dropped: true }
        } else if (error) {
          results.verification[tableName] = { exists: 'unknown', error: error.message }
        } else {
          results.verification[tableName] = { exists: true, dropped: false, rows: data?.length || 0 }
        }
      } catch (err) {
        results.verification[tableName] = { exists: 'unknown', error: `${err}` }
      }
    }
    
    const droppedCount = Object.values(results.verification).filter((v: any) => v.dropped).length
    const stillExistCount = Object.values(results.verification).filter((v: any) => v.exists === true).length
    
    results.summary = {
      attempted_drops: dropCommands.length,
      successful_drops: droppedCount,
      still_exist: stillExistCount,
      errors: results.errors.length,
      all_dropped: stillExistCount === 0,
      manual_sql_required: results.errors.length > 0
    }
    
    if (results.summary.manual_sql_required) {
      results.manual_commands = dropCommands.map(cmd => `${cmd};`)
    }
    
    const message = results.summary.all_dropped 
      ? `Successfully dropped all ${droppedCount} v2 tables`
      : `Dropped ${droppedCount}/${dropCommands.length} tables - manual execution may be required`
    
    return jsonSuccess(results, message)
    
  } catch (error) {
    logger.error('Table drop execution failed:', error)
    return handleApiError('Failed to execute table drops')
  }
}
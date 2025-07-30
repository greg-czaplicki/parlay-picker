import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    logger.info('Checking v2 tables and their data')
    
    const v2Tables = [
      'matchups_v2',
      'parlays_v2', 
      'parlay_picks_v2',
      'tournaments_v2',
      'players_v2',
      'courses_v2'
    ]
    
    const results: any = {
      v2_tables: {},
      current_tables: {},
      summary: {
        v2_tables_exist: 0,
        v2_total_rows: 0,
        can_safely_drop: true,
        reasons_to_keep: []
      }
    }
    
    // Check v2 tables
    for (const tableName of v2Tables) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        if (error) {
          if (error.message.includes('does not exist')) {
            results.v2_tables[tableName] = { exists: false, error: 'Table does not exist' }
          } else {
            results.v2_tables[tableName] = { exists: false, error: error.message }
          }
        } else {
          results.summary.v2_tables_exist++
          results.summary.v2_total_rows += count || 0
          
          results.v2_tables[tableName] = { 
            exists: true, 
            rows: count,
            has_data: (count || 0) > 0
          }
          
          // Get sample data to understand what we'd lose
          if (count && count > 0) {
            const { data: sample } = await supabase
              .from(tableName)
              .select('*')
              .order('created_at', { ascending: false })
              .limit(3)
            
            results.v2_tables[tableName].sample = sample
            
            // Check if this is recent data (within 30 days)
            const recentData = sample?.filter((row: any) => {
              const created = new Date(row.created_at || row.updated_at)
              const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              return created > thirtyDaysAgo
            })
            
            if (recentData && recentData.length > 0) {
              results.summary.can_safely_drop = false
              results.summary.reasons_to_keep.push(`${tableName} has ${recentData.length} recent entries`)
            }
          }
        }
      } catch (err) {
        results.v2_tables[tableName] = { exists: false, error: `Connection error: ${err}` }
      }
    }
    
    // Check current tables for comparison
    const currentTables = [
      'betting_markets',
      'parlays',
      'parlay_picks', 
      'tournaments',
      'players',
      'courses'
    ]
    
    for (const tableName of currentTables) {
      try {
        const { count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
        
        results.current_tables[tableName] = { exists: true, rows: count }
      } catch (err) {
        results.current_tables[tableName] = { exists: false, error: `${err}` }
      }
    }
    
    // Analysis
    const v2TablesWithData = Object.entries(results.v2_tables)
      .filter(([_, info]: [string, any]) => info.exists && info.has_data)
      .map(([name, _]) => name)
    
    results.analysis = {
      v2_tables_with_data: v2TablesWithData,
      recommendation: results.summary.can_safely_drop 
        ? "✅ Safe to drop v2 tables - no recent data found"
        : "⚠️ Consider data migration - some v2 tables have recent data",
      migration_needed: !results.summary.can_safely_drop
    }
    
    return jsonSuccess(results, 'V2 table analysis completed')
    
  } catch (error) {
    logger.error('V2 table check failed:', error)
    return handleApiError('Failed to check v2 tables')
  }
}
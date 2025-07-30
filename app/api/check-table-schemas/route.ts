import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    const tables = ['tournaments', 'courses', 'tournaments_v2', 'courses_v2']
    const schemas: any = {}
    
    for (const tableName of tables) {
      try {
        // Get first row to understand schema
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (error) {
          schemas[tableName] = { error: error.message }
        } else {
          schemas[tableName] = {
            exists: true,
            columns: data && data.length > 0 ? Object.keys(data[0]) : [],
            sample: data?.[0] || null
          }
        }
      } catch (err) {
        schemas[tableName] = { error: `${err}` }
      }
    }
    
    return jsonSuccess(schemas, 'Table schemas retrieved')
    
  } catch (error) {
    logger.error('Schema check failed:', error)
    return handleApiError('Failed to check table schemas')
  }
}
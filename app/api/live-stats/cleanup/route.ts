import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const supabase = createSupabaseClient()
  
  try {
    const body = await req.json()
    const { action, days_threshold = 2 } = body
    
    if (action !== 'cleanup_stale') {
      return NextResponse.json(
        { error: 'Invalid action. Use "cleanup_stale"' },
        { status: 400 }
      )
    }
    
    logger.info(`Starting live stats cleanup with ${days_threshold} days threshold`)
    
    // Get count before cleanup
    const { count: beforeCount } = await supabase
      .from('live_tournament_stats')
      .select('*', { count: 'exact', head: true })
    
    // Clean up stale data using our database function
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_stale_live_stats', { days_threshold })
    
    if (cleanupError) {
      logger.error('Cleanup function failed:', cleanupError)
      return NextResponse.json(
        { error: 'Cleanup failed', details: cleanupError.message },
        { status: 500 }
      )
    }
    
    // Get count after cleanup
    const { count: afterCount } = await supabase
      .from('live_tournament_stats')
      .select('*', { count: 'exact', head: true })
    
    const cleanedRecords = (beforeCount || 0) - (afterCount || 0)
    
    // Run validation check
    const { data: validationResults } = await supabase
      .rpc('validate_live_stats_integrity')
    
    const issues = validationResults?.filter((r: any) => r.issue_count > 0) || []
    
    logger.info(`Cleanup completed: ${cleanedRecords} records removed`)
    
    return NextResponse.json({
      success: true,
      cleaned_records: cleanedRecords,
      records_before: beforeCount,
      records_after: afterCount,
      validation_issues: issues.length,
      issues: issues.map((i: any) => ({
        type: i.check_name,
        count: i.issue_count,
        description: i.details
      }))
    })
    
  } catch (error) {
    logger.error('Live stats cleanup error:', error)
    return NextResponse.json(
      { 
        error: 'Cleanup failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
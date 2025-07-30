import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()
    
    logger.info('Comparing v2 and current table data')
    
    const comparison: any = {
      tournaments: { v2_only: [], current_only: [], duplicates: [] },
      courses: { v2_only: [], current_only: [], duplicates: [] },
      recommendation: { can_drop_v2_tables: true, migration_steps: [] }
    }
    
    // Compare tournaments
    const { data: tournamentsV2 } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name, created_at')
    
    const { data: tournamentsCurrent } = await supabase
      .from('tournaments')
      .select('event_id, event_name, created_at')
    
    const currentEventIds = new Set(tournamentsCurrent?.map(t => t.event_id) || [])
    const v2EventIds = new Set(tournamentsV2?.map(t => t.event_id) || [])
    
    comparison.tournaments.v2_only = tournamentsV2?.filter(t => !currentEventIds.has(t.event_id)) || []
    comparison.tournaments.current_only = tournamentsCurrent?.filter(t => !v2EventIds.has(t.event_id)) || []
    comparison.tournaments.duplicates = tournamentsV2?.filter(t => currentEventIds.has(t.event_id)) || []
    
    // Compare courses
    const { data: coursesV2 } = await supabase
      .from('courses_v2')
      .select('course_name, location, created_at')
    
    const { data: coursesCurrent } = await supabase
      .from('courses')
      .select('course_name, location, created_at')
    
    const currentCourseKeys = new Set(coursesCurrent?.map(c => `${c.course_name}|${c.location}`) || [])
    const v2CourseKeys = new Set(coursesV2?.map(c => `${c.course_name}|${c.location}`) || [])
    
    comparison.courses.v2_only = coursesV2?.filter(c => !currentCourseKeys.has(`${c.course_name}|${c.location}`)) || []
    comparison.courses.current_only = coursesCurrent?.filter(c => !v2CourseKeys.has(`${c.course_name}|${c.location}`)) || []  
    comparison.courses.duplicates = coursesV2?.filter(c => currentCourseKeys.has(`${c.course_name}|${c.location}`)) || []
    
    // Analysis and recommendations
    if (comparison.tournaments.v2_only.length > 0) {
      comparison.recommendation.can_drop_v2_tables = false
      comparison.recommendation.migration_steps.push(`Migrate ${comparison.tournaments.v2_only.length} tournaments from tournaments_v2 to tournaments`)
    }
    
    if (comparison.courses.v2_only.length > 0) {
      comparison.recommendation.can_drop_v2_tables = false
      comparison.recommendation.migration_steps.push(`Migrate ${comparison.courses.v2_only.length} courses from courses_v2 to courses`)
    }
    
    comparison.summary = {
      tournaments_v2_unique: comparison.tournaments.v2_only.length,
      tournaments_duplicates: comparison.tournaments.duplicates.length,
      courses_v2_unique: comparison.courses.v2_only.length,
      courses_duplicates: comparison.courses.duplicates.length,
      migration_required: !comparison.recommendation.can_drop_v2_tables,
      final_recommendation: comparison.recommendation.can_drop_v2_tables 
        ? "✅ All v2 data exists in current tables - safe to drop v2 tables"
        : "⚠️ Migration required before dropping v2 tables"
    }
    
    return jsonSuccess(comparison, 'V2 data comparison completed')
    
  } catch (error) {
    logger.error('V2 data comparison failed:', error)
    return handleApiError('Failed to compare v2 data')
  }
}
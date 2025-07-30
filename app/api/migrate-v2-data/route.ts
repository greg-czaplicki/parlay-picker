import { NextRequest } from 'next/server'
import { createSupabaseClient, jsonSuccess, handleApiError } from '@/lib/api-utils'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const { dryRun = true } = await request.json().catch(() => ({ dryRun: true }))
    const supabase = createSupabaseClient()
    
    logger.info(`Starting v2 data migration${dryRun ? ' (DRY RUN)' : ' (LIVE)'}`)
    
    const results: any = {
      tournaments: { migrated: 0, errors: [] },
      courses: { migrated: 0, errors: [] },
      dryRun,
      migration_complete: false
    }
    
    // Migrate tournaments_v2 → tournaments
    logger.info('Migrating tournaments...')
    const { data: tournamentsV2 } = await supabase
      .from('tournaments_v2')
      .select('*')
    
    if (tournamentsV2 && tournamentsV2.length > 0) {
      for (const tournament of tournamentsV2) {
        try {
          // Check if tournament already exists in current table (by dg_id)
          const { data: existing } = await supabase
            .from('tournaments')
            .select('dg_id')
            .eq('dg_id', tournament.event_id)
            .single()
          
          if (existing) {
            logger.info(`Tournament ${tournament.event_id} already exists, skipping`)
            continue
          }
          
          if (!dryRun) {
            // Map v2 fields to current schema
            const tournamentData = {
              dg_id: tournament.event_id,          // event_id → dg_id
              name: tournament.event_name,         // event_name → name
              tour: tournament.tour,
              status: tournament.status || 'completed',
              start_date: tournament.start_date,
              end_date: tournament.end_date,
              year: new Date(tournament.start_date).getFullYear(),
              major_championship: false,
              betting_markets_available: true,
              currency: 'USD',
              created_at: tournament.created_at,
              updated_at: tournament.updated_at
            }
            
            const { error } = await supabase
              .from('tournaments')
              .insert(tournamentData)
            
            if (error) {
              results.tournaments.errors.push(`Tournament ${tournament.event_id}: ${error.message}`)
              continue
            }
          }
          
          results.tournaments.migrated++
          logger.info(`${dryRun ? '[DRY RUN] Would migrate' : 'Migrated'} tournament: ${tournament.event_name}`)
          
        } catch (error) {
          const errorMsg = `Tournament ${tournament.event_id}: ${error}`
          results.tournaments.errors.push(errorMsg)
          logger.error(errorMsg)
        }
      }
    }
    
    // Migrate courses_v2 → courses
    logger.info('Migrating courses...')
    const { data: coursesV2 } = await supabase
      .from('courses_v2')
      .select('*')
    
    if (coursesV2 && coursesV2.length > 0) {
      for (const course of coursesV2) {
        try {
          // Check if course already exists in current table
          const { data: existing } = await supabase
            .from('courses')
            .select('name')
            .eq('name', course.course_name)
            .eq('location', course.location)
            .single()
          
          if (existing) {
            logger.info(`Course ${course.course_name} already exists, skipping`)
            continue
          }
          
          if (!dryRun) {
            // Map v2 fields to current schema
            const courseData = {
              name: course.course_name,            // course_name → name
              location: course.location,
              country: 'United States',            // Default for these courses
              par: course.course_par || 72,
              course_type: 'championship',
              created_at: course.created_at,
              updated_at: course.updated_at
            }
            
            const { error } = await supabase
              .from('courses')
              .insert(courseData)
            
            if (error) {
              results.courses.errors.push(`Course ${course.course_name}: ${error.message}`)
              continue
            }
          }
          
          results.courses.migrated++
          logger.info(`${dryRun ? '[DRY RUN] Would migrate' : 'Migrated'} course: ${course.course_name}`)
          
        } catch (error) {
          const errorMsg = `Course ${course.course_name}: ${error}`
          results.courses.errors.push(errorMsg)
          logger.error(errorMsg)
        }
      }
    }
    
    results.migration_complete = !dryRun && results.tournaments.errors.length === 0 && results.courses.errors.length === 0
    results.summary = {
      tournaments_migrated: results.tournaments.migrated,
      tournaments_errors: results.tournaments.errors.length,
      courses_migrated: results.courses.migrated,
      courses_errors: results.courses.errors.length,
      next_steps: dryRun 
        ? ["Review migration plan", "Run with { \"dryRun\": false } to execute", "After successful migration, drop empty v2 tables"]
        : results.migration_complete
          ? ["Migration complete", "Safe to drop empty v2 tables: matchups_v2, parlays_v2, parlay_picks_v2, players_v2", "Safe to drop migrated v2 tables: tournaments_v2, courses_v2"]
          : ["Fix migration errors", "Re-run migration", "Do not drop v2 tables yet"]
    }
    
    const message = dryRun 
      ? `Migration plan: ${results.tournaments.migrated} tournaments, ${results.courses.migrated} courses`
      : `Migration ${results.migration_complete ? 'completed successfully' : 'completed with errors'}`
    
    return jsonSuccess(results, message)
    
  } catch (error) {
    logger.error('V2 migration failed:', error)
    return handleApiError('Failed to migrate v2 data')
  }
}
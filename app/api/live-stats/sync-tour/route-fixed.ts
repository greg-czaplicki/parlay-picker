// FIXED VERSION - Addresses the data integrity issues
import 'next-logger'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess, getQueryParams } from '@/lib/api-utils'
import { z } from 'zod'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'

// ... (keep existing interfaces)

// Helper to map DataGolf player data to Supabase insert format
function mapStatsToInsert(data: DataGolfLiveStatsResponse, timestamp: string): SupabaseLiveStat[] {
  return (data.live_stats || []).map((player) => ({
    dg_id: player.dg_id,
    player_name: player.player_name,
    event_name: data.event_name,
    course_name: data.course_name,
    round_num: data.stat_round,
    sg_app: player.sg_app,
    sg_ott: player.sg_ott,
    sg_putt: player.sg_putt,
    sg_arg: player.sg_arg ?? null,
    sg_t2g: player.sg_t2g ?? null,
    sg_total: player.sg_total ?? null,
    accuracy: player.accuracy ?? null,
    distance: player.distance ?? null,
    gir: player.gir ?? null,
    prox_fw: player.prox_fw ?? null,
    scrambling: player.scrambling ?? null,
    position: player.position ?? null,
    thru: player.thru ?? null,
    // 🔧 FIX: Use player.today instead of player.round for round score
    today: player.today ?? null,  // This was the bug: was using player.round
    total: player.total ?? null,
    data_golf_updated_at: timestamp,
  }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tour = searchParams.get('tour') || 'pga';
  logger.info(`Tour sync request received`, { tour });
  
  // Validate tour parameter
  const tourSchema = z.enum(['pga', 'euro']);
  const validationResult = tourSchema.safeParse(tour);
  
  if (!validationResult.success) {
    return handleApiError(`Invalid tour parameter: ${tour}. Must be 'pga' or 'euro'.`);
  }

  const validatedTour = validationResult.data;
  logger.info(`Validated tour parameter: ${validatedTour}`);

  let totalInsertedCount = 0;
  let lastSourceTimestamp: string | null = null;
  let fetchedEventName: string | null = null;
  const errors: string[] = [];
  const supabase = createSupabaseClient();

  try {
    // Get active tournaments
    const { data: activeTournaments } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (!activeTournaments || activeTournaments.length === 0) {
      logger.info('No active tournaments found.');
      return jsonSuccess({
        message: 'No active tournaments found',
        tour: validatedTour.toUpperCase(),
        totalRecords: 0,
        errors: [],
        lastUpdated: null
      });
    }

    // 🔧 NEW: Pre-sync cleanup for data integrity
    try {
      await supabase.rpc('cleanup_stale_live_stats', { days_threshold: 1 });
      logger.info('Pre-sync cleanup completed');
    } catch (cleanupError) {
      logger.warn('Pre-sync cleanup failed, continuing anyway:', cleanupError);
    }

    // Initialize snapshot service for automatic triggers
    const snapshotService = new TournamentSnapshotService();

    // Only fetch Euro tour data if tour is 'euro' and handle appropriately
    if (tour === 'euro') {
        return handleApiError('Euro tour data is not supported by DataGolf API. Only PGA and Opposite Field events are supported.');
    }

    for (const round of ROUNDS_TO_FETCH) {
      try {
        const data = await fetchLiveStats(tour, round);
        if (!data) continue;

        // Check if this event is in our active tournaments list
        const matchingTournament = activeTournaments.find(t => t.event_name === data.event_name);
        if (!matchingTournament) {
          logger.info(`Event "${data.event_name}" from ${tour.toUpperCase()} tour is not in active tournaments list. Skipping sync for this event.`);
          continue;
        }

        // 🔧 NEW: Prepare sync for this specific event (cleans stale data)
        try {
          const { data: prepResult } = await supabase.rpc('prepare_live_stats_sync', { 
            target_event_name: data.event_name 
          });
          if (!prepResult) {
            logger.warn(`Sync preparation failed for ${data.event_name}, skipping`);
            continue;
          }
        } catch (prepError) {
          logger.warn(`Sync preparation error for ${data.event_name}:`, prepError);
          // Continue anyway for now
        }

        const currentRoundTimestamp = new Date(data.last_updated.replace(" UTC", "Z")).toISOString();
        lastSourceTimestamp = currentRoundTimestamp;
        fetchedEventName = data.event_name;
        const statsToInsert = mapStatsToInsert(data, currentRoundTimestamp);
        
        // 🔧 NEW: Validate data before insert
        const validStats = statsToInsert.filter(stat => {
          // Filter out obviously invalid data
          if (stat.today !== null && (stat.today > 25 || stat.today < -25)) {
            logger.warn(`Filtering out invalid round score: ${stat.today} for ${stat.player_name}`);
            return false;
          }
          return true;
        });

        if (validStats.length !== statsToInsert.length) {
          logger.warn(`Filtered out ${statsToInsert.length - validStats.length} invalid records`);
        }

        // Upsert on (dg_id, round_num, event_name)
        const { error } = await supabase
          .from("live_tournament_stats")
          .upsert(validStats, { onConflict: "dg_id,round_num,event_name" });
        if (error) {
          errors.push(`Upsert failed for round ${round}: ${error.message}`);
          logger.error(`Upsert failed for round ${round}: ${error.message}`);
        } else {
          totalInsertedCount += validStats.length;
          logger.info(`Successfully synced ${validStats.length} records for round ${round}`);

          // ... (keep existing snapshot trigger logic)
        }
      } catch (err: any) {
        errors.push(err.message || String(err));
        logger.error(`Error syncing round ${round}: ${err.message || String(err)}`);
      }
    }

    // 🔧 NEW: Post-sync validation
    try {
      const { data: validationResults } = await supabase.rpc('validate_live_stats_integrity');
      if (validationResults && validationResults.length > 0) {
        for (const result of validationResults) {
          if (result.issue_count > 0) {
            logger.warn(`Data integrity issue: ${result.check_name} - ${result.issue_count} issues`);
          }
        }
      }
    } catch (validationError) {
      logger.warn('Post-sync validation failed:', validationError);
    }

    const finalMessage = `${tour.toUpperCase()} tour sync complete. Total records inserted/updated: ${totalInsertedCount} across attempted rounds for ${fetchedEventName ?? 'event'}.`;
    if (errors.length > 0) {
        logger.warn(`${tour.toUpperCase()} sync completed with errors:`, errors);
    }

    logger.info('Returning live-stats/sync-tour response');
    return jsonSuccess({
      processedCount: totalInsertedCount,
      sourceTimestamp: lastSourceTimestamp,
      eventName: fetchedEventName,
      tour: tour.toUpperCase(),
      errors,
    }, finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''));

  } catch (error) {
    logger.error(`Error in ${tour.toUpperCase()} tour sync:`, error);
    return handleApiError(`${tour.toUpperCase()} tour sync failed`);
  }
}
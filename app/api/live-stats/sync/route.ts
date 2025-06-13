import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'

// Define interfaces for the Data Golf API response
interface LivePlayerData {
  dg_id: number;
  player_name: string;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  position?: string | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  round?: number | null;
}

interface DataGolfLiveStatsResponse {
  course_name: string;
  event_name: string;
  last_updated: string; // e.g., "2021-05-24 16:15:26 UTC"
  stat_display: string;
  stat_round: string; // e.g., "event_avg"
  live_stats: LivePlayerData[];
}

// Define the structure for Supabase insert (matching historical table)
interface SupabaseLiveStat {
  dg_id: number;
  player_name: string;
  event_name: string;
  course_name: string;
  round_num: string;
  sg_app?: number | null;
  sg_ott?: number | null;
  sg_putt?: number | null;
  sg_arg?: number | null;
  sg_t2g?: number | null;
  sg_total?: number | null;
  accuracy?: number | null;
  distance?: number | null;
  gir?: number | null;
  prox_fw?: number | null;
  scrambling?: number | null;
  position?: string | null;
  thru?: number | null;
  today?: number | null;
  total?: number | null;
  data_golf_updated_at: string;
}

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// Tours to sync
const TOURS_TO_SYNC = ['pga', 'euro'];

// Helper to fetch in-play predictions for a tour
async function fetchInPlayPredictions(tour: string): Promise<any | null> {
  const url = `https://feeds.datagolf.com/preds/in-play?tour=${tour}&dead_heat=no&odds_format=percent&key=${dataGolfApiKey}`;
  
  logger.info(`Fetching ${tour.toUpperCase()} in-play predictions`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn(`${tour.toUpperCase()} tour data not found (404), skipping.`);
        return null;
      }
      const errorText = await response.text();
      throw new Error(`Fetch failed for ${tour} tour: ${response.status} - ${errorText}`);
    }
    const apiResponse = await response.json();
    logger.info(`${tour.toUpperCase()} API response keys:`, Object.keys(apiResponse));
    return {
      data: apiResponse.data || [],
      info: apiResponse.info || null,
      last_updated: new Date().toISOString() // In-play doesn't provide last_updated, use current time
    };
  } catch (err) {
    throw new Error(`Error fetching ${tour} tour: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Helper to map in-play predictions data to Supabase insert format
function mapInPlayDataToInsert(players: any[], tournament: string, timestamp: string, eventId?: number): SupabaseLiveStat[] {
  const allStats: SupabaseLiveStat[] = [];
  const uniqueKeys = new Set<string>(); // Track unique combinations to avoid duplicates

  for (const player of players) {
    // Add historical round data first (R1, R2, R3, R4)
    ['R1', 'R2', 'R3', 'R4'].forEach((roundKey, index) => {
      const roundScore = player[roundKey];
      if (roundScore !== null && roundScore !== undefined) {
        const roundNum = (index + 1).toString();
        const uniqueKey = `${player.dg_id}-${roundNum}-${tournament}`;
        
        if (!uniqueKeys.has(uniqueKey)) {
          uniqueKeys.add(uniqueKey);
          allStats.push({
            dg_id: player.dg_id,
            player_name: player.player_name,
            event_name: tournament,
            course_name: player.course || '',
            round_num: roundNum,
            sg_app: null,
            sg_ott: null,
            sg_putt: null,
            sg_arg: null,
            sg_t2g: null,
            sg_total: null,
            accuracy: null,
            distance: null,
            gir: null,
            prox_fw: null,
            scrambling: null,
            position: null,
            thru: 18,
            today: roundScore,
            total: roundScore,
            data_golf_updated_at: timestamp,
          });
        }
      }
    });

    // Add current round state (only if not already added as historical data)
    const currentRound = (player.round || 1).toString();
    const currentUniqueKey = `${player.dg_id}-${currentRound}-${tournament}`;
    
    if (!uniqueKeys.has(currentUniqueKey)) {
      uniqueKeys.add(currentUniqueKey);
      allStats.push({
        dg_id: player.dg_id,
        player_name: player.player_name,
        event_name: tournament,
        course_name: player.course || '',
        round_num: currentRound,
        sg_app: null, // In-play predictions don't include detailed stats
        sg_ott: null,
        sg_putt: null,
        sg_arg: null,
        sg_t2g: null,
        sg_total: null,
        accuracy: null,
        distance: null,
        gir: null,
        prox_fw: null,
        scrambling: null,
        position: player.current_pos || player.position || null,
        thru: player.thru || 0,
        today: player.today || 0,
        total: player.current_score || player.total || 0,
        data_golf_updated_at: timestamp,
      });
    }
  }

  return allStats;
}

export async function GET() {
  const supabase = createSupabaseClient();
  logger.info('Starting live-stats sync process');

  let fetchedEventNames: string[] = [];
  let lastSourceTimestamp: string | null = null;
  const errors: string[] = [];
  let totalInsertedCount = 0;

  try {
    // Get active tournaments list
    const { data: activeTournaments } = await supabase
      .from('tournaments')
      .select('event_id, event_name')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (!activeTournaments || activeTournaments.length === 0) {
      logger.info('No active tournaments found, skipping live stats sync.');
      return jsonSuccess({
        message: 'No active tournaments found',
        events: [],
        totalRecords: 0,
        errors: [],
        lastUpdated: null,
        syncTime: new Date().toISOString()
      });
    }

    logger.info(`Found ${activeTournaments.length} active tournaments`);

    // Initialize snapshot service for automatic triggers
    const snapshotService = new TournamentSnapshotService();

    for (const tour of TOURS_TO_SYNC) {
      try {
        const response = await fetchInPlayPredictions(tour);
        if (!response || !response.data || response.data.length === 0) {
          logger.info(`No data available for ${tour.toUpperCase()} tour, skipping.`);
          continue;
        }

        logger.info(`${tour.toUpperCase()} response structure:`, Object.keys(response));

        const { data: players, info, last_updated } = response;
        lastSourceTimestamp = last_updated;
        
        // Extract tournament name from info object
        const eventName = info?.event_name || `${tour.toUpperCase()} Tournament`;
        logger.info(`${tour.toUpperCase()} extracted event name: ${eventName}`);

        // Check if this event is in our active tournaments list
        const matchingTournament = activeTournaments.find(t => t.event_name === eventName);
        if (!matchingTournament) {
          logger.info(`Event "${eventName}" from ${tour.toUpperCase()} tour is not in active tournaments list. Skipping sync for this event.`);
          continue;
        }

        fetchedEventNames.push(eventName);

        // Look up event_id from tournament name for more reliable querying
        let eventId: number | undefined;
        const { data: tournamentData } = await supabase
          .from('tournaments')
          .select('event_id')
          .eq('event_name', eventName)
          .single();
        
        if (tournamentData) {
          eventId = tournamentData.event_id;
          logger.info(`${tour.toUpperCase()} mapped to event_id: ${eventId}`);
        } else {
          logger.warn(`No event_id found for tournament: ${eventName}`);
        }

        const statsToInsert = mapInPlayDataToInsert(players, eventName, last_updated, eventId);
        
        logger.info(`Upserting ${statsToInsert.length} records for ${tour.toUpperCase()} tour (${eventName})`);

        // Upsert on (dg_id, round_num, event_name)
        const { error } = await supabase
          .from("live_tournament_stats")
          .upsert(statsToInsert, { onConflict: "dg_id,round_num,event_name" });

        if (error) {
          errors.push(`${tour.toUpperCase()} upsert failed: ${error.message}`);
          logger.error(`${tour.toUpperCase()} upsert failed: ${error.message}`);
        } else {
          totalInsertedCount += statsToInsert.length;
          logger.info(`${tour.toUpperCase()} upsert completed successfully`);

          // 🎯 NEW: Check for snapshot triggers after successful sync
          try {
            // Get unique rounds from the synced data
            const syncedRounds = [...new Set(statsToInsert.map(s => s.round_num))];
            
            for (const roundNum of syncedRounds) {
              // Skip event_avg round for snapshots
              if (roundNum === 'event_avg') continue;
              
              const triggerResult = await snapshotService.checkAndTriggerSnapshots(
                eventName,
                roundNum,
                last_updated
              );
              
              if (triggerResult.triggered) {
                logger.info(`📸 Snapshot triggered for ${eventName}, round ${roundNum}`);
              } else {
                logger.debug(`No snapshot needed for ${eventName}, round ${roundNum}: ${triggerResult.reason}`);
              }
            }
          } catch (snapshotError) {
            logger.warn(`Snapshot trigger check failed for ${eventName}:`, snapshotError);
            // Don't fail the sync if snapshot triggers fail
          }
        }
      } catch (err: any) {
        errors.push(err.message || String(err));
        logger.error(`Error syncing ${tour.toUpperCase()} tour: ${err.message || String(err)}`);
      }
    }

    const finalMessage = `In-play predictions sync complete. Total records inserted/updated: ${totalInsertedCount} across ${TOURS_TO_SYNC.length} tours.`;
    
    if (errors.length > 0) {
      logger.warn("Sync completed with errors:", errors);
    }

    return jsonSuccess({
      processedCount: totalInsertedCount,
      sourceTimestamp: lastSourceTimestamp,
      eventNames: fetchedEventNames,
      errors,
    }, finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''));
  } catch (error) {
    logger.error("Error in live-stats sync GET function:", error);
    return handleApiError('Live stats sync failed');
  }
}

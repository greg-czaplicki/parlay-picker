import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'
import { TournamentSnapshotService } from '@/lib/services/tournament-snapshot-service'
import { NextRequest, NextResponse } from 'next/server'

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
const TOURS_TO_SYNC = ['pga', 'euro', 'opp'];

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
async function mapInPlayDataToInsert(players: any[], tournament: string, timestamp: string, eventId?: number, supabase?: any): Promise<SupabaseLiveStat[]> {
  const allStats: SupabaseLiveStat[] = [];
  const uniqueKeys = new Set<string>(); // Track unique combinations to avoid duplicates

  // Fetch existing SG data to preserve it during the upsert
  let existingSgData: Map<string, any> = new Map();
  if (supabase) {
    try {
      const { data: existingData, error } = await supabase
        .from('live_tournament_stats')
        .select('dg_id, round_num, sg_app, sg_ott, sg_putt, sg_arg, sg_t2g, sg_total')
        .eq('event_name', tournament);
      
      if (!error && existingData) {
        // Create a map keyed by dg_id-round_num for quick lookup
        existingData.forEach((record: any) => {
          const key = `${record.dg_id}-${record.round_num}`;
          existingSgData.set(key, {
            sg_app: record.sg_app,
            sg_ott: record.sg_ott,
            sg_putt: record.sg_putt,
            sg_arg: record.sg_arg,
            sg_t2g: record.sg_t2g,
            sg_total: record.sg_total
          });
        });
        logger.info(`Fetched existing SG data for ${existingSgData.size} records to preserve during update`);
      }
    } catch (err) {
      logger.warn('Failed to fetch existing SG data, will proceed without preservation:', err);
    }
  }

  for (const player of players) {
    // 🔍 VALIDATION: Check if player has valid dg_id
    if (!player.dg_id || typeof player.dg_id !== 'number') {
      logger.warn(`⚠️ Skipping player with invalid dg_id:`, {
        player_name: player.player_name,
        dg_id: player.dg_id,
        tournament
      });
      continue;
    }
    
    // Get the current round from player data or event info
    const currentRound = (player.round || player.current_round || 1).toString();
    
    // Add round-specific data for each completed round
    const roundsToAdd: string[] = [];
    
    // Always add current round
    roundsToAdd.push(currentRound);
    
    // Add event_avg for LIVE view support
    roundsToAdd.push('event_avg');
    
    // For players who have completed previous rounds, add historical data
    if (player.R1 !== undefined || player.R2 !== undefined || player.R3 !== undefined || player.R4 !== undefined) {
      // If we have R1, R2, etc. scores, add those rounds
      for (let r = 1; r < parseInt(currentRound); r++) {
        const roundKey = `R${r}`;
        if (player[roundKey] !== undefined && player[roundKey] !== null) {
          roundsToAdd.push(r.toString());
        }
      }
    }
    
    // Add stats for each round
    for (const roundNum of roundsToAdd) {
      const uniqueKey = `${player.dg_id}-${roundNum}-${tournament}`;
      
      if (!uniqueKeys.has(uniqueKey)) {
        uniqueKeys.add(uniqueKey);
        
        // Calculate round-specific scores and cumulative totals correctly
        let roundScore = 0;
        let cumulativeTotal = 0;
        
        if (roundNum === 'event_avg') {
          // Event average - use current tournament total and today's round score
          roundScore = player.today || 0;
          cumulativeTotal = player.current_score || player.total || 0;
        } else if (roundNum === currentRound) {
          // Current round - use today's score and current total
          roundScore = player.today || 0;
          cumulativeTotal = player.current_score || player.total || 0;
        } else if (player.R1 !== undefined || player.R2 !== undefined || player.R3 !== undefined || player.R4 !== undefined) {
          // Historical round - calculate from R1, R2, R3, etc. properties
          const roundKey = `R${roundNum}`;
          const absoluteRoundScore = player[roundKey];
          
          if (absoluteRoundScore !== null && absoluteRoundScore !== undefined) {
            // Convert absolute score to relative-to-par (assuming par 70)
            const par = 70;
            roundScore = absoluteRoundScore - par;
            
            // Calculate cumulative total by summing all rounds up to this one
            cumulativeTotal = 0;
            for (let r = 1; r <= parseInt(roundNum); r++) {
              const rKey = `R${r}`;
              const roundAbsoluteScore = player[rKey];
              if (roundAbsoluteScore !== null && roundAbsoluteScore !== undefined) {
                cumulativeTotal += (roundAbsoluteScore - par);
              }
            }
          } else {
            // Round not yet played
            roundScore = 0;
            cumulativeTotal = 0;
          }
        } else {
          // Fallback - no score history available
          roundScore = 0;
          cumulativeTotal = 0;
        }
        
        // Check if we have existing SG data for this player/round combination
        const sgKey = `${player.dg_id}-${roundNum}`;
        const existingSg = existingSgData.get(sgKey);
        
        allStats.push({
          dg_id: player.dg_id,
          player_name: player.player_name,
          event_name: tournament,
          course_name: player.course || '',
          round_num: roundNum,
          // Use existing SG data if available, otherwise set to null
          sg_app: existingSg?.sg_app ?? null,
          sg_ott: existingSg?.sg_ott ?? null,
          sg_putt: existingSg?.sg_putt ?? null,
          sg_arg: existingSg?.sg_arg ?? null,
          sg_t2g: existingSg?.sg_t2g ?? null,
          sg_total: existingSg?.sg_total ?? null,
          accuracy: null,
          distance: null,
          gir: null,
          prox_fw: null,
          scrambling: null,
          position: player.current_pos || player.position || null,
          thru: (roundNum === currentRound || roundNum === 'event_avg') ? (player.thru || 0) : 18, // Current round and event_avg show live thru, historical rounds are complete
          today: roundScore, // Individual round score
          total: cumulativeTotal, // Cumulative total through this round
          data_golf_updated_at: timestamp,
        });
      }
    }
  }

  return allStats;
}

export async function GET(req?: NextRequest) {
  const supabase = createSupabaseClient();
  logger.info('Starting live-stats sync process');

  let fetchedEventNames: string[] = [];
  let lastSourceTimestamp: string | null = null;
  const errors: string[] = [];
  let totalInsertedCount = 0;

  try {
    // Get active tournaments list
    const { data: activeTournaments } = await supabase
      .from('tournaments_v2')
      .select('event_id, event_name')
      .gte('end_date', new Date().toISOString().split('T')[0]);

    if (!activeTournaments || activeTournaments.length === 0) {
      logger.info('No active tournaments found, skipping live stats sync.');
      const response = NextResponse.json({
        message: 'No active tournaments found',
        events: [],
        totalRecords: 0,
        errors: [],
        lastUpdated: null,
        syncTime: new Date().toISOString()
      })

      // Ensure this endpoint is never cached
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')

      return response
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
          logger.warn(`Event "${eventName}" from ${tour.toUpperCase()} tour is not in active tournaments list.`);
          logger.info(`Active tournaments: ${activeTournaments.map(t => t.event_name).join(', ')}`);
          
          // For Euro tour, let's be more flexible and check if we have any unsettled parlays for this event
          if (tour === 'euro') {
            const { data: euroTournament } = await supabase
              .from('tournaments_v2')
              .select('event_id, event_name')
              .eq('event_name', eventName)
              .eq('tour', 'euro')
              .single();
              
            if (euroTournament) {
              logger.info(`Found Euro tour event "${eventName}" in database, proceeding with sync despite active tournament check.`);
              fetchedEventNames.push(eventName);
              // Continue processing this tournament
            } else {
              logger.info(`Euro tour event "${eventName}" not found in database, skipping.`);
              continue;
            }
          } else {
            continue;
          }
        } else {
          fetchedEventNames.push(eventName);
        }

        fetchedEventNames.push(eventName);

        // Look up event_id from tournament name for more reliable querying
        let eventId: number | undefined;
        const { data: tournamentData } = await supabase
          .from('tournaments_v2')
          .select('event_id')
          .eq('event_name', eventName)
          .single();
        
        if (tournamentData) {
          eventId = tournamentData.event_id;
          logger.info(`${tour.toUpperCase()} mapped to event_id: ${eventId}`);
        } else {
          logger.warn(`No event_id found for tournament: ${eventName}`);
        }

        const statsToInsert = await mapInPlayDataToInsert(players, eventName, last_updated, eventId, supabase);
        
        logger.info(`Upserting ${statsToInsert.length} records for ${tour.toUpperCase()} tour (${eventName})`);
        
        // 🔍 DEBUG: Log sample data for Euro tour to see what's being generated
        if (tour === 'euro' && statsToInsert.length > 0) {
          logger.info(`🔍 EURO DEBUG - Sample record for ${eventName}:`, JSON.stringify(statsToInsert[0], null, 2));
          logger.info(`🔍 EURO DEBUG - Total players: ${players.length}, Generated records: ${statsToInsert.length}`);
        }


        // Upsert on (dg_id, round_num, event_name)
        const { error } = await supabase
          .from("live_tournament_stats")
          .upsert(statsToInsert, { onConflict: "dg_id,round_num,event_name" });

        if (error) {
          errors.push(`${tour.toUpperCase()} upsert failed: ${error.message}`);
          logger.error(`${tour.toUpperCase()} upsert failed: ${error.message}`);
          // 🔍 DEBUG: Log the error details and sample data causing the issue
          if (tour === 'euro') {
            logger.error(`🔍 EURO DEBUG - Upsert error details:`, error);
            logger.error(`🔍 EURO DEBUG - Sample failing records:`, JSON.stringify(statsToInsert.slice(0, 3), null, 2));
            // Check for invalid dg_id values
            const invalidRecords = statsToInsert.filter(r => !r.dg_id || typeof r.dg_id !== 'number');
            if (invalidRecords.length > 0) {
              logger.error(`🔍 EURO DEBUG - Invalid dg_id records:`, invalidRecords.length, JSON.stringify(invalidRecords.slice(0, 2), null, 2));
            }
          }
        } else {
          totalInsertedCount += statsToInsert.length;
          logger.info(`${tour.toUpperCase()} upsert completed successfully`);
          
          // 🔍 DEBUG: Verify records were actually saved for Euro tour
          if (tour === 'euro') {
            const { count, error: verifyError } = await supabase
              .from("live_tournament_stats")
              .select("*", { count: "exact", head: true })
              .eq("event_name", eventName);
            
            if (verifyError) {
              logger.error(`🔍 EURO DEBUG - Verification query failed:`, verifyError);
            } else {
              logger.info(`🔍 EURO DEBUG - Records in DB for ${eventName}: ${count} records`);
            }
          }

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

          // 🎯 NEW: Trigger automatic round-based settlement after successful sync
          try {
            logger.info(`Triggering round-based settlement check for ${eventName}`);
            
            // Call the round settlement API internally
            const settlementResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/settle-rounds`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });

            if (settlementResponse.ok) {
              const settlementData = await settlementResponse.json();
              if (settlementData.data?.total_picks_settled > 0) {
                logger.info(`Round settlement completed: ${settlementData.data.total_picks_settled} picks settled across ${settlementData.data.successful_settlements} rounds`);
              } else {
                logger.debug(`No round settlements needed`);
              }
            } else {
              logger.warn(`Round settlement API call failed: ${settlementResponse.status}`);
            }
          } catch (settlementError) {
            logger.warn(`Round settlement trigger failed for ${eventName}:`, settlementError);
            // Don't fail the sync if settlement fails
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

    const response = NextResponse.json({
      success: true,
      message: finalMessage + (errors.length > 0 ? ` Errors: ${errors.join(', ')}` : ''),
      processedCount: totalInsertedCount,
      sourceTimestamp: lastSourceTimestamp,
      eventNames: fetchedEventNames,
      errors,
    });

    // Ensure this endpoint is never cached
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response;
  } catch (error) {
    logger.error("Error in live-stats sync GET function:", error);
    
    const errorResponse = NextResponse.json({
      success: false,
      error: 'Live stats sync failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });

    // Ensure error responses are also not cached
    errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    errorResponse.headers.set('Pragma', 'no-cache')
    errorResponse.headers.set('Expires', '0')

    return errorResponse;
  }
}

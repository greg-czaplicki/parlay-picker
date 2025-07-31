import 'next-logger'
import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

// Define interfaces for the Data Golf API response
interface ScheduleEvent {
  course: string;
  course_key: string;
  event_id: number | string; // Can be number or string like "TBD"
  event_name: string;
  latitude?: number | null;
  location?: string | null;
  longitude?: number | null;
  start_date: string; // "YYYY-MM-DD"
}

interface DataGolfScheduleResponse {
  tour: string;
  current_season: number;
  schedule: ScheduleEvent[];
}

// Define the structure for Supabase upsert (matching tournaments table)
interface SupabaseTournament {
  dg_id: number;
  name: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string; // "YYYY-MM-DD"
  status: string;
  tour: string; // Added tour field to identify PGA, OPP, or EURO
}

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=pga&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=euro&file_format=json&key=${dataGolfApiKey}`;

// Helper to calculate end date (Start Date + 4 days to cover full tournament)
function calculateEndDate(startDateStr: string): string {
    try {
        const startDate = new Date(startDateStr + 'T00:00:00'); // Add time part for reliable parsing
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 4); // Changed from 3 to 4 days to ensure Sunday is included
        // Format back to YYYY-MM-DD
        return endDate.toISOString().split('T')[0];
    } catch (e) {
        logger.error(`Error calculating end date for ${startDateStr}:`, e);
        // Return a fallback or handle error appropriately
        return startDateStr; // Fallback to start date
    }
}

// Helper to fetch schedule data from a specific tour
async function fetchTourSchedule(url: string, tourCode: string): Promise<SupabaseTournament[]> {
  logger.info(`Fetching schedule for ${tourCode} tour...`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Failed to fetch ${tourCode} schedule:`, response.status, errorText);
      return [];
    }
    
    const data: DataGolfScheduleResponse = await response.json();
    logger.info(`Successfully fetched schedule for ${data.tour} tour, season ${data.current_season}.`);
    
    // Generate a base event ID for tours that might have non-numeric IDs
    // Use 10000 for Euro tour events with non-numeric IDs to avoid conflicts
    const baseEventId = tourCode.toLowerCase() === 'euro' ? 10000 : 0;
    let nonNumericIdCounter = 0;
    
    const tournaments = data.schedule
      .filter(event => {
        // Filter out events with invalid data
        if (!event.event_name || !event.course || !event.start_date) {
          logger.info(`Skipping event with missing data: ${JSON.stringify(event)}`);
          return false;
        }
        return true;
      })
      .map(event => {
        // Handle cases where the event_id is "TBD" or another non-numeric value
        let eventId: number;
        if (typeof event.event_id === 'number') {
          eventId = event.event_id;
        } else {
          // Generate a unique ID for this non-numeric ID event
          nonNumericIdCounter++;
          eventId = baseEventId + nonNumericIdCounter;
          logger.info(`Replacing non-numeric event_id "${event.event_id}" with generated ID: ${eventId}`);
        }
        
        const startDate = new Date(event.start_date);
        const endDate = new Date(calculateEndDate(event.start_date));
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        
        // Determine status based on dates
        let status = 'scheduled';
        if (today > endDate) {
          status = 'completed';
        } else if (today >= startDate && today <= endDate) {
          status = 'in_progress';
        }
        
        return {
          dg_id: eventId,
          name: event.event_name,
          start_date: event.start_date,
          end_date: calculateEndDate(event.start_date),
          status: status,
          tour: tourCode.toLowerCase(),
        };
      });
    
    logger.info(`Processed ${tournaments.length} tournaments for ${tourCode} tour.`);
    return tournaments;
  } catch (error) {
    logger.error(`Error fetching ${tourCode} schedule:`, error);
    return [];
  }
}

export async function GET(request: Request) {
  logger.info('Received schedule/sync request', { url: request.url });
  logger.info("Fetching tournament schedules from Data Golf...");
  try {
    const supabase = createSupabaseClient();
    // Fetch all tour schedules in parallel
    const [pgaTournaments, euroTournaments] = await Promise.all([
      fetchTourSchedule(DATA_GOLF_PGA_SCHEDULE_URL, 'PGA'),
      fetchTourSchedule(DATA_GOLF_EURO_SCHEDULE_URL, 'EURO')
    ]);
    // Combine all tournaments
    const allTournaments = [...pgaTournaments, ...euroTournaments];
    logger.info(`Combined ${allTournaments.length} tournaments from all tours.`);
    // Track tour-specific counts for reporting
    const tourCounts = {
      pga: pgaTournaments.length,
      euro: euroTournaments.length
    };
    let processedCount = 0;
    if (allTournaments.length > 0) {
      const { error: upsertError } = await supabase
        .from("tournaments")
        .upsert(allTournaments, {
          onConflict: 'dg_id', // Use dg_id (Primary Key) for conflict resolution
          ignoreDuplicates: false // Ensure existing records are updated
        });
      if (upsertError) {
        logger.error("Error upserting tournaments into Supabase:", upsertError);
        throw new Error(`Supabase tournaments upsert failed: ${upsertError.message}`);
      }
      processedCount = allTournaments.length;
      logger.info(`Successfully upserted ${processedCount} tournaments into Supabase.`);
    } else {
      logger.info("No tournaments found in the fetched schedules to upsert.");
    }
    // Try to get a source timestamp if available (use the latest start_date as a proxy)
    let sourceTimestamp: string | undefined = undefined;
    if (allTournaments.length > 0) {
      // Use the latest event's start_date as a proxy for freshness
      const latest = allTournaments.reduce((a, b) => a.start_date > b.start_date ? a : b);
      sourceTimestamp = new Date(latest.start_date + 'T00:00:00Z').toISOString();
    }
    logger.info('Returning schedule/sync response');
    return jsonSuccess({
      processedCount,
      tourCounts,
      sourceTimestamp,
    }, `Synced schedules for all tours. ${processedCount} tournaments processed.`);
  } catch (error) {
    logger.error('Error in schedule/sync endpoint', { error });
    return handleApiError(error)
  }
}

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { handleApiError } from '@/lib/utils'
import { jsonSuccess, jsonError } from '@/lib/api-response'

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
  event_id: number;
  event_name: string;
  course: string;
  start_date: string; // "YYYY-MM-DD"
  end_date: string; // "YYYY-MM-DD"
  tour?: string; // Added tour field to identify PGA, OPP, or EURO
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase URL or Service Role Key missing in environment variables.",
  );
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Data Golf API Key
const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
    throw new Error("Data Golf API Key is missing in environment variables.");
}

// URLs for different tours
const DATA_GOLF_PGA_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=pga&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_EURO_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=euro&file_format=json&key=${dataGolfApiKey}`;

// Helper to calculate end date (Start Date + 3 days)
function calculateEndDate(startDateStr: string): string {
    try {
        const startDate = new Date(startDateStr + 'T00:00:00'); // Add time part for reliable parsing
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 3);
        // Format back to YYYY-MM-DD
        return endDate.toISOString().split('T')[0];
    } catch (e) {
        console.error(`Error calculating end date for ${startDateStr}:`, e);
        // Return a fallback or handle error appropriately
        return startDateStr; // Fallback to start date
    }
}

// Helper to fetch schedule data from a specific tour
async function fetchTourSchedule(url: string, tourCode: string): Promise<SupabaseTournament[]> {
  console.log(`Fetching schedule for ${tourCode} tour...`);
  
  try {
    const response = await fetch(url, { cache: 'no-store' });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch ${tourCode} schedule:`, response.status, errorText);
      return [];
    }
    
    const data: DataGolfScheduleResponse = await response.json();
    console.log(`Successfully fetched schedule for ${data.tour} tour, season ${data.current_season}.`);
    
    // Generate a base event ID for tours that might have non-numeric IDs
    // Use 10000 for Euro tour events with non-numeric IDs to avoid conflicts
    const baseEventId = tourCode.toLowerCase() === 'euro' ? 10000 : 0;
    let nonNumericIdCounter = 0;
    
    const tournaments = data.schedule
      .filter(event => {
        // Filter out events with invalid data
        if (!event.event_name || !event.course || !event.start_date) {
          console.log(`Skipping event with missing data: ${JSON.stringify(event)}`);
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
          console.log(`Replacing non-numeric event_id "${event.event_id}" with generated ID: ${eventId}`);
        }
        
        return {
          event_id: eventId,
          event_name: event.event_name,
          course: event.course,
          start_date: event.start_date,
          end_date: calculateEndDate(event.start_date),
          tour: tourCode.toLowerCase(),
        };
      });
    
    console.log(`Processed ${tournaments.length} tournaments for ${tourCode} tour.`);
    return tournaments;
  } catch (error) {
    console.error(`Error fetching ${tourCode} schedule:`, error);
    return [];
  }
}

export async function GET() {
  console.log("Fetching tournament schedules from Data Golf...");

  try {
    // Fetch all tour schedules in parallel
    const [pgaTournaments, euroTournaments] = await Promise.all([
      fetchTourSchedule(DATA_GOLF_PGA_SCHEDULE_URL, 'PGA'),
      fetchTourSchedule(DATA_GOLF_EURO_SCHEDULE_URL, 'EURO')
    ]);
    
    // Combine all tournaments
    const allTournaments = [...pgaTournaments, ...euroTournaments];
    
    console.log(`Combined ${allTournaments.length} tournaments from all tours.`);
    
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
          onConflict: 'event_id', // Use event_id (Primary Key) for conflict resolution
          ignoreDuplicates: false // Ensure existing records are updated
        });

      if (upsertError) {
        console.error("Error upserting tournaments into Supabase:", upsertError);
        throw new Error(`Supabase tournaments upsert failed: ${upsertError.message}`);
      }
      processedCount = allTournaments.length;
      console.log(`Successfully upserted ${processedCount} tournaments into Supabase.`);
    } else {
      console.log("No tournaments found in the fetched schedules to upsert.");
    }

    // Try to get a source timestamp if available (use the latest start_date as a proxy)
    let sourceTimestamp: string | undefined = undefined;
    if (allTournaments.length > 0) {
      // Use the latest event's start_date as a proxy for freshness
      const latest = allTournaments.reduce((a, b) => a.start_date > b.start_date ? a : b);
      sourceTimestamp = new Date(latest.start_date + 'T00:00:00Z').toISOString();
    }

    return jsonSuccess({
      processedCount,
      tourCounts,
      sourceTimestamp,
    }, `Synced schedules for all tours. ${processedCount} tournaments processed.`);

  } catch (error) {
    return handleApiError(error)
  }
}

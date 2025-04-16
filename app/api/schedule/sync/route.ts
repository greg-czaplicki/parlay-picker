import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response
interface ScheduleEvent {
  course: string;
  course_key: string;
  event_id: number;
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

// Assume PGA tour for now
const DATA_GOLF_SCHEDULE_URL = `https://feeds.datagolf.com/get-schedule?tour=pga&file_format=json&key=${dataGolfApiKey}`;

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

export async function GET() {
  console.log("Fetching tournament schedule from Data Golf...");

  try {
    // Use cache: 'no-store' for manual sync
    const response = await fetch(DATA_GOLF_SCHEDULE_URL, { cache: 'no-store' });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to fetch schedule from Data Golf:", response.status, errorText);
      throw new Error(`Failed to fetch schedule: ${response.status} ${errorText}`);
    }

    const data: DataGolfScheduleResponse = await response.json();
    console.log(`Successfully fetched schedule for ${data.tour} tour, season ${data.current_season}.`);

    const tournamentsToUpsert: SupabaseTournament[] = data.schedule.map((event) => ({
        event_id: event.event_id,
        event_name: event.event_name,
        course: event.course,
        start_date: event.start_date,
        end_date: calculateEndDate(event.start_date),
    }));

    console.log(`Processed ${tournamentsToUpsert.length} tournaments for upsert.`);

    let processedCount = 0;
    if (tournamentsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from("tournaments")
        .upsert(tournamentsToUpsert, {
          onConflict: 'event_id', // Use event_id (Primary Key) for conflict resolution
          ignoreDuplicates: false // Ensure existing records are updated
        });

      if (upsertError) {
        console.error("Error upserting tournaments into Supabase:", upsertError);
        throw new Error(`Supabase tournaments upsert failed: ${upsertError.message}`);
      }
      processedCount = tournamentsToUpsert.length;
      console.log(`Successfully upserted ${processedCount} tournaments into Supabase.`);
    } else {
      console.log("No tournaments found in the fetched schedule to upsert.");
    }

    // Try to get a source timestamp if available (use the latest start_date as a proxy)
    let sourceTimestamp: string | undefined = undefined;
    if (data.schedule.length > 0) {
      // Use the latest event's start_date as a proxy for freshness
      const latest = data.schedule.reduce((a, b) => a.start_date > b.start_date ? a : b);
      sourceTimestamp = new Date(latest.start_date + 'T00:00:00Z').toISOString();
    }

    return NextResponse.json({
      success: true,
      message: `Synced schedule for ${data.tour} ${data.current_season} season. ${processedCount} tournaments processed.`,
      processedCount,
      tour: data.tour,
      season: data.current_season,
      sourceTimestamp,
    });

  } catch (error) {
    console.error("Error in GET /api/schedule/sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

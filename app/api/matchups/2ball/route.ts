import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Define interfaces for the Data Golf API response (2-ball)
interface Odds {
  p1: number | null;
  p2: number | null;
}

interface BookmakerOdds {
  [bookmaker: string]: Odds;
}

interface Matchup {
  odds: BookmakerOdds;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  ties: string;
}

interface DataGolfResponse {
  event_name: string;
  last_updated: string;
  market: string;
  match_list: Matchup[];
  round_num: number;
}

// Define the structure for Supabase insertion
interface SupabaseMatchup {
  event_name: string;
  round_num: number;
  data_golf_update_time: string;
  p1_dg_id: number;
  p1_player_name: string;
  p2_dg_id: number;
  p2_player_name: string;
  ties_rule: string;
  fanduel_p1_odds: number | null;
  fanduel_p2_odds: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL or Service Role Key is missing in environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseKey);

const dataGolfApiKey = process.env.DATAGOLF_API_KEY;
if (!dataGolfApiKey) {
  throw new Error("Data Golf API Key is missing in environment variables.");
}

const DATA_GOLF_PGA_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=pga&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;
const DATA_GOLF_OPP_URL = `https://feeds.datagolf.com/betting-tools/matchups?tour=opp&market=round_matchups&odds_format=decimal&file_format=json&key=${dataGolfApiKey}`;

export async function GET() {
  // 1. Fetch Data Golf's last_updated timestamp (PGA only, as a reference)
  const dataGolfRes = await fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 3600 } });
  if (!dataGolfRes.ok) {
    const errorText = await dataGolfRes.text();
    return NextResponse.json({ success: false, error: `Failed to fetch Data Golf: ${errorText}` }, { status: 500 });
  }
  const dataGolfJson: DataGolfResponse = await dataGolfRes.json();
  const dataGolfLastUpdated = new Date(dataGolfJson.last_updated.replace(" UTC", "Z"));

  // 2. Check for recent matchups in the DB (by data_golf_update_time)
  const { data: recentMatchups, error: recentError } = await supabase
    .from("latest_two_ball_matchups")
    .select("*")
    .order("data_golf_update_time", { ascending: false })
    .limit(1);

  if (recentError) {
    console.error("Error checking for recent 2-ball matchups:", recentError);
  }

  if (recentMatchups && recentMatchups.length > 0) {
    const latest = recentMatchups[0];
    const dbLastUpdated = new Date(latest.data_golf_update_time);
    // If DB is as fresh as Data Golf, serve from cache
    if (dbLastUpdated >= dataGolfLastUpdated) {
      const { data: allRecent, error: allRecentError } = await supabase
        .from("latest_two_ball_matchups")
        .select("*")
        .eq("event_name", latest.event_name)
        .eq("round_num", latest.round_num)
        .eq("data_golf_update_time", latest.data_golf_update_time);
      if (allRecentError) {
        return NextResponse.json({ success: false, error: allRecentError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, cached: true, matchups: allRecent });
    }
  }

  console.log("Fetching 2-ball matchups from Data Golf (PGA and Opposite Field)...");
  try {
    // Fetch both PGA and Opposite Field events in parallel
    const [pgaRes, oppRes] = await Promise.all([
      fetch(DATA_GOLF_PGA_URL, { next: { revalidate: 3600 } }),
      fetch(DATA_GOLF_OPP_URL, { next: { revalidate: 3600 } })
    ]);

    // Fetch tournaments from Supabase with dates to help match events
    const { data: tournaments, error: tournamentsError } = await supabase
      .from("tournaments")
      .select("event_id, event_name, start_date, end_date");
    if (tournamentsError) {
      throw new Error(`Failed to fetch tournaments: ${tournamentsError.message}`);
    }
    
    // Create a map from event name to ID
    const eventNameToId = new Map<string, number>();
    (tournaments || []).forEach(t => eventNameToId.set(t.event_name, t.event_id));
    
    // Get current date and calculate current week's Monday and Sunday
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Calculate Monday of current week (go back to the most recent Monday)
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((currentDay + 6) % 7)); // +6 % 7 handles Sunday (0) properly
    monday.setHours(0, 0, 0, 0);
    
    // Calculate Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Format dates as YYYY-MM-DD for comparison
    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];
    
    console.log(`Current week: ${mondayStr} to ${sundayStr}`);
    
    // Get tournaments happening this week
    // A tournament is "this week" if any part of it overlaps with the current week
    const activeWeekTournaments = tournaments?.filter(t => {
      // If tournament end date is >= monday of this week AND tournament start date is <= sunday of this week
      return t.end_date >= mondayStr && t.start_date <= sundayStr;
    }) || [];
    
    console.log(`Found ${activeWeekTournaments.length} tournaments happening this week:`, 
      activeWeekTournaments.map(t => `${t.event_name} (${t.start_date} to ${t.end_date})`));

    // 2b. Check latest data_golf_update_time in historical table
    const { data: latestHist, error: histError } = await supabase
      .from("two_ball_matchups")
      .select("data_golf_update_time")
      .order("data_golf_update_time", { ascending: false })
      .limit(1);
    let histLastUpdated = null;
    if (latestHist && latestHist.length > 0) {
      histLastUpdated = new Date(latestHist[0].data_golf_update_time);
    }

    const results = [];
    const allInsertedMatchups = [];
    const sources: [Response, string][] = [
      [pgaRes, 'PGA'],
      [oppRes, 'OPP'],
    ];
    
    for (const [res, label] of sources) {
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch data from Data Golf (${label}):`, res.status, errorText);
        throw new Error(`Failed to fetch data from Data Golf (${label}): ${res.status} ${errorText}`);
      }
      
      const data: DataGolfResponse = await res.json();
      console.log(`Data Golf API response (${label}) for event: ${data.event_name}`);
      
      // Fix: Only process if match_list is an array
      if (!Array.isArray(data.match_list)) {
        console.warn(`Data Golf API (${label}): match_list is not an array`, data.match_list);
        results.push({
          event: data.event_name,
          round: data.round_num,
          processedCount: 0,
          warning: typeof data.match_list === "string" ? data.match_list : "No matchups available"
        });
        continue; // Skip to next source
      }

      // HARD-CODED EVENT NAME MATCHING
      // This ensures specific named events are correctly matched regardless of name differences
      let event_id = null;
      
      // Explicit event matching for current known events
      const eventNameLower = data.event_name.toLowerCase();
      
      // Direct matches for PGA events with consistent names
      if (label === 'PGA') {
        if (eventNameLower.includes('truist')) {
          // Find Truist Championship
          const truist = tournaments?.find(t => 
            t.event_name.toLowerCase().includes('truist')
          );
          
          if (truist) {
            event_id = truist.event_id;
            console.log(`Explicitly matched PGA Truist event to "${truist.event_name}" (ID: ${event_id})`);
          }
        } else if (eventNameLower.includes('pga championship')) {
          // Find PGA Championship
          const pga = tournaments?.find(t => 
            t.event_name.toLowerCase().includes('pga championship')
          );
          
          if (pga) {
            event_id = pga.event_id;
            console.log(`Explicitly matched PGA Championship to "${pga.event_name}" (ID: ${event_id})`);
          }
        }
        // Add more specific main event matches as needed
      }
      
      // Direct matches for opposite field events
      else if (label === 'OPP') {
        if (eventNameLower.includes('myrtle beach')) {
          // Find Myrtle Beach tournament
          const myrtle = tournaments?.find(t => 
            t.event_name.toLowerCase().includes('myrtle')
          );
          
          if (myrtle) {
            event_id = myrtle.event_id;
            console.log(`Explicitly matched OPP Myrtle Beach event to "${myrtle.event_name}" (ID: ${event_id})`);
          }
        }
        // Add more specific opposite field event matches as needed
      }
      
      // If no explicit match was found, try the original exact name match
      if (!event_id) {
        event_id = eventNameToId.get(data.event_name);
      }
      
      // If still no match, try the weekly tournament logic
      if (!event_id && activeWeekTournaments.length > 0) {
        console.log(`No direct match for "${data.event_name}" (${label}), attempting weekly tournament matching...`);
        
        // If we have exactly 2 tournaments this week (most common case)
        if (activeWeekTournaments.length === 2) {
          // Sort by event_id - typically the main event has a lower ID
          const sortedByEventId = [...activeWeekTournaments].sort((a, b) => a.event_id - b.event_id);
          
          if (label === 'PGA') {
            // For PGA events, use the lower event_id (usually the main event)
            event_id = sortedByEventId[0].event_id;
            console.log(`Matched PGA event to main tournament: "${sortedByEventId[0].event_name}" (ID: ${event_id})`);
          } else if (label === 'OPP') {
            // For opposite field events, use the higher event_id
            event_id = sortedByEventId[1].event_id;
            console.log(`Matched OPP event to opposite field tournament: "${sortedByEventId[1].event_name}" (ID: ${event_id})`);
          }
        }
        // If we have just one tournament this week
        else if (activeWeekTournaments.length === 1) {
          event_id = activeWeekTournaments[0].event_id;
          console.log(`Only one tournament this week, using "${activeWeekTournaments[0].event_name}" (ID: ${event_id}) for ${label}`);
        }
      }
      
      // Last warning if no match found
      if (!event_id) {
        console.warn(`⚠️ No matching tournament found for "${data.event_name}" (${label})`);
        console.warn(`This week's tournaments: ${JSON.stringify(activeWeekTournaments.map(t => t.event_name))}`);
      }
      
      // Map matchups to the Supabase format
      const matchupsToInsert: (SupabaseMatchup & { event_id: number | null })[] = data.match_list.map((matchup) => {
        const fanduelOdds = matchup.odds.fanduel;
        const draftkingsOdds = matchup.odds.draftkings;
        return {
          event_id,
          event_name: data.event_name,
          round_num: data.round_num,
          data_golf_update_time: new Date(data.last_updated.replace(" UTC", "Z")).toISOString(),
          p1_dg_id: matchup.p1_dg_id,
          p1_player_name: matchup.p1_player_name,
          p2_dg_id: matchup.p2_dg_id,
          p2_player_name: matchup.p2_player_name,
          ties_rule: matchup.ties,
          fanduel_p1_odds: fanduelOdds?.p1 ?? null,
          fanduel_p2_odds: fanduelOdds?.p2 ?? null,
          draftkings_p1_odds: draftkingsOdds?.p1 ?? null,
          draftkings_p2_odds: draftkingsOdds?.p2 ?? null,
        };
      });
      
      // Deduplicate matchups by unique constraint
      const uniqueKey = (m: any) => `${m.event_id}-${m.event_name}-${m.round_num}-${m.p1_dg_id}-${m.p2_dg_id}`;
      const dedupedMatchups = Array.from(
        new Map(matchupsToInsert.map(m => [uniqueKey(m), m])).values()
      );
      
      if (dedupedMatchups.length > 0) {
        // Log what we're about to insert
        console.log(`Processing ${dedupedMatchups.length} matchups for ${label} event "${data.event_name}"`);
        if (event_id) {
          console.log(`Using event_id: ${event_id} for insertion`);
        } else {
          console.warn(`⚠️ No event_id found for "${data.event_name}" - matchups will have null event_id`);
        }
        
        // Only insert into historical table if Data Golf last_updated is newer
        if (!histLastUpdated || new Date(data.last_updated.replace(" UTC", "Z")) > histLastUpdated) {
          console.log(`Inserting ${dedupedMatchups.length} historical matchups for ${label}...`);
          const { error: insertError } = await supabase
            .from("two_ball_matchups")
            .insert(dedupedMatchups);
          if (insertError) {
            console.error(`Error inserting historical matchups into Supabase (${label}):`, insertError);
            throw new Error(`Supabase historical insert failed (${label}): ${insertError.message}`);
          }
          console.log(`✓ Historical insert successful for ${label}`);
        } else {
          console.log(`Historical odds not updated for ${label} (no new Data Golf update).`);
        }
        
        // Upsert into latest odds table
        console.log(`Upserting ${dedupedMatchups.length} latest matchups for ${label}...`);
        const { error: upsertError } = await supabase
          .from("latest_two_ball_matchups")
          .upsert(dedupedMatchups, {
            onConflict: 'event_id, event_name, round_num, p1_dg_id, p2_dg_id',
          });
        if (upsertError) {
          console.error(`Error upserting latest matchups into Supabase (${label}):`, upsertError);
          throw new Error(`Supabase latest upsert failed (${label}): ${upsertError.message}`);
        }
        
        console.log(`✓ Successfully upserted ${dedupedMatchups.length} latest matchups for ${label}.`);
        allInsertedMatchups.push(...dedupedMatchups);
      } else {
        console.log(`No matchups found in the fetched data to insert for ${label}.`);
      }
      
      results.push({
        event: data.event_name,
        round: data.round_num,
        processedCount: dedupedMatchups.length
      });
    }
    
    // Get all the latest matchups to return to the client
    const { data: allLatestMatchups, error: allMatchupsError } = await supabase
      .from("latest_two_ball_matchups")
      .select("*");

    if (allMatchupsError) {
      console.error("Error fetching all latest matchups:", allMatchupsError);
      return NextResponse.json({
        success: true,
        message: `Fetched and stored 2-ball matchups for ${results.length} event(s), but could not fetch them back.`,
        results
      });
    }

    // Group matchups by event to make the structure clearer
    const matchupsByEvent = {};
    (allLatestMatchups || []).forEach(m => {
      const eventId = m.event_id || 'unknown';
      if (!matchupsByEvent[eventId]) {
        matchupsByEvent[eventId] = {
          event_id: m.event_id,
          event_name: m.event_name,
          matchups: []
        };
      }
      matchupsByEvent[eventId].matchups.push(m);
    });
    
    return NextResponse.json({
      success: true,
      message: `Fetched and stored 2-ball matchups for ${results.length} event(s).`,
      results,
      events: Object.values(matchupsByEvent), 
      matchups: allLatestMatchups
    });
  } catch (error) {
    console.error("Error in GET /api/matchups/2ball:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

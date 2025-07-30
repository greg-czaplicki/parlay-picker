import type { Metadata } from "next"
import { createClient } from "@supabase/supabase-js"
import Dashboard from "@/components/dashboard"
import { PlayerSkillRating, LiveTournamentStat, PgaTourPlayerStats } from "@/types/definitions"

export const metadata: Metadata = {
  title: "Golf Parlay Picker - Matchups",
  description: "Analyze and pick golf matchups for parlays",
}

// Enable dynamic rendering and disable static generation for this page
// This ensures fresh data on each request in production
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Server-side Supabase Client
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseServerClient = createClient(supabaseUrl, supabaseKey)

// Fetch initial data on the server
async function getInitialPlayerData() {
  console.log("Fetching initial player data on server...")
  try {
    // Fetch Season Skills from DataGolf
    const { data: seasonSkills, error: skillError } = await supabaseServerClient
      .from("player_skill_ratings")
      .select("*")
      .order("sg_total", { ascending: false })

    if (skillError) throw new Error(`Skill fetch error: ${skillError.message}`)
    
    // Fetch PGA Tour stats - handle missing table gracefully
    let pgaTourStats: PgaTourPlayerStats[] = [];
    try {
      const { data, error } = await supabaseServerClient
        .from("player_season_stats")
        .select("*")
        .order("sg_total", { ascending: false });
        
      if (error) {
        // Check if the error is because the table doesn't exist
        if (error.message.includes("does not exist")) {
          console.warn("player_season_stats table does not exist yet. Using empty array for PGA Tour stats.");
        } else {
          console.error(`PGA Tour stats fetch error: ${error.message}`);
        }
      } else {
        pgaTourStats = data || [];
      }
    } catch (error) {
      console.warn("Error fetching PGA Tour stats:", error);
      // Continue with empty array
    }

    // Fetch Latest Event Avg Live Stats
    // 1. Get latest event name
    let latestEventName: string | null = null
    const { data: latestEventData, error: eventError } = await supabaseServerClient
      .from('live_tournament_stats')
      .select('event_name')
      .order('data_golf_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle() // Use maybeSingle to avoid error if view is empty

    if (eventError) console.warn(`Could not get latest event name: ${eventError.message}`)
    if (latestEventData) latestEventName = latestEventData.event_name

    // 2. Fetch event_avg stats for that event
    let liveStats: LiveTournamentStat[] = []
    if (latestEventName) {
      const { data: liveData, error: liveError } = await supabaseServerClient
        .from("live_tournament_stats")
        .select("*")
        .eq('event_name', latestEventName)
        .eq('round_num', 'event_avg') // Fetch default view
        .order("total", { ascending: true })
      if (liveError) throw new Error(`Live stats fetch error: ${liveError.message}`)
      liveStats = liveData || []
    } else {
      console.log("No latest event found, initial live stats will be empty.")
    }

    console.log(`Server fetch complete: ${seasonSkills?.length ?? 0} skills, ${pgaTourStats?.length ?? 0} PGA Tour stats, ${liveStats.length} live.`)
    return { 
      initialSeasonSkills: seasonSkills || [], 
      initialPgaTourStats: pgaTourStats || [],
      initialLiveStats: liveStats 
    }

  } catch (error) {
    console.error("Server-side data fetch failed:", error)
    // Return empty arrays on error so the page can still render
    return { 
      initialSeasonSkills: [], 
      initialPgaTourStats: [],
      initialLiveStats: [] 
    }
  }
}

// Function to refresh matchups data on page load
async function refreshMatchupsOnLoad() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    console.log('🔄 Auto-refreshing matchups on page load...');
    
    // Call the refresh endpoint to get fresh data with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${baseUrl}/api/matchups/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Auto-refresh completed: ${result.totalInserted || 0} matchups updated`);
    } else {
      console.warn(`⚠️ Auto-refresh failed: ${response.statusText} - using existing data`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('⚠️ Auto-refresh timed out - using existing data');
    } else {
      console.warn('⚠️ Auto-refresh error (using existing data):', error);
    }
  }
}

export default async function MatchupsPage() {
  // Fetch data on the server before rendering
  const { initialSeasonSkills, initialPgaTourStats, initialLiveStats } = await getInitialPlayerData()
  
  // Auto-refresh matchups data (don't await to avoid blocking page load)
  refreshMatchupsOnLoad().catch(err => console.warn('Background refresh failed:', err));

  return (
    <main>
      <Dashboard
        initialSeasonSkills={initialSeasonSkills}
        initialPgaTourStats={initialPgaTourStats}
        initialLiveStats={initialLiveStats}
        defaultTab="matchups"
      />
    </main>
  )
}
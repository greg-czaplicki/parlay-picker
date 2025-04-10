import type { Metadata } from "next"
import Dashboard from "@/components/dashboard"
import { createClient } from "@supabase/supabase-js"
import { PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"

export const metadata: Metadata = {
  title: "Golf Parlay Picker Dashboard",
  description: "Analyze and pick 3-ball matchups for golf parlays",
}

// Server-side Supabase Client (uses Service Role Key)
// Ensure these are set in your server environment!
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseServerClient = createClient(supabaseUrl, supabaseKey)

// Fetch initial data on the server
async function getInitialPlayerData() {
  console.log("Fetching initial player data on server...")
  try {
    // Fetch Season Skills
    const { data: seasonSkills, error: skillError } = await supabaseServerClient
      .from("player_skill_ratings")
      .select("*")
      .order("sg_total", { ascending: false })

    if (skillError) throw new Error(`Skill fetch error: ${skillError.message}`)

    // Fetch Latest Event Avg Live Stats
    // 1. Get latest event name
    let latestEventName: string | null = null
    const { data: latestEventData, error: eventError } = await supabaseServerClient
      .from('latest_live_tournament_stats_view')
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
        .from("latest_live_tournament_stats_view")
        .select("*")
        .eq('event_name', latestEventName)
        .eq('round_num', 'event_avg') // Fetch default view
        .order("total", { ascending: true })
      if (liveError) throw new Error(`Live stats fetch error: ${liveError.message}`)
      liveStats = liveData || []
    } else {
      console.log("No latest event found, initial live stats will be empty.")
    }

    console.log(`Server fetch complete: ${seasonSkills?.length ?? 0} skills, ${liveStats.length} live.`)
    return { initialSeasonSkills: seasonSkills || [], initialLiveStats: liveStats }

  } catch (error) {
    console.error("Server-side data fetch failed:", error)
    // Return empty arrays on error so the page can still render
    return { initialSeasonSkills: [], initialLiveStats: [] }
  }
}

export default async function Home() {
  // Fetch data on the server before rendering
  const { initialSeasonSkills, initialLiveStats } = await getInitialPlayerData()

  return (
    <main className="min-h-screen bg-[#121212]">
      {/* Pass initial data down to Dashboard */}
      <Dashboard
        initialSeasonSkills={initialSeasonSkills}
        initialLiveStats={initialLiveStats}
      />
    </main>
  )
}

"use client"

// TODO: Move live stats caching to the backend for global (multi-user) support. Current localStorage cache is per-browser only.

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@supabase/supabase-js"
import { toast } from "@/components/ui/use-toast"
import type { PlayerSkillRating, LiveTournamentStat, DisplayPlayer, TrendIndicator } from "@/types/definitions"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase URL or Anon Key is missing in client-side environment variables.",
  )
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

const LIVE_STATS_CACHE_KEY = 'gpp_live_stats_cache_v2'; // Updated to v2 to avoid conflicts
const LIVE_STATS_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in ms
const AUTO_REFRESH_INTERVAL = 15 * 60 * 1000; // Auto-refresh every 15 minutes

// Updated cache format to support both PGA and OPP tours
function getCachedLiveStats(roundFilter: string, tour: 'pga' | 'opp' = 'pga') {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LIVE_STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed[tour] || !parsed[tour][roundFilter]) return null;
    const { data, timestamp } = parsed[tour][roundFilter];
    if (Date.now() - timestamp > LIVE_STATS_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedLiveStats(roundFilter: string, data: any, tour: 'pga' | 'opp' = 'pga') {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LIVE_STATS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed[tour]) parsed[tour] = {};
    parsed[tour][roundFilter] = { data, timestamp: Date.now() };
    localStorage.setItem(LIVE_STATS_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

interface UsePlayerDataProps {
  initialSeasonSkills: PlayerSkillRating[]
  initialLiveStats: LiveTournamentStat[]
  initialPgaTourStats?: PgaTourPlayerStats[]
  dataView: "season" | "tournament"
  dataSource?: "data_golf" | "pga_tour" // Default to data_golf for backward compatibility
  roundFilter: string
  selectedEventId?: number | null
  eventOptions?: Array<{ event_id: number, event_name: string }>
}

// Helper function for Trend Indicator
function getTrendIndicator(diff: number | null): TrendIndicator {
  if (diff === null || Math.abs(diff) < 0.1) {
    return null;
  }

  const roundedDiff = diff.toFixed(2);
  if (diff > 0) {
    const isLargeDiff = diff >= 0.5;
    return {
      type: "up",
      className: isLargeDiff ? "text-green-400" : "text-emerald-500",
      title: `Performing +${roundedDiff} strokes better than season average`
    };
  } else {
    const isLargeDiff = Math.abs(diff) >= 0.5;
    return {
      type: "down",
      className: isLargeDiff ? "text-red-500" : "text-orange-500",
      title: `Performing ${roundedDiff} strokes worse than season average`
    };
  }
}

export function usePlayerData({
  initialSeasonSkills,
  initialLiveStats,
  initialPgaTourStats = [],
  dataView,
  dataSource = "data_golf", // Default to data_golf for backward compatibility
  roundFilter,
  selectedEventId,
  eventOptions = []
}: UsePlayerDataProps) {
  const [sorting, setSorting] = useState<any>([])
  const [seasonSkills, setSeasonSkills] = useState<PlayerSkillRating[]>(initialSeasonSkills)
  const [pgaTourStats, setPgaTourStats] = useState<PgaTourPlayerStats[]>(initialPgaTourStats)
  const [liveStats, setLiveStats] = useState<LiveTournamentStat[]>(initialLiveStats)
  const [loadingSeason, setLoadingSeason] = useState(initialSeasonSkills.length === 0)
  // Initialize loadingPgaTour to false even if no data to avoid getting stuck in loading state
  const [loadingPgaTour, setLoadingPgaTour] = useState(false)
  const [loadingLive, setLoadingLive] = useState(initialLiveStats.length === 0)
  const [isSyncingSkills, setIsSyncingSkills] = useState(false)
  const [isSyncingPgaTour, setIsSyncingPgaTour] = useState(false)
  const [isSyncingLive, setIsSyncingLive] = useState(false)
  const [seasonSkillsMap, setSeasonSkillsMap] = useState<Map<number, PlayerSkillRating>>(() => {
    const map = new Map<number, PlayerSkillRating>()
    initialSeasonSkills.forEach(skill => map.set(skill.dg_id, skill))
    return map
  })
  const [pgaTourStatsMap, setPgaTourStatsMap] = useState<Map<string, PgaTourPlayerStats>>(() => {
    const map = new Map<string, PgaTourPlayerStats>()
    initialPgaTourStats?.forEach(stat => map.set(stat.pga_player_id, stat))
    return map
  })
  const [lastSkillUpdate, setLastSkillUpdate] = useState<string | null>(() => 
    initialSeasonSkills.length > 0 ? initialSeasonSkills[0].data_golf_updated_at : null
  )
  const [lastPgaTourUpdate, setLastPgaTourUpdate] = useState<string | null>(() => 
    initialPgaTourStats?.length > 0 ? initialPgaTourStats[0].source_updated_at : null
  )
  const [lastLiveUpdate, setLastLiveUpdate] = useState<string | null>(() => 
    initialLiveStats.length > 0 ? initialLiveStats[0].data_golf_updated_at : null
  )
  const [currentLiveEvent, setCurrentLiveEvent] = useState<string | null>(() => 
    initialLiveStats.length > 0 ? initialLiveStats[0].event_name : null
  )
  const [fieldDgIds, setFieldDgIds] = useState<number[] | null>(null)
  const [fieldLoading, setFieldLoading] = useState(false)
  const lastFieldEventId = useRef<number | null>(null)

  // Define fetch functions first to avoid reference errors

  const fetchPgaTourStats = async () => {
    setLoadingPgaTour(true)
    try {
      const { data, error } = await supabase
        .from("player_season_stats")
        .select("*")
        .order("sg_total", { ascending: false })

      if (error) {
        // If the table doesn't exist yet, this is expected on first run
        if (error.message && error.message.includes('does not exist')) {
          console.warn("player_season_stats table doesn't exist yet. Run the Sync PGA Stats function to set it up.");
          
          // Don't show an error toast for this expected condition
          setPgaTourStats([]);
          setLastPgaTourUpdate(null);
          
          // Suggest running the sync function
          toast({
            title: "PGA Tour Stats Not Set Up Yet",
            description: "Click 'Sync PGA Stats' to set up the database and fetch data.",
            duration: 5000,
          });
        } else {
          // For other errors, show the error toast
          throw error;
        }
      } else {
        const fetchedStats = data || []
        setPgaTourStats(fetchedStats)
        
        const map = new Map<string, PgaTourPlayerStats>()
        fetchedStats.forEach(stat => map.set(stat.pga_player_id, stat))
        setPgaTourStatsMap(map)
  
        if (data && data.length > 0) {
          setLastPgaTourUpdate(data[0].source_updated_at)
        } else {
          setLastPgaTourUpdate(null)
        }
      }
    } catch (error) {
      console.error("Error fetching PGA Tour stats:", error)
      toast({ 
        title: "Error Fetching PGA Tour Stats", 
        variant: "destructive" 
      })
      setPgaTourStats([])
      setLastPgaTourUpdate(null)
    } finally {
      setLoadingPgaTour(false)
    }
  }

  const fetchSeasonSkills = async () => {
    setLoadingSeason(true)
    try {
      const { data, error } = await supabase
        .from("player_skill_ratings")
        .select("*")
        .order("sg_total", { ascending: false })

      if (error) throw error
      
      const fetchedSkills = data || []
      setSeasonSkills(fetchedSkills)
      
      const map = new Map<number, PlayerSkillRating>()
      fetchedSkills.forEach(skill => map.set(skill.dg_id, skill))
      setSeasonSkillsMap(map)

      if (data && data.length > 0) {
        setLastSkillUpdate(data[0].data_golf_updated_at)
      } else {
        setLastSkillUpdate(null)
      }
    } catch (error) {
      console.error("Error fetching season skills:", error)
      toast({ 
        title: "Error Fetching Season Skills", 
        variant: "destructive" 
      })
      setSeasonSkills([])
      setLastSkillUpdate(null)
    } finally {
      setLoadingSeason(false)
    }
  }

  // Auto-fetch PGA Tour stats if none are available 
  // - When PGA Tour data source is selected in season view
  // - When in tournament view (for trends)
  useEffect(() => {
    const needsPgaTourStats = 
      // Season view with PGA Tour source selected
      (dataView === 'season' && dataSource === 'pga_tour') || 
      // Tournament view (always needs PGA Tour stats for trends now)
      dataView === 'tournament';
      
    if (needsPgaTourStats && pgaTourStats.length === 0 && !loadingPgaTour && !isSyncingPgaTour) {
      console.log('[PlayerData] No PGA Tour stats available, fetching automatically');
      fetchPgaTourStats();
    }
  }, [dataView, dataSource, pgaTourStats.length, loadingPgaTour, isSyncingPgaTour]);

  // Fetch field for selected event if in season view (for both data sources)
  useEffect(() => {
    async function fetchFieldForEvent() {
      // Only fetch field data if we're in season view and have a selected event
      // We now need field filtering for both data sources
      if (dataView !== "season" || !selectedEventId) {
        setFieldLoading(false);
        return;
      }
      
      setFieldLoading(true)
      try {
        // 1. Get event info for debug
        const { data: eventData, error: eventError } = await supabase
          .from("tournaments")
          .select("event_id, event_name, start_date")
          .eq("event_id", selectedEventId)
          .limit(1)
        if (eventError || !eventData || eventData.length === 0) {
          setFieldDgIds(null)
          setFieldLoading(false)
          return
        }
        const event = eventData[0]
        console.log('[PlayerData] Selected event:', event)
        if (lastFieldEventId.current === event.event_id) {
          setFieldLoading(false)
          return // already loaded
        }
        lastFieldEventId.current = event.event_id
        // 2. Get field for that event
        const { data: fieldData, error: fieldError } = await supabase
          .from("player_field")
          .select("dg_id")
          .eq("event_id", event.event_id)
        if (fieldError || !fieldData) {
          setFieldDgIds(null)
        } else {
          setFieldDgIds(fieldData.map(f => f.dg_id))
          console.log('[PlayerData] Field dg_ids:', fieldData.map(f => f.dg_id))
        }
      } catch (e) {
        setFieldDgIds(null)
      } finally {
        setFieldLoading(false)
      }
    }
    fetchFieldForEvent()
  }, [dataView, dataSource, selectedEventId])

  // Auto-fetch live stats for both PGA and Opposite Field events
  useEffect(() => {
    let didCancel = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    async function fetchAndDetectTour() {
      if (didCancel) return;
      if (dataView !== 'tournament') return;
      
      console.log('[PlayerData] Auto-detecting which tour to fetch based on selected event');
      
      // For initial auto-fetch, we need to detect which tour to use
      // We'll first try PGA tour since it's more common
      try {
        await fetchLiveStats('pga');
        
        // If we got no data for PGA, try Opposite Field
        if (liveStats.length === 0) {
          console.log('[PlayerData] No PGA Tour data found, trying Opposite Field...');
          await fetchLiveStats('opp');
        }
      } catch (error) {
        console.error('[PlayerData] Error during auto-tour detection:', error);
      }
      
      // Set up auto-refresh timer
      if (!didCancel) {
        refreshTimer = setTimeout(() => {
          if (!didCancel) {
            console.log('[PlayerData] Auto-refreshing live stats...');
            fetchAndDetectTour();
          }
        }, AUTO_REFRESH_INTERVAL);
      }
    }
    
    fetchAndDetectTour();
    
    return () => { 
      didCancel = true; 
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [roundFilter, dataView, selectedEventId, eventOptions]);

  // fetchSeasonSkills and fetchPgaTourStats are now defined at the top of the hook

  // Enhanced fetchLiveStats function that supports both PGA and OPP tours
  const fetchLiveStats = async (tour: 'pga' | 'opp' = 'pga') => {
    setLoadingLive(true);
    
    // First check if we have cached data
    const cached = getCachedLiveStats(roundFilter, tour);
    if (cached) {
      console.log(`[PlayerData] Using cached ${tour} tour data for round ${roundFilter}`);
      setLiveStats(cached);
      if (cached.length > 0) {
        const latestRecord = cached.reduce((latest, current) =>
          new Date(current.data_golf_updated_at ?? 0) > new Date(latest.data_golf_updated_at ?? 0) ? current : latest
        );
        setLastLiveUpdate(latestRecord.data_golf_updated_at);
        setCurrentLiveEvent(latestRecord.event_name);
      }
      setLoadingLive(false);
      return;
    }
    
    // If no cache, fetch from API
    try {
      console.log(`[PlayerData] Fetching fresh ${tour} tour data for round ${roundFilter}`);
      
      // Try to get data from database first
      let query = supabase
        .from("latest_live_tournament_stats_view")
        .select("*");
        
      // Filter by round
      if (roundFilter !== "latest") {
        query = query.eq('round_num', roundFilter);
      }

      // Filter by selected event if available
      if (selectedEventId) {
        // Get event name from current options
        const selectedEvent = eventOptions.find(e => e.event_id === selectedEventId);
        if (selectedEvent) {
          query = query.eq('event_name', selectedEvent.event_name);
          console.log(`Filtering live stats by event: ${selectedEvent.event_name}`);
        }
      }
        
      query = query.order("total", { ascending: true });
      const { data, error } = await query;
      
      if (error) throw error;
      
      // If we have data, use it
      if (data && data.length > 0) {
        setLiveStats(data);
        setCachedLiveStats(roundFilter, data, tour);
        
        const latestRecord = data.reduce((latest, current) =>
          new Date(current.data_golf_updated_at ?? 0) > new Date(latest.data_golf_updated_at ?? 0) ? current : latest
        );
        setLastLiveUpdate(latestRecord.data_golf_updated_at);
        setCurrentLiveEvent(latestRecord.event_name);
      } else {
        // If no data in database, try to fetch it from DataGolf API
        console.log(`[PlayerData] No data in database for ${tour}, fetching from API...`);
        
        // Don't await this - it will update the database and we'll get it next time
        fetch(`/api/live-stats/sync-tour?tour=${tour}`)
          .then(res => {
            if (!res.ok) {
              throw new Error(`API responded with status: ${res.status}`);
            }
            return res.json();
          })
          .then(apiData => {
            if (apiData.success) {
              console.log(`[PlayerData] Successfully fetched ${tour} data, will be available on next load`);
            }
          })
          .catch(apiError => {
            console.error(`[PlayerData] Failed to fetch ${tour} data:`, apiError);
          });
          
        setLiveStats([]);
        setLastLiveUpdate(null);
        setCurrentLiveEvent(null);
      }
    } catch (error) {
      console.error(`Error fetching ${tour} live stats:`, error);
      toast({ 
        title: `Error Fetching ${tour.toUpperCase()} Live Stats`, 
        variant: "destructive" 
      });
      setLiveStats([]);
      setLastLiveUpdate(null);
      setCurrentLiveEvent(null);
    } finally {
      setLoadingLive(false);
    }
  };

  const triggerSkillSyncAndRefetch = async () => {
    setIsSyncingSkills(true)
    setLastSkillUpdate(null)
    try {
      const response = await fetch("/api/players/sync-skill-ratings")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }))
        throw new Error(errorData.error || `Server responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        toast({
          title: "Season Data Updated",
          description: `Latest player skill ratings refreshed`,
        })
        await fetchSeasonSkills()
      } else {
        throw new Error(data.error || "Unknown error occurred during sync")
      }
    } catch (error) {
      console.error("Error syncing player ratings via API:", error)
      toast({
        title: "Error Syncing Skills",
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      })
    } finally {
      setIsSyncingSkills(false)
    }
  }
  
  const triggerPgaTourSyncAndRefetch = async () => {
    setIsSyncingPgaTour(true)
    setLastPgaTourUpdate(null)
    try {
      // Skip the check for now - the API will handle this check
      
      try {
        console.log("Calling PGA stats sync API...");
        // Make the API call with explicit content-type and cache settings
        const response = await fetch("/api/players/sync-pga-stats", {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          cache: 'no-store'
        });
        
        console.log("API response status:", response.status);
        
        // Get the raw text first for debugging
        const rawText = await response.text();
        console.log("API raw response:", rawText);
        
        // Now parse the JSON
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError);
          throw new Error("Failed to parse response from server.");
        }
        
        if (data.success) {
          toast({
            title: "PGA Tour Data Updated",
            description: `Latest player stats from PGA Tour refreshed`,
          });
          await fetchPgaTourStats();
        } else {
          throw new Error(data.error || "Unknown error occurred during sync");
        }
      } catch (apiError) {
        console.error("API call error:", apiError);
        throw apiError; // Re-throw to be caught by the outer catch
      }
    } catch (error) {
      console.error("Error syncing PGA Tour stats via API:", error)
      
      // More helpful error message for setup issues
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to connect to the server";
        
      toast({
        title: "Error Syncing PGA Tour Stats",
        description: errorMessage,
        variant: "destructive",
      })
      
      // If this is a setup issue, show a more helpful toast
      if (errorMessage.includes("Database setup required")) {
        toast({
          title: "Database Setup Required",
          description: "The required tables don't exist in your database. Check the SETUP.md file for instructions.",
          variant: "destructive",
          duration: 10000, // Show for longer
        })
      }
    } finally {
      setIsSyncingPgaTour(false)
    }
  }

  const triggerLiveSyncAndRefetch = async (tour: 'pga' | 'opp' | 'euro' = 'pga') => {
    setIsSyncingLive(true)
    setLastLiveUpdate(null)
    try {
      // Use the new API endpoint that supports tour parameter
      const response = await fetch(`/api/live-stats/sync-tour?tour=${tour}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }))
        throw new Error(errorData.error || `Server responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        toast({
          title: `${tour.toUpperCase()} Tournament Data Updated`,
          description: `Latest stats refreshed for ${data.eventName}`,
        })
        // Clear the local storage cache
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(LIVE_STATS_CACHE_KEY);
          } catch {}
        }
        await fetchLiveStats()
      } else {
        throw new Error(data.error || "Unknown error occurred during sync")
      }
    } catch (error) {
      console.error(`Error syncing ${tour} live stats via API:`, error)
      toast({
        title: `Error Syncing ${tour.toUpperCase()} Live Stats`,
        description: error instanceof Error ? error.message : "Failed to connect to the server",
        variant: "destructive",
      })
    } finally {
      setIsSyncingLive(false)
    }
  }

  // Combine/Select data AND pre-calculate trends
  const displayPlayers: DisplayPlayer[] = useMemo(() => {
    if (dataView === "season") {
      // For season view, we use either PGA Tour stats or DataGolf stats based on dataSource
      if (dataSource === "pga_tour") {
        // Use PGA Tour stats as the source
        // Apply tournament filtering if we have a selected event and fieldDgIds
        if (selectedEventId && fieldDgIds && fieldDgIds.length > 0) {
          return pgaTourStats
            .filter(p => p.dg_id && fieldDgIds.includes(p.dg_id))
            .map(player => ({
              ...player,
              // Map property names correctly (some differ between DataGolf and PGA Tour)
              driving_acc: player.driving_accuracy,
              driving_dist: player.driving_distance,
              data_source: 'pga_tour'
            }));
        } else {
          // If no event selected or no field data, return all players (old behavior)
          return pgaTourStats.map(player => ({
            ...player,
            driving_acc: player.driving_accuracy,
            driving_dist: player.driving_distance,
            data_source: 'pga_tour'
          }));
        }
      } else {
        // Use DataGolf stats as the source with field filtering
        if (fieldDgIds && fieldDgIds.length > 0) {
          return seasonSkills
            .filter(p => fieldDgIds.includes(p.dg_id))
            .map(player => ({
              ...player,
              data_source: 'data_golf'
            }));
        }
        return [];
      }
    } else {
      // Tournament view for current rounds
      let targetRound = roundFilter
      if (targetRound === 'latest') {
        targetRound = 'event_avg'
      }
      const filteredLiveStats = liveStats.filter(p => p.round_num === targetRound)

      // Use PGA Tour stats for trends in tournament view
      return filteredLiveStats.map(livePlayer => {
        const trends: Record<string, ReturnType<typeof getTrendIndicator>> = {};
        
        // Find corresponding PGA Tour stats by dg_id
        // First check if we have a direct match by dg_id
        let pgaPlayerStats: PgaTourPlayerStats | undefined = undefined;
        
        if (livePlayer.dg_id) {
          // Find the PGA Tour stats for this player by dg_id
          pgaPlayerStats = pgaTourStats.find(p => p.dg_id === livePlayer.dg_id);
          
          // If we didn't find by dg_id, try to match by name
          if (!pgaPlayerStats) {
            // Try exact name match (less reliable but a fallback)
            pgaPlayerStats = pgaTourStats.find(p => 
              p.player_name.toLowerCase() === livePlayer.player_name.toLowerCase()
            );
          }
        }
        
        if (pgaPlayerStats) {
          // Calculate trends against PGA Tour stats
          const sgKeys: (keyof PgaTourPlayerStats & keyof LiveTournamentStat)[] = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_total'];
          
          sgKeys.forEach(key => {
            const liveValue = livePlayer[key];
            const seasonValue = pgaPlayerStats![key];
              
            const diff = (typeof liveValue === 'number' && typeof seasonValue === 'number') 
              ? liveValue - seasonValue 
              : null;
              
            trends[key] = getTrendIndicator(diff);
          });

          // Calculate T2G trend separately
          const liveT2G = livePlayer.sg_t2g;
          const seasonOtt = pgaPlayerStats.sg_ott;
          const seasonApp = pgaPlayerStats.sg_app;
            
          const seasonT2G = (typeof seasonOtt === 'number' && typeof seasonApp === 'number') 
            ? seasonOtt + seasonApp 
            : null;
            
          const diffT2G = (typeof liveT2G === 'number' && typeof seasonT2G === 'number') 
            ? liveT2G - seasonT2G 
            : null;
            
          trends['sg_t2g'] = getTrendIndicator(diffT2G);
        }
        
        return { ...livePlayer, trends, data_source: 'pga_tour' };
      });
    }
  }, [dataView, dataSource, seasonSkills, liveStats, pgaTourStats, roundFilter, fieldDgIds])

  // Calculate percentiles dynamically based on the current view
  const statPercentiles = useMemo(() => {
    const playersToAnalyze = displayPlayers
    if (playersToAnalyze.length === 0) return {}

    const calculatePercentiles = (values: (number | null)[]) => {
      const validValues = values.filter(v => v !== null) as number[]
      if (validValues.length === 0) return new Map<number, number>()
      
      // Round values to 2 decimal places for consistent comparison
      const roundedValues = validValues.map(v => Math.round(v * 100) / 100)
      
      const sortedValues = [...roundedValues].sort((a, b) => a - b)
      const percentileMap = new Map<number, number>()
      
      sortedValues.forEach((value, index) => {
        if (!percentileMap.has(value)) {
          percentileMap.set(value, index / sortedValues.length)
        }
      })
      return percentileMap
    }

    if (dataView === "season") {
      const skills = playersToAnalyze as PlayerSkillRating[]
      const seasonT2GValues = skills.map(p => 
        (typeof p.sg_ott === 'number' && typeof p.sg_app === 'number') 
        ? p.sg_ott + p.sg_app 
        : null
      )
      return {
        sg_total: calculatePercentiles(skills.map(p => p.sg_total)),
        sg_ott: calculatePercentiles(skills.map(p => p.sg_ott)),
        sg_app: calculatePercentiles(skills.map(p => p.sg_app)),
        sg_arg: calculatePercentiles(skills.map(p => p.sg_arg)),
        sg_putt: calculatePercentiles(skills.map(p => p.sg_putt)),
        sg_t2g: calculatePercentiles(seasonT2GValues),
        driving_acc: calculatePercentiles(skills.map(p => p.driving_acc)),
        driving_dist: calculatePercentiles(skills.map(p => p.driving_dist)),
      }
    } else {
      const live = playersToAnalyze as LiveTournamentStat[]
      return {
        sg_ott: calculatePercentiles(live.map(p => p.sg_ott)),
        sg_app: calculatePercentiles(live.map(p => p.sg_app)),
        sg_putt: calculatePercentiles(live.map(p => p.sg_putt)),
        sg_arg: calculatePercentiles(live.map(p => p.sg_arg)),
        sg_t2g: calculatePercentiles(live.map(p => p.sg_t2g)),
        sg_total: calculatePercentiles(live.map(p => p.sg_total)),
      }
    }
  }, [dataView, displayPlayers])

  const getHeatmapColor = (value: number | null, statKey: string, isHigherBetter = true) => {
    if (value === null) return "text-gray-500"
    
    // Adjust the value if it's a stat where lower is better
    const adjustedValue = isHigherBetter ? value : -value
    
    // Use different thresholds based on dataView (season vs tournament)
    // Season stats tend to be more tightly clustered, so we need tighter thresholds
    if (dataView === "season") {
      // More sensitive thresholds for season-long stats
      if (adjustedValue >= 1.2) {
        return "heatmap-exceptional"
      } 
      else if (adjustedValue >= 0.9) {
        return "heatmap-excellent"
      }
      else if (adjustedValue >= 0.6) {
        return "heatmap-very-good"
      }
      else if (adjustedValue >= 0.3) {
        return "heatmap-good"
      }
      else if (adjustedValue >= 0.1) {
        return "heatmap-above-average"
      }
      else if (adjustedValue >= 0.0) {
        return "heatmap-slightly-good"
      }
      else if (adjustedValue >= -0.1) {
        return "heatmap-neutral"
      }
      else if (adjustedValue >= -0.3) {
        return "heatmap-slightly-poor"
      }
      else if (adjustedValue >= -0.6) {
        return "heatmap-poor"
      }
      else if (adjustedValue >= -0.9) {
        return "heatmap-very-poor"
      }
      else {
        return "heatmap-terrible"
      }
    } else {
      // Original thresholds for tournament stats, where the spread is wider
      if (adjustedValue >= 3.0) {
        // Exceptional - very dark green (top performers)
        return "heatmap-exceptional"
      } 
      else if (adjustedValue >= 2.0) {
        // Excellent - dark green
        return "heatmap-excellent"
      }
      else if (adjustedValue >= 1.25) {
        // Very good - medium-dark green
        return "heatmap-very-good"
      }
      else if (adjustedValue >= 0.8) {
        // Good - medium green
        return "heatmap-good"
      }
      else if (adjustedValue >= 0.4) {
        // Above average - light-medium green
        return "heatmap-above-average"
      }
      else if (adjustedValue >= 0.0) {
        // Slightly above average - light green
        return "heatmap-slightly-good"
      }
      else if (adjustedValue >= -0.4) {
        // Slightly below average - pale yellow
        return "heatmap-neutral"
      }
      else if (adjustedValue >= -0.8) {
        // Below average - light orange/red
        return "heatmap-slightly-poor"
      }
      else if (adjustedValue >= -1.5) {
        // Poor - medium red
        return "heatmap-poor"
      }
      else if (adjustedValue >= -2.5) {
        // Very poor - dark red
        return "heatmap-very-poor"
      }
      else {
        // Terrible - very dark red
        return "heatmap-terrible"
      }
    }
  }

  const loading = (dataView === 'season' && fieldLoading) || 
    (dataSource === 'data_golf' ? loadingSeason : loadingPgaTour) || 
    loadingLive

  // For the UI, use the appropriate update timestamp based on data source
  const displayedSkillsTimestamp = dataSource === 'pga_tour' ? lastPgaTourUpdate : lastSkillUpdate

  return {
    sorting,
    setSorting,
    displayPlayers,
    loading,
    loadingSeason,
    loadingPgaTour,
    loadingLive,
    isSyncingSkills,
    isSyncingPgaTour,
    isSyncingLive,
    lastSkillUpdate,
    lastPgaTourUpdate,
    lastLiveUpdate,
    displayedSkillsTimestamp, // For UI convenience
    currentLiveEvent,
    dataSource,
    getHeatmapColor,
    triggerSkillSyncAndRefetch,
    triggerPgaTourSyncAndRefetch,
    triggerLiveSyncAndRefetch,
    fetchSeasonSkills,
    fetchPgaTourStats,
    fetchLiveStats
  }
}

export function useTournamentSchedule() {
  const [schedule, setSchedule] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchSchedule() {
      setLoading(true);
      setError(null);
      try {
        // Cache for 30 days (in-memory, per session)
        const cacheKey = "gpp_tournament_schedule_cache";
        const cacheExpiryKey = "gpp_tournament_schedule_cache_expiry";
        const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;
        const expiry = typeof window !== 'undefined' ? localStorage.getItem(cacheExpiryKey) : null;
        const now = Date.now();
        if (cached && expiry && now < Number(expiry)) {
          setSchedule(JSON.parse(cached));
          setLoading(false);
          return;
        }
        const res = await fetch("/api/schedule/sync");
        const data = await res.json();
        if (data.success && data.processedCount > 0) {
          setSchedule(data);
          if (typeof window !== 'undefined') {
            localStorage.setItem(cacheKey, JSON.stringify(data));
            localStorage.setItem(cacheExpiryKey, String(now + 30 * 24 * 60 * 60 * 1000)); // 30 days
          }
        } else {
          setError(data.error || "Failed to fetch schedule");
        }
      } catch (e: any) {
        setError(e.message || "Unknown error fetching schedule");
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
    return () => { ignore = true; };
  }, []);

  return { schedule, loading, error };
}
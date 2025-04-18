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

const LIVE_STATS_CACHE_KEY = 'gpp_live_stats_cache_v1';
const LIVE_STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

function getCachedLiveStats(roundFilter: string) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LIVE_STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed[roundFilter]) return null;
    const { data, timestamp } = parsed[roundFilter];
    if (Date.now() - timestamp > LIVE_STATS_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedLiveStats(roundFilter: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(LIVE_STATS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[roundFilter] = { data, timestamp: Date.now() };
    localStorage.setItem(LIVE_STATS_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

interface UsePlayerDataProps {
  initialSeasonSkills: PlayerSkillRating[]
  initialLiveStats: LiveTournamentStat[]
  dataView: "season" | "tournament"
  roundFilter: string
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
  dataView,
  roundFilter,
  selectedEventId
}: UsePlayerDataProps & { selectedEventId?: number | null }) {
  const [sorting, setSorting] = useState<any>([])
  const [seasonSkills, setSeasonSkills] = useState<PlayerSkillRating[]>(initialSeasonSkills)
  const [liveStats, setLiveStats] = useState<LiveTournamentStat[]>(initialLiveStats)
  const [loadingSeason, setLoadingSeason] = useState(initialSeasonSkills.length === 0)
  const [loadingLive, setLoadingLive] = useState(initialLiveStats.length === 0)
  const [isSyncingSkills, setIsSyncingSkills] = useState(false)
  const [isSyncingLive, setIsSyncingLive] = useState(false)
  const [seasonSkillsMap, setSeasonSkillsMap] = useState<Map<number, PlayerSkillRating>>(() => {
    const map = new Map<number, PlayerSkillRating>()
    initialSeasonSkills.forEach(skill => map.set(skill.dg_id, skill))
    return map
  })
  const [lastSkillUpdate, setLastSkillUpdate] = useState<string | null>(() => 
    initialSeasonSkills.length > 0 ? initialSeasonSkills[0].data_golf_updated_at : null
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

  // Fetch field for selected event if in season view
  useEffect(() => {
    async function fetchFieldForEvent() {
      if (dataView !== "season" || !selectedEventId) return;
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
        // Debug: print all player_skill_ratings dg_ids
        const { data: allSkills } = await supabase
          .from("player_skill_ratings")
          .select("dg_id")
        if (allSkills) {
          console.log('[PlayerData] player_skill_ratings dg_ids:', allSkills.map(s => s.dg_id))
        }
      } catch (e) {
        setFieldDgIds(null)
      } finally {
        setFieldLoading(false)
      }
    }
    fetchFieldForEvent()
  }, [dataView, selectedEventId])

  // Re-fetch live stats when round filter changes or on mount
  useEffect(() => {
    let didCancel = false;
    async function maybeFetchLiveStats() {
      // Only cache for tournament view
      if (dataView !== 'tournament') return;
      // Try cache first
      const cached = getCachedLiveStats(roundFilter);
      if (cached) {
        setLiveStats(cached);
        setLoadingLive(false);
        if (cached.length > 0) {
          setLastLiveUpdate(cached[0].data_golf_updated_at);
          setCurrentLiveEvent(cached[0].event_name);
        }
        return;
      }
      // Otherwise, fetch and cache
      setLoadingLive(true);
      try {
        let query = supabase
          .from("latest_live_tournament_stats_view")
          .select("*");
        if (roundFilter !== "latest") {
          query = query.eq('round_num', roundFilter);
        }
        query = query.order("event_name", { ascending: false })
                     .order("total", { ascending: true });
        const { data, error } = await query;
        if (didCancel) return;
        if (error) throw error;
        setLiveStats(data || []);
        setCachedLiveStats(roundFilter, data || []);
        if (data && data.length > 0) {
          const latestRecord = data.reduce((latest, current) =>
            new Date(current.data_golf_updated_at ?? 0) > new Date(latest.data_golf_updated_at ?? 0) ? current : latest
          );
          setLastLiveUpdate(latestRecord.data_golf_updated_at);
          setCurrentLiveEvent(latestRecord.event_name);
        } else {
          setLastLiveUpdate(null);
          setCurrentLiveEvent(null);
        }
      } catch (error) {
        if (!didCancel) {
          console.error("Error fetching live stats:", error);
          toast({ title: "Error Fetching Live Stats", variant: "destructive" });
          setLiveStats([]);
          setLastLiveUpdate(null);
          setCurrentLiveEvent(null);
        }
      } finally {
        if (!didCancel) setLoadingLive(false);
      }
    }
    maybeFetchLiveStats();
    return () => { didCancel = true; };
  }, [roundFilter, dataView]);

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

  // Patch: manual sync always fetches fresh and updates cache
  const fetchLiveStats = async () => {
    setLoadingLive(true);
    try {
      let query = supabase
        .from("latest_live_tournament_stats_view")
        .select("*");
      if (roundFilter !== "latest") {
        query = query.eq('round_num', roundFilter);
      }
      query = query.order("event_name", { ascending: false })
                   .order("total", { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      setLiveStats(data || []);
      setCachedLiveStats(roundFilter, data || []);
      if (data && data.length > 0) {
        const latestRecord = data.reduce((latest, current) =>
          new Date(current.data_golf_updated_at ?? 0) > new Date(latest.data_golf_updated_at ?? 0) ? current : latest
        );
        setLastLiveUpdate(latestRecord.data_golf_updated_at);
        setCurrentLiveEvent(latestRecord.event_name);
      } else {
        setLastLiveUpdate(null);
        setCurrentLiveEvent(null);
      }
    } catch (error) {
      console.error("Error fetching live stats:", error);
      toast({ title: "Error Fetching Live Stats", variant: "destructive" });
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

  const triggerLiveSyncAndRefetch = async () => {
    setIsSyncingLive(true)
    setLastLiveUpdate(null)
    try {
      const response = await fetch("/api/live-stats/sync")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error response" }))
        throw new Error(errorData.error || `Server responded with status: ${response.status}`)
      }
      
      const data = await response.json()
      if (data.success) {
        toast({
          title: "Tournament Data Updated",
          description: `Latest stats refreshed for ${data.eventName}`,
        })
        await fetchLiveStats()
      } else {
        throw new Error(data.error || "Unknown error occurred during sync")
      }
    } catch (error) {
      console.error("Error syncing live stats via API:", error)
      toast({
        title: "Error Syncing Live Stats",
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
      if (fieldDgIds && fieldDgIds.length > 0) {
        return seasonSkills.filter(p => fieldDgIds.includes(p.dg_id))
      }
      return []
    } else {
      let targetRound = roundFilter
      if (targetRound === 'latest') {
        targetRound = 'event_avg'
      }
      const filteredLiveStats = liveStats.filter(p => p.round_num === targetRound)

      // Pre-calculate trends
      return filteredLiveStats.map(livePlayer => {
        const seasonData = seasonSkillsMap.get(livePlayer.dg_id)
        const trends: Record<string, ReturnType<typeof getTrendIndicator>> = {}

        if (seasonData) {
          const sgKeys: (keyof PlayerSkillRating & keyof LiveTournamentStat)[] = ['sg_putt', 'sg_arg', 'sg_app', 'sg_ott', 'sg_total']
          
          sgKeys.forEach(key => {
            const liveValue = livePlayer[key]
            const seasonValue = seasonData[key]
            const diff = (typeof liveValue === 'number' && typeof seasonValue === 'number') ? liveValue - seasonValue : null
            trends[key] = getTrendIndicator(diff)
          })

          // Calculate T2G trend separately
          const liveT2G = livePlayer.sg_t2g
          const seasonOtt = seasonData.sg_ott
          const seasonApp = seasonData.sg_app
          const seasonT2G = (typeof seasonOtt === 'number' && typeof seasonApp === 'number') ? seasonOtt + seasonApp : null
          const diffT2G = (typeof liveT2G === 'number' && typeof seasonT2G === 'number') ? liveT2G - seasonT2G : null
          trends['sg_t2g'] = getTrendIndicator(diffT2G)
        }
        
        return { ...livePlayer, trends }
      })
    }
  }, [dataView, seasonSkills, liveStats, roundFilter, seasonSkillsMap, fieldDgIds])

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

  const loading = (dataView === 'season' && fieldLoading) || loadingSeason || loadingLive

  return {
    sorting,
    setSorting,
    displayPlayers,
    loading,
    loadingSeason,
    loadingLive,
    isSyncingSkills,
    isSyncingLive,
    lastSkillUpdate,
    lastLiveUpdate,
    currentLiveEvent,
    getHeatmapColor,
    triggerSkillSyncAndRefetch,
    triggerLiveSyncAndRefetch,
    fetchSeasonSkills,
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
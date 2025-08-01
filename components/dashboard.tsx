"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/use-toast"
import PlayerTable from "./player-table"
import ParlayBuilder from "./parlay-builder"
import MatchupsTable from "./matchups-table"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ParlayProvider } from "@/context/ParlayContext"
import { useCurrentWeekEventsQuery, Event as TournamentEvent } from "@/hooks/use-current-week-events-query"
import { useMatchupTypeQuery } from "@/hooks/use-matchup-type-query"
import { RecommendedPicksPanel } from "@/components/recommended-picks"
import { useCurrentRoundForEvent } from '@/hooks/use-current-round-for-event'
import { Badge } from "@/components/ui/badge"
import { Filter as FilterIcon, CloudRain } from "lucide-react"
import { OddsFreshnessIndicator } from "@/components/odds-freshness-indicator"
import { ManualIngestButton } from "@/components/manual-ingest-button"
import { useMatchupsQuery } from "@/hooks/use-matchups-query"
import { PlayerSearchWithCount, usePlayerSearch } from "@/components/ui/player-search"
import { formatPlayerName } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { FormField, FormItem, FormLabel } from "@/components/ui/form"
import { MatchupFilterPanel } from "@/components/ui/matchup-filter-panel"
import { useMatchupFilters } from "@/hooks/use-matchup-filters"
import { FilterPerformanceDashboard } from "@/components/filter-performance-dashboard"
import { AdminDashboard } from "@/components/admin-dashboard"


// Define props for Dashboard
interface DashboardProps {
  initialSeasonSkills: any[];
  initialLiveStats: any[];
  initialPgaTourStats?: any[];
  defaultTab?: "matchups" | "players" | "parlay" | "filter-performance" | "admin";
}

export default function Dashboard({ 
  initialSeasonSkills, 
  initialLiveStats,
  initialPgaTourStats = [],
  defaultTab = "matchups"
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [isMounted, setIsMounted] = useState(false)
  
  // Track mount state to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  const { data: currentEvents, isLoading: isLoadingEvents } = useCurrentWeekEventsQuery()
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [matchupType, setMatchupType] = useState<"2ball" | "3ball">("3ball")
  const [currentRound, setCurrentRound] = useState<number>(2)
  const [userSelectedType, setUserSelectedType] = useState(false) // Track if user manually selected

  // Auto-detect available matchup types for the selected event
  const { data: availableMatchupTypes } = useMatchupTypeQuery(selectedEventId)

  // Fetch the current round for the selected event
  const { data: latestRound, isLoading: isLoadingRound } = useCurrentRoundForEvent(selectedEventId)

  // **SHARED DATA FETCHING** - Fetch matchups once and share between components
  const { 
    data: sharedMatchupsData, 
    isLoading: isLoadingMatchups, 
    isError: isErrorMatchups, 
    error: errorMatchups 
  } = useMatchupsQuery(selectedEventId, matchupType, currentRound);

  // **PLAYER SEARCH** - Centralized search for both matchups and recommendations
  const [playerSearchTerm, setPlayerSearchTerm] = useState("")
  
  // Create a flat list of all players from matchups for search
  const allPlayersFromMatchups = (sharedMatchupsData || []).flatMap(matchup => {
    const players: Array<{ name: string; matchupId: string }> = []
    
    // Handle both 3ball and 2ball matchups
    if (matchup.type === '3ball') {
      players.push({ name: matchup.player1_name, matchupId: matchup.id })
      players.push({ name: matchup.player2_name, matchupId: matchup.id })
      if (matchup.player3_name) {
        players.push({ name: matchup.player3_name, matchupId: matchup.id })
      }
    } else if (matchup.type === '2ball') {
      players.push({ name: matchup.player1_name, matchupId: matchup.id })
      players.push({ name: matchup.player2_name, matchupId: matchup.id })
    }
    
    return players
  })

  // Use player search to get highlighting function and match count
  const { 
    matchingCount: searchMatchingCount,
    highlightText 
  } = usePlayerSearch({
    players: allPlayersFromMatchups,
    searchTerm: playerSearchTerm,
    caseSensitive: false
  })

  // Filter matchups based on search - show matchup if any player matches
  const searchFilteredMatchups = playerSearchTerm 
    ? (sharedMatchupsData || []).filter(matchup => {
        const playerNames = matchup.type === '3ball' 
          ? [matchup.player1_name, matchup.player2_name, matchup.player3_name].filter(Boolean)
          : [matchup.player1_name, matchup.player2_name]
        
        return playerNames.some(name => {
          if (!name) return false
          const formattedName = formatPlayerName(name)
          const nameToSearch = formattedName.toLowerCase()
          const searchTerms = playerSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0)
          return searchTerms.every(term => nameToSearch.includes(term))
        })
      })
    : sharedMatchupsData


  // Matchup filters - use available season skills data for SG comparisons
  const {
    filteredMatchups,
    filterState,
    updateFilter,
    applyPreset,
    clearFilters,
    getMatchupAnalysis,
    getRawMatchupAnalysis,
    getValuePlayers,
    activePreset
  } = useMatchupFilters({
    matchups: searchFilteredMatchups,
    // Pass season skills as player stats for SG data
    playerStats: initialSeasonSkills?.map(skill => ({
      player_id: String(skill.dg_id),
      player_name: skill.player_name || skill.name || `Player ${skill.dg_id}`, // Include player name
      sg_total: skill.sg_total,
      sg_putt: skill.sg_putt,
      sg_app: skill.sg_app,
      sg_arg: skill.sg_arg,
      sg_ott: skill.sg_ott,
      season_sg_total: skill.sg_total
    })),
    tournamentStats: initialLiveStats
  })

  // Debug logging
  console.log('Dashboard state:', {
    selectedEventId,
    matchupType,
    currentRound,
    sharedMatchupsDataLength: sharedMatchupsData?.length,
    searchFilteredMatchupsLength: searchFilteredMatchups?.length,
    filteredMatchupsLength: filteredMatchups?.length,
    isLoadingMatchups,
    isErrorMatchups
  })
  
  // Create custom recommendations for value players when filters are active
  const valuePlayerRecommendations = useMemo(() => {
    if (!filterState.isActive) return null;
    
    const valuePlayers = getValuePlayers();
    if (valuePlayers.length === 0) return [];

    // Convert value players to recommendation format
    const recommendations = valuePlayers.map((player, index) => ({
      dg_id: player.dgId,
      name: player.name || 'Unknown Player', // RecommendedPicksPanel expects 'name' field
      player_name: player.name || 'Unknown Player', // Keep both for compatibility
      odds: player.odds,
      matchup_id: player.matchupId, // snake_case for API compatibility
      matchupId: player.matchupId, // camelCase for component compatibility
      reason: player.reason,
      sgTotal: player.sgTotal, // RecommendedPicksPanel expects 'sgTotal' (camelCase)
      season_sg_total: player.sgTotal, // Use same value for season SG
      event_id: selectedEventId,
      round_num: currentRound,
      bookmaker: 'fanduel',
      created_at: new Date().toISOString()
    }));
    
    // Sort recommendations by best value first
    const sortedRecommendations = recommendations.sort((a, b) => {
      // Calculate priority score based on reason type
      const getReasonScore = (reason: string) => {
        // SG category dominance is highest priority
        if (reason.includes('Leads') && reason.includes('SG categories')) {
          const match = reason.match(/Leads (\d+) SG categories/);
          const categories = match ? parseInt(match[1]) : 0;
          // 4 categories = 140, 3 categories = 130, 2 categories = 120
          return 100 + categories * 10;
        }
        
        // Better SG than favorite is second priority
        if (reason.includes('Better SG than favorite')) {
          return 80;
        }
        
        // Odds gap is third priority
        if (reason.includes('pt odds gap')) {
          const match = reason.match(/(\d+)pt odds gap/);
          const gap = match ? parseInt(match[1]) : 0;
          // Base score of 50, plus 0.5 points per gap point (capped at 20 bonus)
          return 50 + Math.min(gap * 0.5, 20);
        }
        
        return 0;
      };
      
      const aScore = getReasonScore(a.reason);
      const bScore = getReasonScore(b.reason);
      
      // Primary sort: reason score (higher is better)
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      
      // Secondary sort: higher SG Total (better player)
      const aSG = a.sgTotal || -999;
      const bSG = b.sgTotal || -999;
      if (aSG !== bSG) {
        return bSG - aSG;
      }
      
      // Tertiary sort: better odds (higher payout)
      const aOdds = a.odds || 0;
      const bOdds = b.odds || 0;
      return bOdds - aOdds;
    });
    
    return sortedRecommendations;
  }, [filterState.isActive, selectedEventId, currentRound, filteredMatchups]);


  // When selectedEventId or latestRound changes, update currentRound
  useEffect(() => {
    if (typeof latestRound === 'number' && !isNaN(latestRound)) {
      setCurrentRound(latestRound)
    }
  }, [latestRound])

  // Consolidated effect for event selection and matchup type detection
  useEffect(() => {
    if (!currentEvents || currentEvents.length === 0 || isLoadingRound) return;
    
    // Only run this logic once when we have events and round data
    const initializeEventAndMatchupType = async () => {
      try {
    
        
        // If we already have a selected event and haven't manually changed types, 
        // just check current event's 3-ball availability
        if (selectedEventId && !userSelectedType) {
          const response = await fetch(`/api/matchups?eventId=${selectedEventId}&matchupType=3ball&roundNum=${currentRound}&checkOnly=true`);
          const data = await response.json();
          const hasThreeBalls = data.count > 0;
          
          if (hasThreeBalls && matchupType !== "3ball") {
            setMatchupType("3ball");
            if (currentRound >= 3) {
              toast({
                title: "🏌️‍♂️ 3-Ball Matchups Detected!",
                description: `Round ${currentRound} has 3-ball matchups (likely due to weather delays). Auto-switched to 3-ball view! 🎯`,
                duration: 4000,
              });
            }
          } else if (!hasThreeBalls && matchupType === "3ball") {
            setMatchupType("2ball");
          }
          return; // Exit early, we already have an event selected
        }

        // Only do full event selection if we don't have a selected event
        if (!selectedEventId) {
  
          
          // Check each event for 3-ball availability SEQUENTIALLY to avoid request spam
          for (const event of currentEvents) {
            try {
              const response = await fetch(`/api/matchups?eventId=${event.event_id}&matchupType=3ball&roundNum=${currentRound}&checkOnly=true`);
              const data = await response.json();
              const hasThreeBalls = data.count > 0;
              
              if (hasThreeBalls) {
  
                setSelectedEventId(event.event_id);
                setMatchupType("3ball");
                
                if (currentRound >= 3) {
                  toast({
                    title: "🌧️ Weather 3-Balls Found!",
                    description: `Auto-selected ${event.event_name} - Round ${currentRound} has ${data.count} 3-ball matchups! 🎯`,
                    duration: 4000,
                  });
                }
                return; // Found a good event, exit
              }
            } catch (error) {
              console.warn(`Failed to check 3-ball availability for ${event.event_name}:`, error);
            }
          }
          
          // If no events have 3-balls, just select the first event
          
          setSelectedEventId(currentEvents[0].event_id);
          setMatchupType("2ball");
        }
      } catch (error) {
        console.warn("Failed to initialize event and matchup type:", error);
        // Fallback to first event
        if (currentEvents.length > 0) {
          setSelectedEventId(currentEvents[0].event_id);
        }
      }
    };

    initializeEventAndMatchupType();
  }, [currentEvents, currentRound, isLoadingRound]); // Removed selectedEventId and userSelectedType from deps to prevent loops

  const handleEventChange = (value: string) => {

    setSelectedEventId(Number(value));
    setUserSelectedType(false); // Reset user selection when changing events
  }

  const handleMatchupTypeChange = (value: "2ball" | "3ball") => {

    setMatchupType(value);
    setUserSelectedType(true); // Mark as manually selected
  }

  // Check if current selection is weekend 3-balls (weather-induced)
  const isWeatherThreeBalls = matchupType === "3ball" && currentRound >= 3;

  return (
    <ParlayProvider>
      <div className="min-h-screen bg-dashboard">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-display-lg">Golf Parlay Picker</h1>
              <div className="flex items-center gap-3">
                <OddsFreshnessIndicator />
                <ManualIngestButton />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarImage src="/placeholder.svg" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary-dark text-white font-semibold">JD</AvatarFallback>
              </Avatar>
            </div>
          </div>

          {/* Professional Tab Navigation */}
          <div className="mb-8">
            <div className="glass-card p-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={`relative px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    isMounted && activeTab === "matchups" 
                      ? "bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("matchups")}
                >
                  Matchups
                  {isMounted && activeTab === "matchups" && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary-dark/20 animate-pulse-glow" />
                  )}
                </button>
                <button
                  className={`relative px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    isMounted && activeTab === "parlay" 
                      ? "bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("parlay")}
                >
                  Parlay Builder
                  {isMounted && activeTab === "parlay" && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary-dark/20 animate-pulse-glow" />
                  )}
                </button>
                <button
                  className={`relative px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    isMounted && activeTab === "filter-performance" 
                      ? "bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("filter-performance")}
                >
                  Filter Performance
                  {isMounted && activeTab === "filter-performance" && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary-dark/20 animate-pulse-glow" />
                  )}
                </button>
                <button
                  className={`relative px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    isMounted && activeTab === "admin" 
                      ? "bg-gradient-to-r from-primary to-primary-dark text-white shadow-lg shadow-primary/25" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                  onClick={() => setActiveTab("admin")}
                >
                  Admin
                  {isMounted && activeTab === "admin" && (
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-primary-dark/20 animate-pulse-glow" />
                  )}
                </button>
              </div>
            </div>
          </div>

        {activeTab === "matchups" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Row 1: Event Selection and Recommendation Filters */}
            <div className="md:col-span-3">
              <div className="glass-card">
                <div className="p-6">
                  <div className="flex flex-col gap-4">
                    {/* Event and Matchup Type Selectors */}
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pt-6">
                      {currentEvents && (
                        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <span className="text-label">Event:</span>
                            <Select value={selectedEventId ? String(selectedEventId) : undefined} onValueChange={handleEventChange}>
                              <SelectTrigger className="w-full lg:w-[240px] card-clean border border-border/20 bg-white/8 hover:bg-white/12 transition-all">
                                <SelectValue placeholder="Select Event" />
                              </SelectTrigger>
                              <SelectContent className="card-clean border-border/20 backdrop-blur-md shadow-dropdown">
                                {currentEvents
                                  .sort((a: TournamentEvent, b: TournamentEvent) => {
                                    const aDate = a.start_date ?? '';
                                    const bDate = b.start_date ?? '';
                                    return aDate.localeCompare(bDate);
                                  })
                                  .map(ev => (
                                    <SelectItem key={ev.event_id} value={String(ev.event_id)} className="hover:bg-white/10 text-body">
                                      {ev.event_name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <span className="text-label">Type:</span>
                            <Select value={matchupType} onValueChange={handleMatchupTypeChange}>
                              <SelectTrigger className="w-full lg:w-[130px] card-clean border border-border/20 bg-white/8 hover:bg-white/12 transition-all">
                                <SelectValue placeholder="Type" />
                              </SelectTrigger>
                              <SelectContent className="card-clean border-border/20 backdrop-blur-md shadow-dropdown">
                                <SelectItem value="3ball" className="hover:bg-white/10 text-body">3-Ball</SelectItem>
                                <SelectItem value="2ball" className="hover:bg-white/10 text-body">2-Ball</SelectItem>
                              </SelectContent>
                            </Select>
                            {isWeatherThreeBalls && (
                              <Badge variant="secondary" className="flex items-center gap-1 text-xs bg-accent-yellow/20 text-accent-yellow border-accent-yellow/20">
                                <CloudRain className="h-3 w-3" />
                                Weather 3-Ball
                              </Badge>
                            )}
                          </div>
                          {isLoadingRound && <span className="text-xs text-muted-foreground animate-pulse">Loading round...</span>}
                          {!isLoadingRound && latestRound && (
                            <Badge variant="outline" className="text-xs bg-accent-green/20 text-accent-green border-accent-green/20">
                              Round {latestRound}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>


                    {/* Player Search - Positioned above content for better UX */}
                    <div className="lg:col-span-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex justify-center">
                          <PlayerSearchWithCount
                            players={allPlayersFromMatchups}
                            placeholder="Search players across matchups & picks..."
                            className="w-full card-clean border border-border/10 bg-white/6 hover:bg-white/10 transition-all rounded-2xl"
                            caseSensitive={false}
                            value={playerSearchTerm}
                            onSearchChange={setPlayerSearchTerm}
                          />
                        </div>
                        
                        {/* Matchup Filters */}
                        <MatchupFilterPanel
                          filters={filterState}
                          activeFilterCount={filterState.activeFilterCount}
                          onFilterChange={updateFilter}
                          onPresetSelect={applyPreset}
                          onClearFilters={clearFilters}
                          resultCount={filteredMatchups.length}
                          totalCount={searchFilteredMatchups?.length || 0}
                          className="w-full"
                          activePreset={activePreset}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Main Matchups Table (Left) - Larger allocation */}
            <div className="lg:col-span-2">
              <MatchupsTable 
                eventId={selectedEventId} 
                matchupType={matchupType} 
                roundNum={currentRound}
                showFilters={true}
                compactFilters={false}
                // Pass filtered matchups data when filters are active
                sharedMatchupsData={filterState.isActive ? filteredMatchups : undefined}
                isLoading={isLoadingMatchups}
                isError={isErrorMatchups}
                error={errorMatchups}
                // Pass search props for highlighting
                playerSearchTerm={playerSearchTerm}
                highlightText={highlightText}
                // Pass matchup analysis for badges
                getMatchupAnalysis={getMatchupAnalysis}
              />
            </div>

            {/* Row 2: Recommended Picks (Right) - Better space utilization */}
            <div className="lg:col-span-1">
              <div className="relative">
                <RecommendedPicksPanel 
                  eventId={selectedEventId}
                  matchupType={matchupType} 
                  limit={10} 
                  oddsGapPercentage={40}
                  bookmaker="fanduel"
                  roundNum={currentRound}
                  showFilters={false}
                  // Use value player recommendations from matchup filters
                  filteredData={valuePlayerRecommendations}
                  isLoading={false}
                  isError={false}
                  error={null}
                  // Pass search props for highlighting
                  playerSearchTerm={playerSearchTerm}
                  highlightText={highlightText}
                  // Pass matchup analysis function for breakdown modal
                  getMatchupAnalysis={getRawMatchupAnalysis}
                />
              </div>
            </div>
          </div>
        )}

          {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} roundNum={currentRound} />}

          {activeTab === "filter-performance" && (
            <div className="w-full">
              <FilterPerformanceDashboard className="w-full" />
            </div>
          )}

          {activeTab === "admin" && (
            <div className="w-full">
              <AdminDashboard className="w-full" />
            </div>
          )}
        </div>
      </div>
    </ParlayProvider>
  )
}

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
import TopNavigation from "./top-navigation"
import Sidebar from "./sidebar"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ParlayProvider } from "@/context/ParlayContext"
import { useCurrentWeekEventsQuery, Event as TournamentEvent } from "@/hooks/use-current-week-events-query"
import { useMatchupTypeQuery } from "@/hooks/use-matchup-type-query"
import RecommendedPicks from "./recommended-picks"
import { FilterService } from "@/filters/filter-service"
import { registerCoreFilters } from "@/filters/initFilters"
import { useCurrentRoundForEvent } from '@/hooks/use-current-round-for-event'
import { useFilterManager } from "@/hooks/use-filter-manager"
import { useFilteredPlayers } from "@/hooks/use-filtered-players"
import { FilterPanel } from "@/components/ui/filter-panel"
import { FilterChipList } from "@/components/ui/filter-chip"
import { Badge } from "@/components/ui/badge"
import { Filter as FilterIcon, CloudRain } from "lucide-react"
import { OddsFreshnessIndicator } from "@/components/odds-freshness-indicator"
import { ManualIngestButton } from "@/components/manual-ingest-button"
import { useMatchupsQuery } from "@/hooks/use-matchups-query"
import { PlayerSearchWithCount, usePlayerSearch } from "@/components/ui/player-search"
import { formatPlayerName } from "@/lib/utils"

// Register filters once at module load
registerCoreFilters()

// Define props for Dashboard
interface DashboardProps {
  initialSeasonSkills: any[];
  initialLiveStats: any[];
  initialPgaTourStats?: any[];
  defaultTab?: "matchups" | "players" | "parlay";
}

export default function Dashboard({ 
  initialSeasonSkills, 
  initialLiveStats,
  initialPgaTourStats = [],
  defaultTab = "matchups"
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
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
      players.push({ name: matchup.player1_name, matchupId: matchup.uuid })
      players.push({ name: matchup.player2_name, matchupId: matchup.uuid })
      if (matchup.player3_name) {
        players.push({ name: matchup.player3_name, matchupId: matchup.uuid })
      }
    } else if (matchup.type === '2ball') {
      players.push({ name: matchup.player1_name, matchupId: matchup.uuid })
      players.push({ name: matchup.player2_name, matchupId: matchup.uuid })
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

  // Filter management - only for recommended picks
  const filterManager = useFilterManager({ 
    autoSave: true, 
    enablePerformanceTracking: true 
  })

  // Use filtered data hook for recommendations - but pass shared matchups data
  const {
    data: filteredRecommendations,
    isLoading: isLoadingRecommendations,
    isError: isErrorRecommendations,
    error: errorRecommendations,
    originalCount: originalRecommendationsCount,
    filteredCount: filteredRecommendationsCount,
    appliedFilters: appliedRecommendationFilters,
    performance: recommendationsPerformance
  } = useFilteredPlayers(selectedEventId, matchupType, currentRound, {
    filterIds: filterManager.selectedFilters,
    filterOptions: filterManager.filterOptions,
    bookmaker: "fanduel",
    oddsGapPercentage: 40,
    limit: 10,
    debounceMs: 300,
    enableCaching: true,
    // Pass shared matchups data to prevent duplicate fetching
    sharedMatchupsData
  })

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
      <div className="w-full">
        <div className="mt-6 mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Golf Parlay Picker</h1>
            <div className="flex items-center gap-3">
              <OddsFreshnessIndicator />
              <ManualIngestButton />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src="/placeholder.svg" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>

      <div className="mb-6">
        <div className="flex space-x-2">
          <button
            className={`tab-button ${activeTab === "matchups" ? "tab-button-active" : ""}`}
            onClick={() => setActiveTab("matchups")}
          >
            Matchups
          </button>
          <button
            className={`tab-button ${activeTab === "parlay" ? "tab-button-active" : ""}`}
            onClick={() => setActiveTab("parlay")}
          >
            Parlay Builder
          </button>
        </div>
      </div>

      {activeTab === "matchups" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Row 1: Event Selection and Recommendation Filters */}
          <div className="md:col-span-3">
            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                  {/* Event and Matchup Type Selectors */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h2 className="text-xl font-bold">Event Selection</h2>
                    {currentEvents && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Event:</span>
                        <Select value={selectedEventId ? String(selectedEventId) : undefined} onValueChange={handleEventChange}>
                          <SelectTrigger className="w-[220px] bg-[#1e1e23] border-none">
                            <SelectValue placeholder="Select Event" />
                          </SelectTrigger>
                          <SelectContent>
                            {currentEvents
                              .sort((a: TournamentEvent, b: TournamentEvent) => {
                                const aDate = a.start_date ?? '';
                                const bDate = b.start_date ?? '';
                                return aDate.localeCompare(bDate);
                              })
                              .map(ev => (
                                <SelectItem key={ev.event_id} value={String(ev.event_id)}>
                                  {ev.event_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <span className="text-sm text-gray-400 ml-4">Matchup Type:</span>
                        <div className="flex items-center gap-2">
                          <Select value={matchupType} onValueChange={handleMatchupTypeChange}>
                            <SelectTrigger className="w-[120px] bg-[#1e1e23] border-none">
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="3ball">3-Ball</SelectItem>
                              <SelectItem value="2ball">2-Ball</SelectItem>
                            </SelectContent>
                          </Select>
                          {isWeatherThreeBalls && (
                            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                              <CloudRain className="h-3 w-3" />
                              Weather 3-Ball
                            </Badge>
                          )}
                        </div>
                        {isLoadingRound && <span className="ml-4 text-xs text-gray-400">Loading round...</span>}
                        {!isLoadingRound && latestRound && (
                          <span className="ml-4 text-xs text-green-400">Current Round: {latestRound}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Filter Panel for Recommendations */}
                  <div className="border-t pt-4">
                    <FilterPanel
                      selectedFilters={filterManager.selectedFilters}
                      onFiltersChange={(filterIds) => {
                        // Clear existing filters and add new ones
                        filterManager.clearAllFilters()
                        filterIds.forEach(id => filterManager.addFilter(id))
                      }}
                      filterOptions={filterManager.filterOptions}
                      onFilterOptionsChange={filterManager.updateFilterOptions}
                      multiSelect={true}
                      showResultCount={false}
                      isLoading={isLoadingRecommendations}
                      compact={false}
                    />
                  </div>

                  {/* Results Summary */}
                  {filterManager.hasFilters && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-sm">
                            Recommendations: {filteredRecommendationsCount} of {originalRecommendationsCount}
                          </Badge>
                          {appliedRecommendationFilters.length > 0 && (
                            <FilterChipList
                              filterIds={appliedRecommendationFilters}
                              onRemove={filterManager.removeFilter}
                              onClearAll={filterManager.clearAllFilters}
                              size="sm"
                              maxVisible={3}
                            />
                          )}
                        </div>
                        {recommendationsPerformance.filterTime > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(recommendationsPerformance.filterTime)}ms
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Player Search - Positioned above content for better UX */}
          <div className="md:col-span-3">
            <div className="flex justify-center">
              <PlayerSearchWithCount
                players={allPlayersFromMatchups}
                placeholder="Search players across matchups & picks..."
                className="w-full bg-[#1e1e23] border-none rounded-xl"
                caseSensitive={false}
                value={playerSearchTerm}
                onSearchChange={setPlayerSearchTerm}
              />
            </div>
          </div>

          {/* Row 2: Main Matchups Table (Left) - Larger allocation */}
          <div className="md:col-span-2">
            <MatchupsTable 
              eventId={selectedEventId} 
              matchupType={matchupType} 
              roundNum={currentRound}
              showFilters={true}
              compactFilters={false}
              // Pass search-filtered shared data to prevent duplicate API calls
              sharedMatchupsData={searchFilteredMatchups}
              isLoading={isLoadingMatchups}
              isError={isErrorMatchups}
              error={errorMatchups}
              // Pass search props for highlighting
              playerSearchTerm={playerSearchTerm}
              highlightText={highlightText}
            />
          </div>

          {/* Row 2: Recommended Picks (Right) - Better space utilization */}
          <div className="md:col-span-1">
            <RecommendedPicks 
              eventId={selectedEventId}
              matchupType={matchupType} 
              limit={10} 
              oddsGapPercentage={40}
              bookmaker="fanduel"
              roundNum={currentRound}
              showFilters={false}
              filteredData={filteredRecommendations}
              isLoading={isLoadingRecommendations}
              isError={isErrorRecommendations}
              error={errorRecommendations}
              // Pass search props for highlighting
              playerSearchTerm={playerSearchTerm}
              highlightText={highlightText}
            />
          </div>
        </div>
      )}

      {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} roundNum={currentRound} />}
      </div>
    </ParlayProvider>
  )
}

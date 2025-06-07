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

  // Filter management - only for recommended picks
  const filterManager = useFilterManager({ 
    autoSave: true, 
    enablePerformanceTracking: true 
  })

  // Use filtered data hook only for recommendations
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
    enableCaching: true
  })

  // Fetch the current round for the selected event
  const { data: latestRound, isLoading: isLoadingRound } = useCurrentRoundForEvent(selectedEventId)

  // When selectedEventId or latestRound changes, update currentRound
  useEffect(() => {
    if (typeof latestRound === 'number' && !isNaN(latestRound)) {
      setCurrentRound(latestRound)
    }
  }, [latestRound])

  useEffect(() => {
    if (!currentEvents || currentEvents.length === 0) return;
    
    // Smart event selection: prioritize events with 3-ball availability for current round
    const selectBestEvent = async () => {
      try {
        // Check each event for 3-ball availability in the current round
        const eventChecks = await Promise.all(
          currentEvents.map(async (event) => {
            try {
              const response = await fetch(`/api/matchups?eventId=${event.event_id}&matchupType=3ball&roundNum=${currentRound}&checkOnly=true`);
              const data = await response.json();
              const hasThreeBalls = data.count > 0;
              return { event, hasThreeBalls, count: data.count };
            } catch (error) {
              return { event, hasThreeBalls: false, count: 0 };
            }
          })
        );

        // Prioritize events with 3-ball matchups for current round
        const eventsWithThreeBalls = eventChecks.filter(check => check.hasThreeBalls);
        
        if (eventsWithThreeBalls.length > 0) {
          // If multiple events have 3-balls, prefer the one with most matchups
          const bestEvent = eventsWithThreeBalls.sort((a, b) => b.count - a.count)[0];
          setSelectedEventId(bestEvent.event.event_id);
          
          // Show celebration for weekend 3-balls (weather-induced)
          if (currentRound >= 3) {
            toast({
              title: "🌧️ Weather 3-Balls Found!",
              description: `Auto-selected ${bestEvent.event.event_name} - Round ${currentRound} has ${bestEvent.count} 3-ball matchups! Perfect for your betting strategy! 🎯`,
              duration: 4000,
            });
          }
        } else {
          // Fallback to first event by date
          setSelectedEventId(currentEvents[0].event_id);
        }
      } catch (error) {
        console.warn("Failed to check event 3-ball availability:", error);
        // Fallback to first event
        setSelectedEventId(currentEvents[0].event_id);
      }
    };

    selectBestEvent();
  }, [currentEvents, currentRound]);

  // Auto-detection logic: Always prefer 3-ball when available (unless user manually selected)
  useEffect(() => {
    if (!selectedEventId || userSelectedType) return;
    
    // Check for 3-ball availability for the selected event and round
    const checkThreeBallAvailability = async () => {
      try {
        const response = await fetch(`/api/matchups?eventId=${selectedEventId}&matchupType=3ball&roundNum=${currentRound}&checkOnly=true`);
        const data = await response.json();
        const hasThreeBalls = data.count > 0;
        
        if (hasThreeBalls && matchupType !== "3ball") {
          setMatchupType("3ball");
          
          // Show notification for weekend 3-balls (weather-induced) - only if not already shown
          if (currentRound >= 3 && !userSelectedType) {
            toast({
              title: "🏌️‍♂️ 3-Ball Matchups Detected!",
              description: `Round ${currentRound} has 3-ball matchups (likely due to weather delays). Auto-switched to 3-ball view - your bread and butter! 🎯`,
              duration: 4000,
            });
          }
        } else if (!hasThreeBalls && matchupType === "3ball") {
          // Fallback to 2-ball if no 3-balls available
          setMatchupType("2ball");
        }
      } catch (error) {
        console.warn("Failed to check 3-ball availability:", error);
      }
    };

    checkThreeBallAvailability();
  }, [selectedEventId, currentRound, matchupType, userSelectedType]);

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
          <h1 className="text-3xl font-bold">Golf Parlay Picker</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Input placeholder="Search players..." className="pl-10 w-64 bg-[#1e1e23] border-none rounded-xl" />
            </div>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Row 1: Event Selection and Recommendation Filters */}
          <div className="md:col-span-4">
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

          {/* Row 2: Main Matchups Table (Left) - No filtering */}
          <div className="md:col-span-3">
            <MatchupsTable 
              eventId={selectedEventId} 
              matchupType={matchupType} 
              roundNum={currentRound} 
            />
          </div>

          {/* Row 2: Recommended Picks (Right) - With filtering */}
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
            />
          </div>
        </div>
      )}

      {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} roundNum={currentRound} />}
      </div>
    </ParlayProvider>
  )
}

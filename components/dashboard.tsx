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
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showCustom, setShowCustom] = useState(false)
  const { data: currentEvents, isLoading: isLoadingEvents } = useCurrentWeekEventsQuery()
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [matchupType, setMatchupType] = useState<"2ball" | "3ball">("3ball")
  const [currentRound, setCurrentRound] = useState<number>(2)

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
    setSelectedEventId(currentEvents[0].event_id);
  }, [currentEvents]);

  // Get all filters from FilterService
  const filters = useMemo(() => {
    return FilterService.getInstance().getFilters();
  }, [])

  const handleFilterChange = (filterId: string) => {
    setActiveFilter(filterId)
    setShowCustom(filterId === "custom")
  }

  const handleEventChange = (value: string) => {
    setSelectedEventId(Number(value));
  }

  // Example: pass activeFilter and options to children (RecommendedPicks, MatchupsTable)
  // For now, just pass the filter id; later, pass options as well

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
          {/* Row 1: Filters (Spanning full width) */}
          <div className="md:col-span-4">
            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                  <h2 className="text-xl font-bold">Filters</h2>
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
                      <Select value={matchupType} onValueChange={v => setMatchupType(v as "2ball" | "3ball") }>
                        <SelectTrigger className="w-[120px] bg-[#1e1e23] border-none">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3ball">3-Ball</SelectItem>
                          <SelectItem value="2ball">2-Ball</SelectItem>
                        </SelectContent>
                      </Select>
                      {isLoadingRound && <span className="ml-4 text-xs text-gray-400">Loading round...</span>}
                      {!isLoadingRound && latestRound && (
                        <span className="ml-4 text-xs text-green-400">Current Round: {latestRound}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <Button
                      key={filter.id}
                      variant={activeFilter === filter.id ? "default" : "outline"}
                      onClick={() => handleFilterChange(filter.id)}
                      className={activeFilter === filter.id ? "filter-button-active" : "filter-button"}
                    >
                      {filter.name}
                    </Button>
                  ))}
                </div>
                {showCustom && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">SG: Tee-to-Green</label>
                      <Input type="number" placeholder="Weight" className="bg-[#1e1e23] border-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">SG: Approach</label>
                      <Input type="number" placeholder="Weight" className="bg-[#1e1e23] border-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">SG: Around-the-Green</label>
                      <Input type="number" placeholder="Weight" className="bg-[#1e1e23] border-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-gray-400">SG: Putting</label>
                      <Input type="number" placeholder="Weight" className="bg-[#1e1e23] border-none" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Main Matchups Table (Left) */}
          <div className="md:col-span-3">
            <MatchupsTable eventId={selectedEventId} matchupType={matchupType} roundNum={currentRound} filterId={activeFilter} />
          </div>

          {/* Row 2: Recommended Picks (Right) */}
          <div className="md:col-span-1">
            <RecommendedPicks 
              eventId={selectedEventId}
              matchupType={matchupType} 
              limit={10} 
              oddsGapPercentage={40}
              bookmaker="fanduel"
              roundNum={currentRound}
              filterId={activeFilter}
            />
          </div>
        </div>
      )}

      {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} roundNum={currentRound} />}
      </div>
    </ParlayProvider>
  )
}

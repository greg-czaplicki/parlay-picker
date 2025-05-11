"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Filter,
  GlobeIcon as GolfBall,
  TrendingUp,
  BarChart3,
  DollarSign,
  Settings,
  Search,
  Bell,
} from "lucide-react"
import PlayerTable from "./player-table"
import ParlayBuilder from "./parlay-builder"
import MatchupsTable from "./matchups-table"
import TopNavigation from "./top-navigation"
import Sidebar from "./sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/use-toast"
import { PlayerSkillRating, LiveTournamentStat, PgaTourPlayerStats } from "@/types/definitions"
import RecommendedPicks from "./recommended-picks"
import { createBrowserClient } from "@/lib/supabase"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { ParlayProvider } from "@/context/ParlayContext"
import { useCurrentWeekEventsQuery, Event as TournamentEvent } from "@/hooks/use-current-week-events-query"
import { useMatchupTypeQuery } from "@/hooks/use-matchup-type-query"

const filters = [
  { name: "Balanced", icon: <Filter className="w-4 h-4" /> },
  { name: "SG Heavy", icon: <GolfBall className="w-4 h-4" /> },
  { name: "Heavy Favorites", icon: <TrendingUp className="w-4 h-4" /> },
  { name: "Score Heavy", icon: <BarChart3 className="w-4 h-4" /> },
  { name: "SG Value", icon: <DollarSign className="w-4 h-4" /> },
  { name: "Custom", icon: <Settings className="w-4 h-4" /> },
]

// Define props for Dashboard
interface DashboardProps {
  initialSeasonSkills: PlayerSkillRating[];
  initialLiveStats: LiveTournamentStat[];
  initialPgaTourStats?: PgaTourPlayerStats[];
  defaultTab?: "matchups" | "players" | "parlay";
}

export default function Dashboard({ 
  initialSeasonSkills, 
  initialLiveStats,
  initialPgaTourStats = [],
  defaultTab = "matchups"
}: DashboardProps) {
  const [activeFilter, setActiveFilter] = useState("Balanced")
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [showCustom, setShowCustom] = useState(false)
  const { data: currentEvents, isLoading: isLoadingEvents, isError: isErrorEvents, error: eventsError } = useCurrentWeekEventsQuery()
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const { data: matchupTypeRaw, isLoading: isLoadingMatchupType, isError: isErrorMatchupType, error: matchupTypeError } = useMatchupTypeQuery(selectedEventId)
  const matchupType: string = matchupTypeRaw ?? "3ball" // fallback to '3ball' if undefined/null

  useEffect(() => {
    if (!currentEvents || currentEvents.length === 0) return;
    setSelectedEventId(currentEvents[0].event_id);
  }, [currentEvents]);

  const handleFilterChange = (filterName: string) => {
    setActiveFilter(filterName)
    setShowCustom(filterName === "Custom")
  }

  const handleEventChange = (value: string) => {
    setSelectedEventId(Number(value));
  }

  return (
    <ParlayProvider>
      <div className="w-full">
        <div className="mt-6 mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Golf Parlay Picker</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input placeholder="Search players..." className="pl-10 w-64 bg-[#1e1e23] border-none rounded-xl" />
            </div>
            <Button variant="outline" size="icon" className="rounded-full bg-[#1e1e23] border-none">
              <Bell size={18} />
            </Button>
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
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <Button
                      key={filter.name}
                      variant={activeFilter === filter.name ? "default" : "outline"}
                      onClick={() => handleFilterChange(filter.name)}
                      className={activeFilter === filter.name ? "filter-button-active" : "filter-button"}
                    >
                      {filter.icon}
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
            <MatchupsTable eventId={selectedEventId} matchupType={matchupType as "3ball" | "2ball"} />
          </div>

          {/* Row 2: Recommended Picks (Right) */}
          <div className="md:col-span-1">
            <RecommendedPicks 
              matchupType={matchupType as "3ball" | "2ball"} 
              limit={10} 
              oddsGapPercentage={40} // 40 point American odds gap
              bookmaker="fanduel" // Use same bookmaker as matchups table default
              eventId={selectedEventId} // Pass the selected event ID to filter
            />
          </div>
        </div>
      )}

      {/* Players tab removed and moved to its own page */}
      {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} />}
      </div>
    </ParlayProvider>
  )
}

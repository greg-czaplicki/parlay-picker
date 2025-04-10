"use client"

import { useState } from "react"
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
  RefreshCw,
  Loader2,
} from "lucide-react"
import PlayerTable from "./player-table"
import ParlayBuilder from "./parlay-builder"
import MatchupsTable from "./matchups-table"
import TopNavigation from "./top-navigation"
import Sidebar from "./sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "@/components/ui/use-toast"
import { PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"
import RecommendedPicks from "./recommended-picks"

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
}

export default function Dashboard({ initialSeasonSkills, initialLiveStats }: DashboardProps) {
  const [activeFilter, setActiveFilter] = useState("Balanced")
  const [activeTab, setActiveTab] = useState("matchups")
  const [showCustom, setShowCustom] = useState(false)

  // Remove API refresh state/handlers from Dashboard
  // const [isRefreshingMatchups, setIsRefreshingMatchups] = useState(false);
  // const [matchupRefreshKey, setMatchupRefreshKey] = useState(0); // Can remove if not needed elsewhere

  // Remove bookmaker/timestamp state from Dashboard
  // const [selectedBookmaker, setSelectedBookmaker] = useState<"fanduel" | "draftkings">("fanduel");
  // const [lastMatchupUpdate, setLastMatchupUpdate] = useState<string | null>(null);
  const [matchupType, setMatchupType] = useState("3ball"); // Keep if ParlayBuilder needs it

  // Remove callback from Dashboard
  // const handleDataLoaded = (timestamp: string | null) => { ... };

  const handleFilterChange = (filterName: string) => {
    setActiveFilter(filterName)
    setShowCustom(filterName === "Custom")
  }

  // Remove API trigger function from Dashboard
  // const handleRefreshMatchups = async () => { ... };

  return (
    <div className="min-h-screen bg-[#121212] text-white">
      <Sidebar />
      <div className="ml-16 p-4">
        <TopNavigation />

        <div className="mt-6 mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Golf Parlay Picker</h1>
          <div className="flex items-center gap-4">
            {/* Remove the main refresh button trigger from the header */}
            {/* Keep Search, Bell, Avatar */}
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
              className={`tab-button ${activeTab === "players" ? "tab-button-active" : ""}`}
              onClick={() => setActiveTab("players")}
            >
              Players
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
          // Use a single grid for the main content area of this tab
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

            {/* Row 1: Filters (Spanning full width) */}
            <div className="md:col-span-4">
              <Card className="glass-card">
                 <CardContent className="p-6">
                      <h2 className="text-xl font-bold mb-4">Filters</h2>
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
                          {/* Custom filter inputs */}
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
               <MatchupsTable />
            </div>

            {/* Row 2: Recommended Picks (Right) */}
            <div className="md:col-span-1">
               <RecommendedPicks matchupType="3ball" limit={10} />
            </div>

          </div>
        )}

        {activeTab === "players" && (
          <>
            {/* ... Player Filters Card ... */}
            {/* Pass initial data down to PlayerTable */}
            <PlayerTable
                initialSeasonSkills={initialSeasonSkills}
                initialLiveStats={initialLiveStats}
            />
          </>
        )}
        {activeTab === "parlay" && <ParlayBuilder matchupType={matchupType} />}

      </div>
    </div>
  )
}

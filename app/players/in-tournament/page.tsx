import { InTournamentPlayerTableContainer } from '@/components/tables/player-table/in-tournament-player-table-container'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export default function InTournamentPlayersPage() {
  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-display-lg mb-8">In-Tournament Player Stats</h1>
        <InTournamentPlayerTableContainer />
      </div>
    </div>
  )
} 
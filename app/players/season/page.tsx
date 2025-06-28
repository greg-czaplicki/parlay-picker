import { SeasonPlayerTableContainer } from '@/components/tables/player-table/season-player-table-container'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export default function SeasonPlayersPage() {
  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-display-lg mb-8">Season Player Stats</h1>
        <SeasonPlayerTableContainer />
      </div>
    </div>
  )
} 
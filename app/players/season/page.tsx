import { SeasonPlayerTableContainer } from '@/components/tables/player-table/season-player-table-container'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export default function SeasonPlayersPage() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Season Player Stats</h1>
      <SeasonPlayerTableContainer />
    </main>
  )
} 
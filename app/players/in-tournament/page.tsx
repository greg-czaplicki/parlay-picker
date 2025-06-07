import { InTournamentPlayerTableContainer } from '@/components/tables/player-table/in-tournament-player-table-container'

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic'

export default function InTournamentPlayersPage() {
  return (
    <main className="p-4 w-full">
      <h1 className="text-2xl font-bold mb-4">In-Tournament Player Stats</h1>
      <InTournamentPlayerTableContainer />
    </main>
  )
} 
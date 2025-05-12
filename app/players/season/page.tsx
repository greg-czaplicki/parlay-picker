import { SeasonPlayerTableContainer } from '@/components/tables/player-table/season-player-table-container'

export default function SeasonPlayersPage() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Season Player Stats</h1>
      <SeasonPlayerTableContainer />
    </main>
  )
} 
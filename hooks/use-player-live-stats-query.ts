import { useQuery } from '@tanstack/react-query'
import { createBrowserClient } from '@/lib/supabase'
import { LiveTournamentStat } from '@/types/definitions'

async function fetchPlayerLiveStats(playerName: string): Promise<LiveTournamentStat[]> {
  const supabase = createBrowserClient()
  // Support both "Last, First" and "First Last" formats
  const searchPatterns = [playerName]
  if (playerName.includes(',')) {
    const [last, first] = playerName.split(',').map(s => s.trim())
    searchPatterns.push(`${first} ${last}`)
  } else {
    const parts = playerName.split(' ')
    if (parts.length >= 2) {
      const first = parts.slice(0, -1).join(' ')
      const last = parts[parts.length - 1]
      searchPatterns.push(`${last}, ${first}`)
    }
  }
  // Query for any pattern
  let stats: LiveTournamentStat[] = []
  for (const pattern of searchPatterns) {
    const { data, error } = await supabase
      .from('live_tournament_stats')
      .select('*')
      .ilike('player_name', `%${pattern}%`)
    if (error) continue
    if (data && data.length > 0) {
      stats = data
      break
    }
  }
  return stats
}

export function usePlayerLiveStatsQuery(playerName: string) {
  return useQuery({
    queryKey: ['playerLiveStats', playerName],
    queryFn: () => fetchPlayerLiveStats(playerName),
    enabled: !!playerName,
    staleTime: 1000 * 60, // 1 minute
  })
} 
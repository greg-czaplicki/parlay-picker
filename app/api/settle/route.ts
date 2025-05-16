import { logger } from '@/lib/logger'
import { createSupabaseClient, handleApiError, jsonSuccess } from '@/lib/api-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createSupabaseClient()
  try {
    // 1. Find all unsettled picks
    const { data: picks, error: picksError } = await supabase
      .from('parlay_picks')
      .select('*')
      .eq('outcome', 'void')
    if (picksError) throw picksError
    if (!picks || picks.length === 0) {
      logger.info('No unsettled picks found.')
      return jsonSuccess({ settled: 0, updatedParlays: 0 })
    }
    let settled = 0
    let updatedParlays = 0
    const parlayIdsToCheck = new Set<number>()

    // --- NEW: Gather all matchup/player/round info for batch live stats fetch ---
    // Fetch all matchups for the picks
    const matchupIds = picks.map((pick) => pick.matchup_id)
    const { data: matchups, error: matchupsError } = await supabase
      .from('matchups')
      .select('*')
      .in('id', matchupIds)
    if (matchupsError) throw matchupsError
    // Build lookup by matchup id
    const matchupMap = new Map(matchups.map((m) => [m.id, m]))
    // Collect all player names and round numbers
    const allPlayerNames = new Set<string>()
    const allRoundNums = new Set<number>()
    matchups.forEach((m) => {
      if (m.player1_name) allPlayerNames.add(m.player1_name)
      if (m.player2_name) allPlayerNames.add(m.player2_name)
      if (m.player3_name) allPlayerNames.add(m.player3_name)
      if (m.round_num) allRoundNums.add(m.round_num)
    })
    // Fetch live stats for all players/rounds
    let liveStats: any[] = []
    if (allPlayerNames.size > 0 && allRoundNums.size > 0) {
      const { data: statsData, error: statsError } = await supabase
        .from('live_tournament_stats')
        .select('player_name,round_num,position,total,thru,today')
        .in('player_name', Array.from(allPlayerNames))
        .in('round_num', Array.from(allRoundNums).map(String))
      if (statsError) throw statsError
      if (statsData) liveStats = statsData
    }
    // Helper to get stats for a player/round
    function getStats(playerName: string, roundNum: number): any {
      return liveStats.find(
        (s) => s.player_name === playerName && String(s.round_num) === String(roundNum)
      )
    }
    // Helper to robustly parse the 'today' field
    function parseToday(today: any): number | null {
      if (today === 'E' || today === 'e') return 0
      if (typeof today === 'number') return today
      const n = Number(today)
      return isNaN(n) ? null : n
    }
    // --- END NEW ---

    // 2. For each pick, use live stats to determine outcome
    for (const pick of picks) {
      const matchup = matchupMap.get(pick.matchup_id)
      if (!matchup) {
        logger.error('Matchup not found for pick', { pickId: pick.id, matchupId: pick.matchup_id })
        continue
      }
      // Gather all players in the matchup with their live stats for this round
      const players: { id: number, name: string, score: number | null }[] = []
      if (matchup.player1_id && matchup.player1_name) {
        const stats = getStats(matchup.player1_name, matchup.round_num) || {}
        players.push({ id: matchup.player1_id, name: matchup.player1_name, score: parseToday(stats.today) })
      }
      if (matchup.player2_id && matchup.player2_name) {
        const stats = getStats(matchup.player2_name, matchup.round_num) || {}
        players.push({ id: matchup.player2_id, name: matchup.player2_name, score: parseToday(stats.today) })
      }
      if (matchup.player3_id && matchup.player3_name) {
        const stats = getStats(matchup.player3_name, matchup.round_num) || {}
        players.push({ id: matchup.player3_id, name: matchup.player3_name, score: parseToday(stats.today) })
      }
      // Only use players with valid scores
      const validScores: { id: number, name: string, score: number }[] = players.filter((p): p is { id: number, name: string, score: number } => typeof p.score === 'number')
      if (validScores.length < 2) {
        logger.warn('Not enough valid live scores for matchup', { matchupId: matchup.id, validScores })
        continue
      }
      const bestScore: number = Math.min(...validScores.map((p) => p.score))
      const picked = validScores.find((p) => p.id === pick.picked_player_dg_id)
      if (!picked) {
        logger.warn('Picked player not found in matchup', { pickId: pick.id, pickedId: pick.picked_player_dg_id })
        continue
      }
      // Determine outcome using live stats
      let outcome: 'win' | 'loss' | 'push' = 'loss'
      const winners = validScores.filter((p) => p.score === bestScore)
      if (picked.score === bestScore) {
        outcome = winners.length > 1 ? 'push' : 'win'
      }
      logger.info('Settlement debug', { pickId: pick.id, picked: picked.name, pickedScore: picked.score, bestScore, allScores: validScores.map(p => ({ name: p.name, score: p.score })) })
      // 3. Update pick outcome
      const { error: updateError } = await supabase
        .from('parlay_picks')
        .update({ outcome })
        .eq('id', pick.id)
      if (updateError) {
        logger.error('Failed to update pick outcome', { pickId: pick.id, updateError })
        continue
      }
      logger.info('Settled pick', { pickId: pick.id, outcome })
      settled++
      parlayIdsToCheck.add(pick.parlay_id)
    }
    // 4. For each affected parlay, check if all picks are settled and update parlay outcome
    for (const parlayId of parlayIdsToCheck) {
      const { data: picks, error } = await supabase
        .from('parlay_picks')
        .select('outcome')
        .eq('parlay_id', parlayId)
      if (error || !picks) continue
      if (picks.some((p) => p.outcome === 'void')) continue // Still unsettled
      // All picks settled
      const allWin = picks.every((p) => p.outcome === 'win')
      const anyPush = picks.some((p) => p.outcome === 'push')
      let parlayOutcome: 'win' | 'loss' | 'push' = 'loss'
      if (allWin) parlayOutcome = 'win'
      else if (anyPush) parlayOutcome = 'push'
      // TODO: Calculate payout_amount if win
      const { error: parlayError } = await supabase
        .from('parlays')
        .update({ outcome: parlayOutcome })
        .eq('id', parlayId)
      if (!parlayError) updatedParlays++
    }
    return jsonSuccess({ settled, updatedParlays })
  } catch (error) {
    logger.error('Error in settle endpoint', { error })
    return handleApiError(error)
  }
} 
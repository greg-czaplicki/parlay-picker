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
    // 2. For each pick, fetch matchup and determine outcome
    for (const pick of picks) {
      const { data: matchup, error: matchupError } = await supabase
        .from('matchups')
        .select('*')
        .eq('id', pick.matchup_id)
        .single()
      if (matchupError || !matchup) {
        logger.error('Matchup not found for pick', { pickId: pick.id, matchupId: pick.matchup_id })
        continue
      }
      // Gather all players in the matchup
      const playerScores: Array<{ id: number, score: number | null }> = []
      if (matchup.player1_id) playerScores.push({ id: matchup.player1_id, score: matchup.player1_score })
      if (matchup.player2_id) playerScores.push({ id: matchup.player2_id, score: matchup.player2_score })
      if (matchup.player3_id) playerScores.push({ id: matchup.player3_id, score: matchup.player3_score })
      // TODO: Handle 2-ball/3-ball/4-ball dynamically
      // Find best score (lowest)
      const validScores = playerScores.filter(p => typeof p.score === 'number')
      if (validScores.length === 0) {
        logger.warn('No valid scores for matchup', { matchupId: matchup.id })
        continue
      }
      const bestScore = Math.min(...validScores.map(p => p.score!))
      const picked = validScores.find(p => p.id === pick.picked_player_dg_id)
      if (!picked) {
        logger.warn('Picked player not found in matchup', { pickId: pick.id, pickedId: pick.picked_player_dg_id })
        continue
      }
      // Determine outcome
      let outcome: 'win' | 'loss' | 'push' = 'loss'
      const winners = validScores.filter(p => p.score === bestScore)
      if (picked.score === bestScore) {
        outcome = winners.length > 1 ? 'push' : 'win'
      }
      // TODO: Handle DQ, WD, void, etc.
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
      if (picks.some(p => p.outcome === 'void')) continue // Still unsettled
      // All picks settled
      const allWin = picks.every(p => p.outcome === 'win')
      const anyPush = picks.some(p => p.outcome === 'push')
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
/**
 * Formats a player name from "Last, First" to "First Last".
 * @param name Player name string
 * @returns Formatted player name
 */
export function formatPlayerNameDisplay(name: string | null | undefined): string {
  if (!name) return "N/A";
  return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
}

/**
 * Formats a golf score for display (E, +N, or N).
 * @param score Numeric score
 * @returns Formatted score string
 */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return "-";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `-${score}`;
}

/**
 * Calculates parlay player status (win/loss/tied/finished) for display.
 * Pure function version for use in map/render.
 * @param player ParlayPlayer
 * @param selectedRound number | null
 * @returns ParlayStatusResult (with icon as string: 'check', 'x', or null)
 */
export function getParlayStatus(player: ParlayPlayer, selectedRound: number | null): ParlayStatusResult {
  let playerLineStyle = 'font-bold text-primary';
  let playerLineIcon: 'check' | 'x' | null = null;
  let groupContainerStyle = '';
  const groupIsLoadingStats = player.isLoadingStats;

  if (player.matchup && player.liveStats && !player.isLoadingStats && !player.statsError) {
    const p1Id = player.matchup.p1_dg_id;
    const p2Id = player.matchup.p2_dg_id;
    const p3Id = player.matchup.p3_dg_id;

    const p1Stat = p1Id ? player.liveStats[p1Id] : undefined;
    const p2Stat = p2Id ? player.liveStats[p2Id] : undefined;
    const p3Stat = p3Id ? player.liveStats[p3Id] : undefined;

    // Find which player (p1, p2, p3) corresponds to the searched name
    let selectedPlayerId: number | null = null;
    if (p1Id && formatPlayerNameDisplay(player.matchup.p1_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p1Id;
    else if (p2Id && formatPlayerNameDisplay(player.matchup.p2_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p2Id;
    else if (p3Id && formatPlayerNameDisplay(player.matchup.p3_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p3Id;

    const selectedLiveStat = selectedPlayerId ? player.liveStats[selectedPlayerId] : undefined;

    // Check if the stats are relevant for the selected round
    const isP1StatRelevant = !selectedRound || !p1Stat?.round_num || 
      (selectedRound && p1Stat?.round_num && String(p1Stat.round_num) === String(selectedRound));
    const isP2StatRelevant = !selectedRound || !p2Stat?.round_num || 
      (selectedRound && p2Stat?.round_num && String(p2Stat.round_num) === String(selectedRound));
    const isP3StatRelevant = !selectedRound || !p3Stat?.round_num || 
      (selectedRound && p3Stat?.round_num && String(p3Stat.round_num) === String(selectedRound));
    const isSelectedStatRelevant = !selectedRound || !selectedLiveStat?.round_num || 
      (selectedRound && selectedLiveStat?.round_num && String(selectedLiveStat.round_num) === String(selectedRound));

    // If we're viewing a different round than the picks, don't show win/loss styling
    if (selectedRound && player.matchup.round_num !== selectedRound) {
      return { playerLineStyle, playerLineIcon, groupContainerStyle };
    }

    // Ensure all 3 players and the selected player's stats are available for comparison
    if (p1Stat && p2Stat && p3Stat && selectedLiveStat && selectedPlayerId &&
        isP1StatRelevant && isP2StatRelevant && isP3StatRelevant && isSelectedStatRelevant) {
      const scores = [
        isP1StatRelevant ? (p1Stat.today ?? Infinity) : Infinity,
        isP2StatRelevant ? (p2Stat.today ?? Infinity) : Infinity,
        isP3StatRelevant ? (p3Stat.today ?? Infinity) : Infinity,
      ];
      const selectedScore = isSelectedStatRelevant ? (selectedLiveStat.today ?? Infinity) : Infinity;

      const finished = [
        p1Stat.thru === 18 || p1Stat.position === 'F' || p1Stat.position === 'CUT' || p1Stat.position === 'WD',
        p2Stat.thru === 18 || p2Stat.position === 'F' || p2Stat.position === 'CUT' || p2Stat.position === 'WD',
        p3Stat.thru === 18 || p3Stat.position === 'F' || p3Stat.position === 'CUT' || p3Stat.position === 'WD',
      ];
      const selectedFinished = finished[p1Id === selectedPlayerId ? 0 : p2Id === selectedPlayerId ? 1 : 2];
      const allFinished = finished.every(f => f);

      // Find min score, excluding Infinity
      const validScores = scores.filter(s => s !== Infinity);
      const minScore = validScores.length > 0 ? Math.min(...validScores) : Infinity;

      const isWinning = selectedScore === minScore && scores.filter(s => s === minScore).length === 1;
      const isTiedForLead = selectedScore === minScore && scores.filter(s => s === minScore).length > 1;
      const isLosing = selectedScore > minScore;
      const shotsBehind = isLosing ? selectedScore - minScore : 0;

      // Player Line Style & Icon
      if (selectedScore === Infinity) {
        playerLineStyle = 'font-bold text-muted-foreground';
      } else if (allFinished) {
        // Final Result styling (applies to group container too)
        if (isWinning || isTiedForLead) {
          playerLineStyle = 'font-bold text-green-500';
          playerLineIcon = 'check';
          groupContainerStyle = 'border border-green-500/30 bg-green-500/5 rounded-md p-2';
        } else { // Lost and Finished
          playerLineStyle = 'font-bold text-red-500';
          playerLineIcon = 'x';
          groupContainerStyle = 'border border-red-500/30 bg-red-500/5 rounded-md p-2';
        }
      } else {
        // In-Progress Styling (only player line changes color)
        if (isWinning) {
          playerLineStyle = 'font-bold text-green-500';
        } else if (isTiedForLead) {
          playerLineStyle = 'font-bold text-yellow-500';
        } else if (isLosing) {
          if (shotsBehind === 1) {
            playerLineStyle = 'font-bold text-orange-400'; // Losing by 1
          } else { // shotsBehind > 1
            playerLineStyle = 'font-bold text-red-400'; // Losing by 2+ (Lighter Red)
          }
        }
        // Set default padding for in-progress group container
        groupContainerStyle = 'border border-transparent p-2';
      }
    }
  }
  // Ensure default padding if calculated style is empty (e.g., loading)
  if (!groupContainerStyle) {
    groupContainerStyle = 'border border-transparent p-2';
  }
  return { playerLineStyle, playerLineIcon, groupContainerStyle };
}

// TODO: Extract additional helpers (status, error formatting, etc.) 
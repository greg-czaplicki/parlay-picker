import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * SG Heavy Filter
 * For each 3-ball or 2-ball group, returns the player with the highest weighted SG (in-tournament: 0.6*sgTotal+0.4*seasonSgTotal, pre-tournament: seasonSgTotal),
 * and attaches the odds gap to the next lowest odds in the group (decimal odds, for UI to convert to American odds).
 */
export function createSGHeavyFilter(): Filter<any> {
  return {
    id: 'sg-heavy',
    name: 'SG Heavy',
    description: 'For each group, returns the top SG player and the odds gap to the next lowest odds in the group.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
      console.log('SG_HEAVY_DEBUG_FILTER_CALLED');
      const sgGapThreshold = typeof options?.sgGapThreshold === 'number' ? options.sgGapThreshold : 0.5;
      // Determine if in-tournament: if any player has sgTotal > 0
      const inTournament = (data ?? []).some((p: any) => typeof p.sgTotal === 'number' && p.sgTotal > 0);
      // Group by matchupId
      const groups: Record<string, any[]> = {};
      (data ?? []).forEach((player: any) => {
        const groupId = player.matchupId ?? 'ungrouped';
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(player);
      });
      const sgHeavy: any[] = [];
      Object.values(groups).forEach(group => {
        // Log every group for debugging
        console.log('SG_HEAVY_DEBUG_GROUP');
        group.forEach((p: any) => {
          let sgTotalWeighted = 0;
          if (inTournament && typeof p.sgTotal === 'number' && typeof p.seasonSgTotal === 'number') {
            sgTotalWeighted = 0.6 * p.sgTotal + 0.4 * p.seasonSgTotal;
          } else if (inTournament && typeof p.sgTotal === 'number') {
            sgTotalWeighted = p.sgTotal;
          } else if (typeof p.seasonSgTotal === 'number') {
            sgTotalWeighted = p.seasonSgTotal;
          }
          console.log(
            'SG_HEAVY_DEBUG_PLAYER',
            p.name || p.playerName,
            'sgTotal:', p.sgTotal,
            'seasonSgTotal:', p.seasonSgTotal,
            'sgTotalWeighted:', sgTotalWeighted,
            'odds:', p.odds
          );
        });
        // Compute weighted SG for each player
        const withSG = group.map((p: any) => {
          let sgTotalWeighted = 0;
          if (inTournament && typeof p.sgTotal === 'number' && typeof p.seasonSgTotal === 'number') {
            sgTotalWeighted = 0.6 * p.sgTotal + 0.4 * p.seasonSgTotal;
          } else if (inTournament && typeof p.sgTotal === 'number') {
            sgTotalWeighted = p.sgTotal;
          } else if (typeof p.seasonSgTotal === 'number') {
            sgTotalWeighted = p.seasonSgTotal;
          }
          return { ...p, sgTotalWeighted };
        });
        // Sort by weighted SG descending
        withSG.sort((a: any, b: any) => b.sgTotalWeighted - a.sgTotalWeighted);
        const best = withSG[0];
        // Odds gap logic: always use the two lowest odds in the group
        const withOdds = group.filter((p: any) => typeof p.odds === 'number');
        if (withOdds.length < 2) return;
        withOdds.sort((a: any, b: any) => a.odds - b.odds);
        const [fav, next] = withOdds;
        const oddsGap = next.odds - fav.odds;
        // Always attach the odds gap to the top SG player, regardless of their odds
        if (best) {
          sgHeavy.push({
            ...best,
            oddsGapToNext: oddsGap,
            nextBestPlayer: next.name || next.playerName || undefined,
          });
        }
      });
      return { filtered: sgHeavy };
    },
  };
}

// Helper to convert decimal odds to American odds
function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2.0) return Math.round((decimalOdds - 1) * 100);
  else if (decimalOdds > 1.0) return Math.round(-100 / (decimalOdds - 1));
  else return 0;
} 
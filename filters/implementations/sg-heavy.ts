import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * SG Heavy Filter
 * Filters for players with a large SG gap vs. their group, weighted by in-tournament and season stats, with minor odds gap influence.
 */
export function createSGHeavyFilter(): Filter<any> {
  return {
    id: 'sg-heavy',
    name: 'SG Heavy',
    description: 'Filters for players with a large Strokes Gained (SG) gap vs. their group, weighted by in-tournament and season stats, with minor odds gap influence.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
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
        if (withSG.length < 2) return;
        const [best, next] = withSG;
        const sgGap = best.sgTotalWeighted - next.sgTotalWeighted;
        if (sgGap >= sgGapThreshold) {
          // Odds gap (decimal odds, lower is better, so gap is next.odds - best.odds)
          let oddsGap = 0;
          if (typeof best.odds === 'number' && typeof next.odds === 'number') {
            oddsGap = next.odds - best.odds;
          }
          sgHeavy.push({
            ...best,
            sgGapToNext: sgGap,
            oddsGapToNext: oddsGap,
            nextBestPlayer: next.name || next.playerName || undefined,
            nextBestSG: next.sgTotalWeighted,
          });
        }
      });
      // Normalize sgGapToNext and oddsGapToNext for composite score
      const sgGaps = sgHeavy.map(p => p.sgGapToNext);
      const oddsGaps = sgHeavy.map(p => typeof p.oddsGapToNext === 'number' ? p.oddsGapToNext : 0);
      const minSG = Math.min(...sgGaps);
      const maxSG = Math.max(...sgGaps);
      const minOdds = Math.min(...oddsGaps);
      const maxOdds = Math.max(...oddsGaps);
      sgHeavy.forEach(p => {
        const sgNorm = (maxSG - minSG) > 0 ? (p.sgGapToNext - minSG) / (maxSG - minSG) : 1;
        const oddsNorm = (maxOdds - minOdds) > 0 ? (p.oddsGapToNext - minOdds) / (maxOdds - minOdds) : 1;
        p.compositeScore = 0.9 * sgNorm + 0.1 * oddsNorm;
      });
      // Sort by composite score descending
      sgHeavy.sort((a, b) => b.compositeScore - a.compositeScore);
      // Only return the top golfer from each group
      const topByGroup: Record<string, any> = {};
      sgHeavy.forEach(player => {
        const groupId = player.matchupId ?? 'ungrouped';
        if (!topByGroup[groupId] || player.compositeScore > topByGroup[groupId].compositeScore) {
          topByGroup[groupId] = player;
        }
      });
      return { filtered: Object.values(topByGroup) };
    },
  };
} 
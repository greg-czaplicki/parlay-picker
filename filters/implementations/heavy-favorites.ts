import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * Heavy Favorites Filter
 * Filters for players in a group whose odds are at least 40 points (cents) better than the next best in their group.
 * Sorts the heavy favorites by the size of their odds gap (descending).
 */
export function createHeavyFavoritesFilter(): Filter<any> {
  return {
    id: 'heavy-favorites',
    name: 'Heavy Favorites',
    description: 'Filters for players in a group whose odds are at least 40 points better than the next best in their group, sorted by odds gap.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
      console.log('HEAVY_FAVORITES_DEBUG: Starting filter with data length:', data?.length || 0);
      console.log('HEAVY_FAVORITES_DEBUG: Options:', options);
      
      const oddsGap = typeof options?.oddsGap === 'number' ? options.oddsGap : 0.4;
      console.log('HEAVY_FAVORITES_DEBUG: Using oddsGap threshold:', oddsGap);
      
      // Group by matchupId
      const groups: Record<string, any[]> = {};
      (data ?? []).forEach((player: any) => {
        const groupId = player.matchupId ?? 'ungrouped';
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(player);
      });

      
      const heavyFavorites: any[] = [];
      Object.values(groups).forEach((group, groupIndex) => {        
        // Filter out players with null odds
        const withOdds = group.filter((p: any) => typeof p.odds === 'number');
        
        if (withOdds.length < 2) {
          return; // Need at least 2 with odds to compare
        }

        // Sort by odds ascending (lower odds = more favored)
        withOdds.sort((a, b) => a.odds - b.odds);

        // Compare best to next best
        const [fav, next] = withOdds;
        const gap = next.odds - fav.odds;
        
        if (gap >= oddsGap) {
          heavyFavorites.push({
            ...fav,
            oddsGap: gap, // legacy, used for scoring
            oddsGapToNext: gap, // explicit for display
            nextBestPlayer: next.name || next.playerName || undefined, // optional: show who the next best is
            nextBestOdds: next.odds
          });
        } else {
          console.log('HEAVY_FAVORITES_DEBUG: Gap too small, skipping');
        }
      });

      // Sort heavy favorites by oddsGap descending, then SG Total descending, then seasonAvg ascending
      heavyFavorites.sort((a, b) => {
        // 1. Odds gap (desc)
        if (b.oddsGap !== a.oddsGap) return b.oddsGap - a.oddsGap;
        // 2. SG Total (desc, fallback to 0 if missing)
        const sgA = typeof a.sgTotal === 'number' ? a.sgTotal : 0;
        const sgB = typeof b.sgTotal === 'number' ? b.sgTotal : 0;
        if (sgB !== sgA) return sgB - sgA;
        // 3. Season scoring average (asc, fallback to Infinity if missing)
        const avgA = typeof a.seasonAvg === 'number' ? a.seasonAvg : Infinity;
        const avgB = typeof b.seasonAvg === 'number' ? b.seasonAvg : Infinity;
        return avgA - avgB;
      });

      // Weighted scoring: 70% odds gap, 20% SG Total (Tourney), 10% seasonAvg
      // 1. Gather min/max for normalization
      const oddsGaps = heavyFavorites.map(p => p.oddsGap);
      const sgTotals = heavyFavorites.map(p => typeof p.sgTotal === 'number' ? p.sgTotal : 0);
      const seasonAvgs = heavyFavorites.map(p => typeof p.seasonAvg === 'number' ? p.seasonAvg : Infinity);
      const minOddsGap = Math.min(...oddsGaps);
      const maxOddsGap = Math.max(...oddsGaps);
      const minSG = Math.min(...sgTotals);
      const maxSG = Math.max(...sgTotals);
      const minAvg = Math.min(...seasonAvgs);
      const maxAvg = Math.max(...seasonAvgs);

      // 2. Compute composite score for each player
      heavyFavorites.forEach(p => {
        // Odds Gap normalization (0-1, higher is better)
        const oddsGapNorm = (maxOddsGap - minOddsGap) > 0 ? (p.oddsGap - minOddsGap) / (maxOddsGap - minOddsGap) : 1;
        // SG Total normalization (0-1, higher is better)
        const sg = typeof p.sgTotal === 'number' ? p.sgTotal : 0;
        const sgNorm = (maxSG - minSG) > 0 ? (sg - minSG) / (maxSG - minSG) : 1;
        // Season Avg normalization (0-1, higher is better, no inversion)
        const avg = typeof p.seasonAvg === 'number' ? p.seasonAvg : maxAvg;
        const avgNorm = (maxAvg - minAvg) > 0 ? (avg - minAvg) / (maxAvg - minAvg) : 1;
        // Weighted score
        p.compositeScore = 0.7 * oddsGapNorm + 0.2 * sgNorm + 0.1 * avgNorm;
      });

      // 3. Sort by composite score descending
      heavyFavorites.sort((a, b) => b.compositeScore - a.compositeScore);

      return { filtered: heavyFavorites };
    },
  };
} 
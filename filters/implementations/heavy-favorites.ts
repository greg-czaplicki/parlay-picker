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
      const oddsGap = typeof options?.oddsGap === 'number' ? options.oddsGap : 0.4;
      // Group by matchupId
      const groups: Record<string, any[]> = {};
      (data ?? []).forEach((player: any) => {
        const groupId = player.matchupId ?? 'ungrouped';
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(player);
      });

      const heavyFavorites: any[] = [];
      Object.values(groups).forEach(group => {
        // Filter out players with null odds
        const withOdds = group.filter((p: any) => typeof p.odds === 'number');
        if (withOdds.length < 2) return; // Need at least 2 with odds to compare

        // Sort by odds ascending (lower odds = more favored)
        withOdds.sort((a, b) => a.odds - b.odds);

        // Compare best to next best
        const [fav, next] = withOdds;
        const gap = next.odds - fav.odds;
        if (gap >= oddsGap) {
          heavyFavorites.push({ ...fav, oddsGap: gap });
        }
      });

      // Sort heavy favorites by oddsGap descending
      heavyFavorites.sort((a, b) => b.oddsGap - a.oddsGap);

      return { filtered: heavyFavorites };
    },
  };
} 
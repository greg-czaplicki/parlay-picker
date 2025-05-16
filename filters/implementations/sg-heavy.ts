import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * SG Heavy Filter
 * Filters for players or matchups that are Strokes Gained (SG) stat-heavy.
 * Example: Players with high sgTotal or related SG metrics.
 */
export function createSGHeavyFilter(): Filter<any> {
  return {
    id: 'sg-heavy',
    name: 'SG Heavy',
    description: 'Filters for players/matchups with high Strokes Gained (SG) statistics.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
      // Example: Filter for players with sgTotal above a threshold (default: 1.5)
      const threshold = typeof options?.sgTotalThreshold === 'number' ? options.sgTotalThreshold : 1.5;
      const filtered = (data ?? []).filter((d: any) => typeof d.sgTotal === 'number' && d.sgTotal >= threshold);
      return { filtered };
    },
  };
} 
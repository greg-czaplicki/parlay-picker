import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * SG Value Filter
 * Identifies value picks for Strokes Gained (SG) players based on valueRating and odds.
 * Example: Players with high valueRating and reasonable odds.
 */
export function createSGValueFilter(): Filter<any> {
  return {
    id: 'sg-value',
    name: 'SG Value',
    description: 'Identifies value picks for Strokes Gained (SG) players based on performance metrics.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
      // Example: Filter for players with valueRating >= 7 and odds between +100 and +300
      const minValue = typeof options?.minValueRating === 'number' ? options.minValueRating : 7;
      const minOdds = typeof options?.minOdds === 'number' ? options.minOdds : 100;
      const maxOdds = typeof options?.maxOdds === 'number' ? options.maxOdds : 300;
      const filtered = (data ?? []).filter((d: any) =>
        typeof d.valueRating === 'number' && d.valueRating >= minValue &&
        typeof d.odds === 'number' && d.odds >= minOdds && d.odds <= maxOdds
      );
      return { filtered };
    },
  };
} 
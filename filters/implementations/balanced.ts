import { Filter, FilterCategory, FilterOptions, FilterResult } from '../types';

/**
 * Balanced Filter
 * Identifies players or matchups with balanced statistics across key categories.
 * Example: Players whose stats do not deviate significantly from the mean in any category.
 */
export function createBalancedFilter(): Filter<any> {
  return {
    id: 'balanced',
    name: 'Balanced',
    description: 'Filters for players/matchups with balanced statistics across categories.',
    category: FilterCategory.PLAYER,
    applyFilter: (data, options?: FilterOptions): FilterResult<any> => {
      // Example: Filter for players whose stats are within 1 stddev of the mean for all categories
      if (!Array.isArray(data) || data.length === 0) return { filtered: [] };
      // Assume each item has numeric fields: sgTotal, putting, driving, approach
      const keys = ['sgTotal', 'putting', 'driving', 'approach'];
      const means: Record<string, number> = {};
      const stddevs: Record<string, number> = {};
      keys.forEach(key => {
        const vals = data.map((d: any) => d[key]).filter((v: number) => typeof v === 'number');
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length);
        means[key] = mean;
        stddevs[key] = std;
      });
      const filtered = data.filter((d: any) =>
        keys.every(key => {
          const v = d[key];
          return typeof v === 'number' && Math.abs(v - means[key]) <= stddevs[key];
        })
      );
      return { filtered };
    },
  };
} 
import { FilterService } from './filter-service';
import { createBalancedFilter, createSGHeavyFilter, createSGValueFilter, createHeavyFavoritesFilter } from './implementations';

/**
 * Registers all core filter implementations with the FilterService singleton.
 * Call this function at app startup.
 */
export function registerCoreFilters() {
  const service = FilterService.getInstance();
  service.registerFilter(createBalancedFilter());
  service.registerFilter(createSGHeavyFilter());
  service.registerFilter(createSGValueFilter());
  service.registerFilter(createHeavyFavoritesFilter());
} 
import { Filter, FilterCategory, FilterOptions, FilterResult } from './types';

export class FilterService {
  private static instance: FilterService;
  private filters: Map<string, Filter> = new Map();

  private constructor() {}

  static getInstance(): FilterService {
    if (!FilterService.instance) {
      FilterService.instance = new FilterService();
    }
    return FilterService.instance;
  }

  registerFilter(filter: Filter): void {
    this.filters.set(filter.id, filter);
  }

  getFilters(): Filter[] {
    return Array.from(this.filters.values());
  }

  getFiltersByCategory(category: FilterCategory): Filter[] {
    return this.getFilters().filter(f => f.category === category);
  }

  getFilterById(id: string): Filter | undefined {
    return this.filters.get(id);
  }
} 
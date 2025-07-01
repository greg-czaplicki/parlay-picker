export enum FilterCategory {
  PLAYER = 'PLAYER',
  TEAM = 'TEAM',
  MATCHUP = 'MATCHUP',
  CUSTOM = 'CUSTOM',
}

export interface FilterOptions {
  [key: string]: unknown;
}

export type FilterResult<T> = {
  filtered: T[];
  meta?: Record<string, unknown>;
};

export interface Filter<T = any, R = T> {
  id: string;
  name: string;
  description: string;
  category: FilterCategory;
  applyFilter: (data: T[], options?: FilterOptions) => FilterResult<R> | Promise<FilterResult<R>>;
} 
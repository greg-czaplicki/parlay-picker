// Core trend types
export interface PlayerTrend {
  id?: number;
  dg_id: bigint;
  player_name: string;
  trend_type: TrendType;
  trend_value: number;
  trend_period: TrendPeriod;
  trend_category: TrendCategory;
  context_data?: any;
  calculated_at: string;
  valid_until?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TournamentResult {
  id?: number;
  dg_id: bigint;
  player_name: string;
  event_id: number;
  event_name: string;
  start_date: string;
  end_date?: string;
  finish_position?: number;
  total_score?: number;
  missed_cut: boolean;
  rounds_played: number;
  round_scores?: number[];
  created_at?: string;
  updated_at?: string;
}

// Trend type definitions
export type TrendType = 
  | 'top_10_streak'
  | 'top_5_frequency' 
  | 'top_3_frequency'
  | 'missed_cut_streak'
  | 'sub_70_tournaments'
  | 'sub_70_rounds_percentage'
  | 'scoring_average'
  | 'scoring_consistency'
  | 'scoring_volatility'
  | 'positive_momentum'
  | 'negative_momentum'
  | 'cut_making_consistency'
  | 'weekend_performance'
  | 'course_fit_trend'
  | 'distance_trend'
  | 'accuracy_trend';

export type TrendCategory = 'hot' | 'cold' | 'consistent' | 'volatile';

export type TrendPeriod = 'last_3' | 'last_5' | 'last_10' | 'season';

// UI component types
export interface TrendDefinition {
  name: string;
  description: string;
  category_type: 'performance' | 'scoring' | 'consistency' | 'momentum';
  hot_threshold?: number;
  cold_threshold?: number;
  good_threshold?: number;
  icon: string;
}

export interface CategoryDefinition {
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface PeriodDefinition {
  name: string;
  description: string;
}

export interface TrendCategoriesResponse {
  success: boolean;
  data: {
    trend_types: Record<string, TrendDefinition>;
    categories: Record<string, CategoryDefinition>;
    periods: Record<string, PeriodDefinition>;
    summary: TrendSummaryItem[];
    available_data: {
      trend_types: string[];
      categories: string[];
      periods: string[];
    };
  };
}

export interface TrendSummaryItem {
  trend_category: string;
  trend_type: string;
  trend_period: string;
  count: number;
  avg_value: number;
  max_value: number;
}

// API response types
export interface TrendsResponse {
  success: boolean;
  data: PlayerTrendGroup[];
  filters: {
    category: string;
    period: string;
    type?: string;
    limit: number;
  };
}

export interface PlayerTrendGroup {
  dg_id: bigint;
  player_name: string;
  trends: {
    type: string;
    value: number;
    category: string;
    context?: any;
    calculated_at: string;
  }[];
}

// Filter and query types
export interface TrendsFilters {
  category: string;
  period: string;
  type?: string;
  limit: number;
}

export interface TrendsCalculationRequest {
  recalculate: boolean;
  period?: string;
  players?: number[]; // Optional: specific players to calculate
  trend_types?: TrendType[]; // Optional: specific trend types
}

// ML export types
export interface MLDataRecord {
  // Identifiers
  dg_id: bigint;
  player_name: string;
  
  // Binary trend indicators
  has_top_10_streak: 0 | 1;
  has_top_5_frequency: 0 | 1;
  has_missed_cut_streak: 0 | 1;
  has_sub_70_tournaments: 0 | 1;
  has_positive_momentum: 0 | 1;
  has_negative_momentum: 0 | 1;
  has_scoring_consistency: 0 | 1;
  has_scoring_volatility: 0 | 1;
  
  // Numerical trend values
  top_10_streak_value: number;
  top_5_frequency_value: number;
  missed_cut_streak_value: number;
  sub_70_tournaments_value: number;
  positive_momentum_value: number;
  negative_momentum_value: number;
  scoring_consistency_value: number;
  scoring_volatility_value: number;
  scoring_average?: number;
  
  // Category encodings
  is_hot_player: 0 | 1;
  is_cold_player: 0 | 1;
  is_consistent_player: 0 | 1;
  is_volatile_player: 0 | 1;
  
  // Recent performance
  recent_tournaments_played: number;
  recent_top_10s: number;
  recent_top_5s: number;
  recent_top_3s: number;
  recent_missed_cuts: number;
  recent_avg_score?: number;
  recent_best_score?: number;
  recent_worst_score?: number;
  recent_score_volatility?: number;
  
  // Season skills
  season_sg_total?: number;
  season_sg_ott?: number;
  season_sg_app?: number;
  season_sg_arg?: number;
  season_sg_putt?: number;
  season_driving_acc?: number;
  season_driving_dist?: number;
  
  // Derived features
  top_10_rate: number;
  cut_making_rate: number;
  trend_diversity: number;
  
  // Metadata
  calculated_at: string;
  trend_contexts?: any; // Optional context data
}

export interface MLExportResponse {
  success: boolean;
  data: MLDataRecord[];
  metadata: {
    total_players: number;
    total_trends: number;
    period: string;
    generated_at: string;
    feature_columns: string[];
    trend_types: string[];
  };
}

// Validation and error types
export interface TrendValidationError {
  field: string;
  message: string;
  code: string;
}

export interface TrendCalculationResult {
  success: boolean;
  trends_calculated?: number;
  players_processed?: number;
  errors?: TrendValidationError[];
  message?: string;
}

// Component prop types
export interface TrendCardProps {
  playerTrend: PlayerTrendGroup;
  categories?: Record<string, CategoryDefinition>;
  trendTypes?: Record<string, TrendDefinition>;
  onClick?: (playerId: number) => void;
}

export interface TrendsFiltersProps {
  filters: TrendsFilters;
  onFilterChange: (filters: Partial<TrendsFilters>) => void;
  categories?: TrendCategoriesResponse['data'];
  onRecalculate: () => void;
  isRecalculating: boolean;
}

export interface TrendsStatsProps {
  summary: TrendSummaryItem[];
  period: string;
}

// Utility types
export type TrendValueFormatter = (type: TrendType, value: number) => string;
export type TrendIconGetter = (type: TrendType) => string;
export type CategoryColorGetter = (category: TrendCategory) => string;
/**
 * Course DNA Profiling Types
 * Interfaces for analyzing course-specific SG patterns and characteristics
 */

// Core SG categories for analysis
export type SGCategory = 'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt' | 'sg_total' | 'sg_t2g';

// Course DNA profile representing what skills each course rewards
export interface CourseDNAProfile {
  event_name: string;
  course_name?: string;
  
  // Core SG category importance (0-100 percentage)
  sg_category_weights: {
    sg_ott: number;      // Off the tee importance
    sg_app: number;      // Approach importance
    sg_arg: number;      // Around the green importance
    sg_putt: number;     // Putting importance
  };
  
  // Statistical significance
  total_rounds_analyzed: number;
  tournaments_analyzed: number;
  years_analyzed: number;
  confidence_score: number; // 0-1, higher = more reliable
  
  // Performance correlations
  winning_sg_thresholds: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  // Round-by-round patterns
  round_importance: {
    round1: number;   // How much R1 performance predicts success
    round2: number;   // Cut line importance
    round3: number;   // Moving day impact
    round4: number;   // Closing ability
  };
  
  // Course characteristics
  course_type: 'links' | 'parkland' | 'desert' | 'mountain' | 'resort' | 'unknown';
  difficulty_rating: number; // 1-10 scale
  weather_impact: 'high' | 'medium' | 'low';
  
  // Metadata
  last_updated: string;
  created_at: string;
}

// Historical analysis for a specific course
export interface CourseHistoricalAnalysis {
  event_name: string;
  year: number;
  
  // Winner and top performers analysis
  winner_sg_signature: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  top10_avg_sg: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  field_avg_sg: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  // What separated winners from field
  key_differentiators: SGCategory[];
  
  // Cut line analysis
  cut_line_sg_requirements: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
}

// Player archetype based on SG signature
export interface PlayerSGArchetype {
  archetype_name: string;
  description: string;
  
  // SG signature pattern (z-scores relative to tour average)
  sg_signature: {
    sg_ott: number;    // Standard deviations from tour avg
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
  };
  
  // Archetypal characteristics
  primary_strength: SGCategory;
  secondary_strength?: SGCategory;
  primary_weakness?: SGCategory;
  
  // Course fit predictions
  ideal_course_types: string[];
  challenging_course_types: string[];
  
  // Player examples
  example_players: Array<{
    dg_id: bigint;
    player_name: string;
    fit_score: number; // 0-1, how well they match archetype
  }>;
}

// Course fit analysis for a specific player
export interface PlayerCourseFit {
  dg_id: bigint;
  player_name: string;
  event_name: string;
  
  // Overall fit score (0-100)
  fit_score: number;
  fit_grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F';
  
  // Category-specific fit
  category_fit: {
    sg_ott: {
      player_strength: number;    // Player's SG relative to tour
      course_importance: number;  // How much course rewards this
      fit_contribution: number;   // How this category helps/hurts fit
    };
    sg_app: {
      player_strength: number;
      course_importance: number;
      fit_contribution: number;
    };
    sg_arg: {
      player_strength: number;
      course_importance: number;
      fit_contribution: number;
    };
    sg_putt: {
      player_strength: number;
      course_importance: number;
      fit_contribution: number;
    };
  };
  
  // Historical performance at this course/event
  historical_results: Array<{
    year: number;
    finish_position: number | null;
    sg_performance: {
      sg_ott: number;
      sg_app: number;
      sg_arg: number;
      sg_putt: number;
      sg_total: number;
    };
  }>;
  
  // Prediction metrics
  predicted_finish_range: {
    optimistic: number;   // Top 25% scenario
    realistic: number;    // Expected finish
    pessimistic: number;  // Bottom 25% scenario
  };
  
  confidence_level: number; // 0-1, based on data quality and consistency
}

// Course similarity analysis
export interface CourseSimilarity {
  course_a: string;
  course_b: string;
  similarity_score: number; // 0-1, higher = more similar
  
  // What makes them similar
  shared_characteristics: string[];
  
  // SG correlation matrix
  sg_correlations: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
  };
  
  // Player performance correlation
  player_performance_correlation: number; // Do same players succeed at both?
}

// Real-time SG momentum during tournaments
export interface SGMomentumIndicator {
  dg_id: bigint;
  player_name: string;
  event_name: string;
  current_round: number;
  
  // Current momentum in each category
  momentum_indicators: {
    sg_ott: {
      current_trend: 'hot' | 'cold' | 'steady';
      trend_strength: number; // 0-1
      rounds_trending: number;
      vs_baseline: number; // How much above/below player's typical
    };
    sg_app: {
      current_trend: 'hot' | 'cold' | 'steady';
      trend_strength: number;
      rounds_trending: number;
      vs_baseline: number;
    };
    sg_arg: {
      current_trend: 'hot' | 'cold' | 'steady';
      trend_strength: number;
      rounds_trending: number;
      vs_baseline: number;
    };
    sg_putt: {
      current_trend: 'hot' | 'cold' | 'steady';
      trend_strength: number;
      rounds_trending: number;
      vs_baseline: number;
    };
  };
  
  // Overall momentum score
  overall_momentum: number; // -3 to +3, positive = gaining strokes
  momentum_direction: 'accelerating' | 'maintaining' | 'decelerating';
  
  // Alerts
  significant_changes: Array<{
    category: SGCategory;
    change_type: 'breakthrough' | 'breakdown' | 'return_to_form';
    magnitude: number;
    since_round: number;
  }>;
}

// API response types
export interface CourseDNAApiResponse {
  success: boolean;
  data: CourseDNAProfile;
  metadata: {
    last_updated: string;
    data_freshness: 'very_fresh' | 'fresh' | 'stale' | 'very_stale';
    confidence_level: 'high' | 'medium' | 'low';
  };
}

export interface PlayerCourseFitApiResponse {
  success: boolean;
  data: PlayerCourseFit;
  comparisons: Array<{
    similar_player: string;
    similar_fit_score: number;
    historical_performance: string;
  }>;
}

export interface SGMomentumApiResponse {
  success: boolean;
  data: SGMomentumIndicator[];
  tournament_context: {
    event_name: string;
    current_round: number;
    field_avg_momentum: number;
    hot_categories: SGCategory[];
    cold_categories: SGCategory[];
  };
} 
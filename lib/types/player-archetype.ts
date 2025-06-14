/**
 * Player Archetype Classification Types
 * Interfaces for categorizing players based on their Strokes Gained patterns
 */

export type SGCategory = 'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt' | 'sg_total';

// Core player archetype definitions
export interface PlayerArchetype {
  archetype_id: string;
  archetype_name: string;
  description: string;
  
  // SG signature pattern (relative to tour average)
  sg_signature: {
    sg_ott: {
      importance: number;     // 0-100, how important this category is for archetype 
      threshold: number;      // SG value threshold for classification
      weight: number;         // Weight in classification algorithm
    };
    sg_app: {
      importance: number;
      threshold: number;
      weight: number;
    };
    sg_arg: {
      importance: number;
      threshold: number;
      weight: number;
    };
    sg_putt: {
      importance: number;
      threshold: number;
      weight: number;
    };
  };
  
  // Archetype characteristics
  primary_strength: SGCategory;
  secondary_strength?: SGCategory;
  primary_weakness?: SGCategory;
  
  // Performance patterns
  typical_strengths: string[];
  typical_weaknesses: string[];
  ideal_conditions: string[];
  challenging_conditions: string[];
  
  // Course preferences
  preferred_course_types: string[];
  avoided_course_types: string[];
}

// Player classification result
export interface PlayerArchetypeClassification {
  dg_id: number;
  player_name: string;
  
  // Primary archetype
  primary_archetype: {
    archetype_id: string;
    archetype_name: string;
    confidence: number;         // 0-100, how confident we are in this classification
    fit_score: number;          // 0-100, how well player matches this archetype
    match_strength: 'strong' | 'moderate' | 'weak';
  };
  
  // Secondary archetype (if hybrid)
  secondary_archetype?: {
    archetype_id: string;
    archetype_name: string;
    confidence: number;
    fit_score: number;
    match_strength: 'strong' | 'moderate' | 'weak';
  };
  
  // Player's actual SG signature
  sg_signature: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  // Relative to tour average (z-scores)
  sg_relative_to_tour: {
    sg_ott: number;
    sg_app: number;
    sg_arg: number;
    sg_putt: number;
    sg_total: number;
  };
  
  // Performance metrics
  performance_metrics: {
    consistency_score: number;    // 0-100, how consistent across categories
    volatility_score: number;     // 0-100, how much performance varies
    improvement_trend: 'improving' | 'stable' | 'declining';
    peak_performance_category: SGCategory;
    weakness_category: SGCategory;
  };
  
  // Peer comparisons
  similar_players: Array<{
    dg_id: number;
    player_name: string;
    similarity_score: number;    // 0-100, how similar SG patterns are
    shared_archetype: string;
  }>;
  
  // Historical context
  historical_performance: {
    best_finishes: Array<{
      event_name: string;
      year: number;
      finish_position: number;
      sg_performance: {
        sg_ott: number;
        sg_app: number;
        sg_arg: number;
        sg_putt: number;
        sg_total: number;
      };
    }>;
    course_fit_examples: Array<{
      course_type: string;
      avg_finish: number;
      fit_explanation: string;
    }>;
  };
  
  // Analysis metadata
  analysis_metadata: {
    rounds_analyzed: number;
    tournaments_analyzed: number;
    years_analyzed: number;
    data_freshness: 'very_fresh' | 'fresh' | 'stale' | 'very_stale';
    last_updated: string;
    confidence_factors: string[];
  };
}

// Predefined archetype templates
export interface ArchetypeTemplate {
  archetype_id: string;
  name: string;
  description: string;
  key_characteristics: string[];
  
  // SG pattern requirements
  sg_requirements: {
    sg_ott: { min?: number; max?: number; importance: number };
    sg_app: { min?: number; max?: number; importance: number };
    sg_arg: { min?: number; max?: number; importance: number };
    sg_putt: { min?: number; max?: number; importance: number };
  };
  
  // Example players
  example_players: string[];
  typical_course_success: string[];
}

// API response types
export interface PlayerArchetypeApiResponse {
  success: boolean;
  data: PlayerArchetypeClassification;
  available_archetypes: Array<{
    archetype_id: string;
    archetype_name: string;
    description: string;
    example_players: string[];
  }>;
  meta: {
    endpoint: string;
    version: string;
    processing_time_ms: number;
    parameters: {
      player_id: string;
      include_historical: boolean;
      include_peers: boolean;
    };
  };
}

export interface ArchetypeListApiResponse {
  success: boolean;
  data: PlayerArchetype[];
  meta: {
    total_archetypes: number;
    last_updated: string;
  };
}

// Batch analysis types
export interface BatchArchetypeAnalysis {
  event_name?: string;
  archetype_breakdown: Array<{
    archetype_name: string;
    player_count: number;
    avg_sg_total: number;
    typical_finish_range: {
      top_10_percentage: number;
      top_25_percentage: number;
      missed_cut_percentage: number;
    };
  }>;
  
  field_analysis: {
    most_common_archetype: string;
    most_successful_archetype: string;
    archetype_diversity_score: number; // 0-100, higher = more diverse field
  };
  
  predictions: Array<{
    archetype_name: string;
    expected_performance: string;
    risk_factors: string[];
    opportunity_factors: string[];
  }>;
} 
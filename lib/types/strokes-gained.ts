/**
 * Strokes Gained Calculation Types
 * Core types for the SG analysis engine
 */

// Shot categories for SG analysis
export type SGCategory = 'OTT' | 'APP' | 'ARG' | 'PUTT';

// Lie types for shot classification
export type LieType = 'tee' | 'fairway' | 'rough' | 'bunker' | 'green' | 'fringe' | 'hazard';

// Shot outcome data
export interface ShotOutcome {
  endDistance: number;        // Distance to hole after shot (yards)
  endLie: LieType;           // Where the ball ended up
  holed: boolean;            // Did the shot go in the hole?
  penalty: boolean;          // Was there a penalty stroke?
}

// Input data for a single shot SG calculation
export interface ShotData {
  startDistance: number;      // Distance to hole before shot (yards)
  startLie: LieType;         // Starting lie type
  outcome: ShotOutcome;      // What happened with the shot
  category?: SGCategory;     // Override category classification
}

// Baseline performance data for SG calculations
export interface SGBaseline {
  distance: number;          // Distance to hole (yards)
  lie: LieType;             // Lie type
  expectedStrokes: number;   // Expected strokes to hole from this position
  holingPercentage?: number; // Probability of holing from this distance
}

// Result of a single SG calculation
export interface SGResult {
  category: SGCategory;      // Which SG category this belongs to
  strokesGained: number;     // Strokes gained value
  startExpected: number;     // Expected strokes from start position
  endExpected: number;       // Expected strokes from end position
  shotTaken: number;         // Number of strokes taken (usually 1)
}

// Aggregated SG results for a round/tournament
export interface SGSummary {
  total: number;             // Total strokes gained
  OTT: number;              // Strokes gained off the tee
  APP: number;              // Strokes gained approach
  ARG: number;              // Strokes gained around the green
  PUTT: number;             // Strokes gained putting
  shotsAnalyzed: number;    // Number of shots included
}

// Course-specific baseline adjustments
export interface CourseAdjustment {
  courseId: string;
  courseName: string;
  difficultyFactor: number;  // Course difficulty multiplier
  categoryAdjustments: {
    OTT: number;             // Course-specific OTT adjustment
    APP: number;             // Course-specific APP adjustment
    ARG: number;             // Course-specific ARG adjustment
    PUTT: number;            // Course-specific PUTT adjustment
  };
}

// Weather/conditions impact on SG
export interface ConditionsAdjustment {
  windSpeed: number;         // Wind speed in mph
  precipitation: boolean;    // Is it raining?
  temperature: number;       // Temperature in Fahrenheit
  adjustmentFactor: number;  // Overall difficulty adjustment
}

// Player archetype based on SG patterns
export interface PlayerArchetype {
  playerId: string;
  playerName: string;
  archetype: 'bomber' | 'precision' | 'scrambler' | 'putter' | 'balanced';
  sgSignature: {
    OTT: number;             // Relative strength in OTT
    APP: number;             // Relative strength in APP
    ARG: number;             // Relative strength in ARG
    PUTT: number;            // Relative strength in PUTT
  };
  confidenceScore: number;   // How confident is the classification (0-1)
}

// Configuration for SG calculations
export interface SGConfig {
  baselineSource: 'pga_tour' | 'scratch' | 'custom';
  useConditionsAdjustment: boolean;
  useCourseAdjustment: boolean;
  minShotsForCalculation: number;
  roundingPrecision: number;
}

// Error types for SG calculations
export interface SGError {
  code: 'INVALID_SHOT_DATA' | 'MISSING_BASELINE' | 'CALCULATION_ERROR';
  message: string;
  shotData?: ShotData;
} 
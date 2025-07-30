// Matchup-relative filter types for comparing players within betting groups

export type FilterPreset = 'fade-chalk' | 'stat-dom' | 'coin-flip' | 'form-play' | 'value';

export interface MatchupRelativeFilters {
  // Odds comparisons
  minOddsGap?: number; // Minimum cents difference between players
  showOddsSgMismatch?: boolean; // Show where favorite has worse SG than underdog
  maxOddsSpread?: number; // Maximum spread for "even" matchups
  showDgFdDisagreement?: boolean; // DataGolf vs FanDuel odds ranking differs
  
  // SG comparisons within matchup  
  sgTotalGapMin?: number; // Minimum SG Total difference between best/worst
  sgCategoryDominance?: number; // Minimum categories one player must lead (1-4)
  sgPuttGapMin?: number; // Minimum putting advantage threshold
  sgBallStrikingGapMin?: number; // Minimum T2G/OTT advantage
  sgAppGapMin?: number; // Minimum approach advantage
  
  // Form/position comparisons
  positionGapMin?: number; // Minimum leaderboard position difference
  scoreGapToday?: number; // Minimum today's score difference
  showPositionMismatch?: boolean; // Lower ranked player is favored
  
  // Quick preset selection
  preset?: FilterPreset;
  
  // Filter combination logic
  requireAll?: boolean; // AND vs OR logic for multiple filters
}

export interface MatchupFilterState extends MatchupRelativeFilters {
  isActive: boolean;
  activeFilterCount: number;
}

export interface FilterBadge {
  type: 'odds-gap' | 'sg-mismatch' | 'sg-leader' | 'stat-dom' | 'putting-edge' | 'ball-striking' | 'form';
  label: string;
  value?: string | number;
  color?: 'green' | 'yellow' | 'red' | 'blue';
}

export interface MatchupAnalysisResult {
  passesFilters: boolean;
  badges: FilterBadge[];
  highlightPlayer?: string; // Player to highlight based on filter match
}

// Filter configuration for UI
export interface FilterConfig {
  id: keyof MatchupRelativeFilters;
  label: string;
  description: string;
  type: 'slider' | 'toggle' | 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue?: number | boolean;
  category: 'odds' | 'performance' | 'form';
}

export const FILTER_CONFIGS: FilterConfig[] = [
  // Odds filters
  {
    id: 'minOddsGap',
    label: 'Minimum Odds Gap',
    description: 'Show matchups where one player has significantly better odds',
    type: 'slider',
    min: 0.01,
    max: 1.0,
    step: 0.01,
    unit: 'pts',
    defaultValue: 0.4,
    category: 'odds'
  },
  {
    id: 'showOddsSgMismatch',
    label: 'Odds/SG Mismatch',
    description: 'Favorite has worse strokes gained than underdog',
    type: 'toggle',
    defaultValue: false,
    category: 'odds'
  },
  {
    id: 'maxOddsSpread',
    label: 'Even Matchups Only',
    description: 'Maximum odds spread to show "coin flip" matchups',
    type: 'slider',
    min: 10,
    max: 50,
    step: 5,
    unit: '¢',
    defaultValue: 20,
    category: 'odds'
  },
  {
    id: 'showDgFdDisagreement',
    label: 'DG/FD Disagreement',
    description: 'DataGolf and FanDuel rank players differently',
    type: 'toggle',
    defaultValue: false,
    category: 'odds'
  },
  
  // Performance filters
  {
    id: 'sgTotalGapMin',
    label: 'SG Total Gap',
    description: 'Minimum strokes gained advantage',
    type: 'slider',
    min: 0.2,
    max: 2.0,
    step: 0.1,
    defaultValue: 0.5,
    category: 'performance'
  },
  {
    id: 'sgCategoryDominance',
    label: 'Category Dominance',
    description: 'Player leads in X categories (Putt/App/Arg/OTT)',
    type: 'slider',
    min: 2,
    max: 4,
    step: 1,
    defaultValue: 3,
    category: 'performance'
  },
  {
    id: 'sgPuttGapMin',
    label: 'Putting Edge',
    description: 'Minimum SG Putting advantage',
    type: 'slider',
    min: 0.1,
    max: 1.0,
    step: 0.1,
    defaultValue: 0.3,
    category: 'performance'
  },
  {
    id: 'sgBallStrikingGapMin',
    label: 'Ball Striking Edge',
    description: 'Minimum SG T2G/OTT advantage',
    type: 'slider',
    min: 0.2,
    max: 2.0,
    step: 0.1,
    defaultValue: 0.5,
    category: 'performance'
  },
  
  // Form filters
  {
    id: 'positionGapMin',
    label: 'Position Gap',
    description: 'Minimum leaderboard position difference',
    type: 'number',
    min: 5,
    max: 50,
    defaultValue: 10,
    category: 'form'
  },
  {
    id: 'scoreGapToday',
    label: "Today's Score Gap",
    description: 'Minimum score difference today',
    type: 'slider',
    min: 1,
    max: 5,
    step: 1,
    defaultValue: 2,
    category: 'form'
  },
  {
    id: 'showPositionMismatch',
    label: 'Position Mismatch',
    description: 'Lower ranked player is betting favorite',
    type: 'toggle',
    defaultValue: false,
    category: 'form'
  }
];

export const FILTER_PRESETS: Record<FilterPreset, Partial<MatchupRelativeFilters>> = {
  'fade-chalk': {
    showOddsSgMismatch: true,
    showPositionMismatch: true
  },
  'stat-dom': {
    sgCategoryDominance: 2,
    sgTotalGapMin: 0.3
  },
  'coin-flip': {
    maxOddsSpread: 30,
    sgTotalGapMin: 0.2
  },
  'form-play': {
    showPositionMismatch: true,
    scoreGapToday: 2
  },
  'value': {
    minOddsGap: 0.05, // 5 points in decimal format (0.05)
    showDgFdDisagreement: true
  }
};
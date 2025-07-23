// Types for PGA Tour stats scraping

export interface PgaTourPlayer {
  playerId: string;  // PGA Tour player ID
  playerName: string;
  country?: string;
}

export interface StrokesGainedStats {
  sgTotal: number | null;
  sgOtt: number | null;
  sgApp: number | null;
  sgArg: number | null;
  sgPutt: number | null;
  drivingAccuracy: number | null;
  drivingDistance: number | null;
}

export interface PlayerStats extends PgaTourPlayer, StrokesGainedStats {
  lastUpdated: string;  // ISO date string
}

// Stats categories to scrape from PGA Tour
export enum StatsCategory {
  SG_TOTAL = 'SG_TOTAL',
  SG_OTT = 'SG_OTT',
  SG_APP = 'SG_APP', 
  SG_ARG = 'SG_ARG',
  SG_PUTT = 'SG_PUTT',
  DRIVING_ACCURACY = 'DRIVING_ACCURACY',
  DRIVING_DISTANCE = 'DRIVING_DISTANCE'
}

// Map of stats categories to their PGA Tour URL paths
export const statsCategoryUrls: Record<StatsCategory, string> = {
  // Specific format: detail/statId URLs (recommended by user)
  [StatsCategory.SG_TOTAL]: 'https://www.pgatour.com/stats/detail/02675',
  [StatsCategory.SG_OTT]: 'https://www.pgatour.com/stats/detail/02567',
  [StatsCategory.SG_APP]: 'https://www.pgatour.com/stats/detail/02568',
  [StatsCategory.SG_ARG]: 'https://www.pgatour.com/stats/detail/02569',
  [StatsCategory.SG_PUTT]: 'https://www.pgatour.com/stats/detail/02564',
  [StatsCategory.DRIVING_ACCURACY]: 'https://www.pgatour.com/stats/detail/102',
  [StatsCategory.DRIVING_DISTANCE]: 'https://www.pgatour.com/stats/detail/101'
};

// Map of backup URLs in case primary ones don't work
export const backupStatsCategoryUrls: Record<StatsCategory, string> = {
  // Alternative format: stat/statId.html URLs
  [StatsCategory.SG_TOTAL]: 'https://www.pgatour.com/stats/stat/02675.html',
  [StatsCategory.SG_OTT]: 'https://www.pgatour.com/stats/stat/02567.html',
  [StatsCategory.SG_APP]: 'https://www.pgatour.com/stats/stat/02568.html',
  [StatsCategory.SG_ARG]: 'https://www.pgatour.com/stats/stat/02569.html',
  [StatsCategory.SG_PUTT]: 'https://www.pgatour.com/stats/stat/02564.html',
  [StatsCategory.DRIVING_ACCURACY]: 'https://www.pgatour.com/stats/stat/102.html',
  [StatsCategory.DRIVING_DISTANCE]: 'https://www.pgatour.com/stats/stat/101.html'
};

// Hole statistics interface
export interface HoleStatistic {
  holeNumber: number;
  par: number;
  yardage: number;
  scoringAverage: number;
  difficultyRank: number;
  relativeToPar: number;
  holeLocation: 'front_nine' | 'back_nine';
}

// Course information interfaces
export interface CourseInfo {
  courseName: string;
  location: string;
  country: string;
  par: number | null;
  yardage: number | null;
  courseRating: number | null;
  slopeRating: number | null;
  courseType: string | null;
  elevation: number | null;
  designer: string | null;
  yearBuilt: number | null;
  difficultyFactors: {
    wind?: string;
    rough?: string;
    greens?: string;
    waterHazards?: string;
    elevationChanges?: string;
    treeLineage?: string;
  };
  holeStatistics?: HoleStatistic[]; // Optional hole-by-hole data
  lastUpdated: string;
}

export interface TournamentCourseData {
  tournamentId: string;
  tournamentName: string;
  year: number;
  courseInfo: CourseInfo;
}

// Helper function to generate course ID from name
export function generateCourseIdFromName(courseName: string): string {
  if (!courseName) return '';
  
  // Remove non-alphanumeric characters and convert to lowercase
  const cleaned = courseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  // Remove consecutive underscores
  const normalized = cleaned.replace(/_+/g, '_');
  
  // Trim underscores from start and end
  return normalized.replace(/^_|_$/g, '');
}
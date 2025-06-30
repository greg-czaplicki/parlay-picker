// types/definitions.ts

// Type for PGA Tour Stats (from player_season_stats table)
export type PgaTourPlayerStats = {
  pga_player_id: string;
  player_name: string;
  dg_id: bigint | null; // Mapped DataGolf ID if available
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  driving_accuracy: number | null;
  driving_distance: number | null;
  updated_at: string; // Supabase timestamp for this record
  source_updated_at: string | null; // Timestamp when PGA Tour stats were updated
};

// Type for Season Skill Ratings (from player_skill_ratings table)
export type PlayerSkillRating = {
  dg_id: bigint;
  player_name: string;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_app: number | null;
  sg_ott: number | null;
  sg_total: number | null;
  // Note: sg_t2g is calculated, not stored directly for season
  driving_acc: number | null;
  driving_dist: number | null;
  data_golf_updated_at: string | null; // Timestamp from DG source file
  updated_at: string; // Supabase timestamp for this record
};

// Type for Live Tournament Stats (from latest_live_tournament_stats_view)
export type LiveTournamentStat = {
  dg_id: bigint;
  player_name: string;
  event_name: string;
  course_name: string;
  round_num: string; // e.g., "1", "2", "event_avg"
  sg_app: number | null;
  sg_ott: number | null;
  sg_putt: number | null;
  sg_arg: number | null;
  sg_t2g: number | null; // Provided by API/DB View
  sg_total: number | null;
  accuracy: number | null;
  distance: number | null;
  gir: number | null;
  prox_fw: number | null;
  scrambling: number | null;
  "position": string | null; // Quoted because 'position' is SQL keyword
  thru: number | null;
  today: number | null; // Player's score relative to par for the specific round_num
  total: number | null; // Player's total score relative to par for the event
  data_golf_updated_at: string | null; // Timestamp from DG source file
  fetched_at: string | null; // Timestamp from historical table insert
};

// Type for Trend Indicator object (returned by helper function)
export type TrendIndicator = {
    type: "up" | "down";
    className: string;
    title: string;
} | null; // Can be null if no significant trend

// Combined type used in PlayerTable, includes optional pre-calculated trends
export type DisplayPlayer = Partial<PlayerSkillRating> & Partial<LiveTournamentStat> & Partial<PgaTourPlayerStats> & {
    dg_id?: bigint;
    pga_player_id?: string;
    player_name: string;
    trends?: Record<string, TrendIndicator>; // Storing pre-calculated trend objects
    data_source?: 'pga_tour' | 'data_golf'; // Indicates which source this data came from
};

// Add other shared types below as needed...

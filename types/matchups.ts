import { PlayerStat } from "@/hooks/use-player-stats-query";

export type MatchupType = "2ball" | "3ball";

// Base interface for matchup rows
export interface BaseMatchupRow {
  uuid: string;
  event_id: string;
  event_name?: string;
  round_num: number;
  type: string;
  created_at: string;
  teetime?: string | null;
  tee_time?: string | null;
}

// Interface for 3-ball matchups
export interface Supabase3BallMatchupRow extends BaseMatchupRow {
  player1_dg_id: number;
  player1_name: string;
  player2_dg_id: number;
  player2_name: string;
  player3_dg_id: number | null;
  player3_name: string | null;
  odds1: number | null;
  odds2: number | null;
  odds3: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  draftkings_p3_odds: number | null;
  dg_odds1: number | null;
  dg_odds2: number | null;
  dg_odds3: number | null;
}

// Interface for 2-ball matchups
export interface Supabase2BallMatchupRow extends BaseMatchupRow {
  player1_dg_id: number;
  player1_name: string;
  player2_dg_id: number;
  player2_name: string;
  odds1: number | null;
  odds2: number | null;
  draftkings_p1_odds: number | null;
  draftkings_p2_odds: number | null;
  dg_odds1: number | null;
  dg_odds2: number | null;
}

export type MatchupRow = Supabase2BallMatchupRow | Supabase3BallMatchupRow;

export interface PlayerData {
  id: string;
  dg_id: number;
  name: string;
  odds: number | null;
  dgOdds: number | null;
  teetime: string | null;
  stats?: PlayerStat;
}

export interface MatchupFilters {
  playerSearch: string;
  showOnlyFavorites: boolean;
  showOnlyPositiveEv: boolean;
  showOnlyNegativeEv: boolean;
  showOnlyWithStats: boolean;
}

export function isSupabase3BallMatchupRow(matchup: MatchupRow): matchup is Supabase3BallMatchupRow {
  return 'player3_name' in matchup;
}

export const isSupabase2BallMatchupRow = (row: MatchupRow): row is Supabase2BallMatchupRow => {
  return row.type === "2ball" && !("player3_name" in row);
};

// Player data structure
export interface PlayerData {
  id: string;
  dg_id: number;
  name: string;
  odds: number | null;
  dgOdds: number | null;
  teetime: string | null;
}

// Interface for live tournament stats
export interface LiveTournamentStat {
  dg_id: number;
  player_name: string;
  event_name: string;
  round_num: string;
  position: string | null;
  thru: number | null;
  today: number | null;
  total: number | null;
}

// Props interface for the MatchupsTable component
export interface MatchupsTableProps {
  eventId: number | null;
  matchupType?: "2ball" | "3ball";
  roundNum?: number | null;
  showFilters?: boolean;
  compactFilters?: boolean;
  sharedMatchupsData?: MatchupRow[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
} 
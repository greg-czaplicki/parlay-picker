import type { PlayerMatchupData } from '@/app/actions/matchups';
import type { LiveTournamentStat } from '@/types/definitions';

/**
 * Represents a player in the parlay, including matchup and stats info.
 */
export interface ParlayPlayer {
  /** The name used for searching (e.g., "Corey Conners") */
  name: string;
  /** ID from the parlay_picks table */
  pickId?: string;
  /** Matchup data for the player */
  matchup: PlayerMatchupData | null;
  /** Live stats keyed by dg_id */
  liveStats: Record<number, LiveTournamentStat> | null;
  /** Loading state for matchup */
  isLoadingMatchup: boolean;
  /** Loading state for stats */
  isLoadingStats: boolean;
  /** Error message for matchup */
  matchupError?: string;
  /** Error message for stats */
  statsError?: string;
  /** Flag to indicate if it's saved in DB */
  isPersisted: boolean;
}

/**
 * Props for the ParlayCard component.
 */
export interface ParlayCardProps {
  /** Unique parlay identifier */
  parlayUuid: string;
  /** Display name for the parlay */
  parlayName: string | null;
  /** Optional: round to display */
  selectedRound?: number | null;
  /** Optional: callback for parlay deletion */
  onDelete?: (parlayUuid: string) => void;
}

/**
 * Return type for useParlayStatus hook.
 */
export interface ParlayStatusResult {
  playerLineStyle: string;
  playerLineIcon: React.ReactNode | null;
  groupContainerStyle: string;
} 
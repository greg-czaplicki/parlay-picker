import React from 'react';
import type { ParlayPlayer } from './parlay-card.types';
import { getParlayStatus } from './parlay-card.utils';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';

/**
 * Props for PlayerRow subcomponent.
 */
export interface PlayerRowProps {
  player: ParlayPlayer;
  selectedRound: number | null;
  removePlayer: (pickId?: string) => void;
}

/**
 * Renders a single player row with matchup, stats, and status.
 */
export const PlayerRow: React.FC<PlayerRowProps> = ({ player, selectedRound, removePlayer }) => {
  const { groupContainerStyle } = getParlayStatus(player, selectedRound);
  // Extract all group player names
  const groupPlayers = [
    player.matchup?.p1_player_name,
    player.matchup?.p2_player_name,
    player.matchup?.p3_player_name,
  ].filter(Boolean) as string[];

  // Map player name to dg_id for liveStats lookup
  const nameToDgId: Record<string, number | undefined> = {
    [player.matchup?.p1_player_name || '']: player.matchup?.p1_dg_id,
    [player.matchup?.p2_player_name || '']: player.matchup?.p2_dg_id,
    [player.matchup?.p3_player_name || '']: player.matchup?.p3_dg_id,
  };

  // Helper to get stat for a player
  const getStat = (name: string) => {
    const dgId = nameToDgId[name];
    if (!dgId || !player.liveStats) return undefined;
    // Try player_id first, fallback to dg_id
    return player.liveStats[dgId]?.player_id ? player.liveStats[dgId] : player.liveStats[dgId] || player.liveStats[player.liveStats[dgId]?.player_id];
  };

  console.log('liveStats for', player.name, player.liveStats);

  return (
    <li className="p-2 rounded-md border border-border/20 bg-muted/30 relative group">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => removePlayer(player.pickId)}
        className="absolute top-0 right-0 h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove pick"
      >
        <X size={14} />
      </Button>
      {player.matchupError && (
        <p className="text-xs text-destructive px-1 py-2">Error finding matchup: {player.matchupError}</p>
      )}
      {!player.isLoadingMatchup && !player.matchupError && player.matchup && (
        <div className={`text-sm text-muted-foreground space-y-2 ${groupContainerStyle}`}>          
          {/* Group/Round/Event Info */}
          <div className="flex flex-col gap-1 mb-2">
            <div className="font-medium text-base">{player.matchup.event_name || 'Event'}</div>
            <div className="text-xs font-medium text-muted-foreground/80">
              Group (R{player.matchup.round_num})
              {player.matchup.round_num === 1 && <span className="text-blue-500 ml-1">Round 1</span>}
              {player.matchup.round_num === 2 && <span className="text-green-500 ml-1">Round 2 (Current)</span>}
            </div>
            <div className="text-xs">Tee Time: {player.matchup.tee_time || 'N/A'}</div>
          </div>
          {/* Group Table */}
          <table className="w-full text-xs border-collapse table-fixed">
            <colgroup>
              <col className="w-[70%]" />
              <col className="w-[30%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-1">Player</th>
                <th className="text-center py-1">Score</th>
              </tr>
            </thead>
            <tbody>
              {groupPlayers.map((name) => {
                const stat = getStat(name);
                const isPick = name === player.name;
                console.log('Stat for', name, stat, 'total:', stat ? stat.total : undefined, 'type:', typeof (stat ? stat.total : undefined));
                return (
                  <tr
                    key={name}
                    className={
                      isPick
                        ? 'bg-primary/10 font-bold text-primary'
                        : ''
                    }
                  >
                    <td className="py-1 pl-1 rounded-l truncate">{name}</td>
                    <td className="text-center py-1 rounded-r">
                      {stat && stat.position === 'WD' ? 'WD' : (stat && stat.total !== undefined && stat.total !== null ? String(stat.total) : '-')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {player.statsError && !player.isLoadingStats && (
            <p className="text-xs text-destructive mt-1">Error loading scores: {player.statsError}</p>
          )}
        </div>
      )}
      {!player.isLoadingMatchup && !player.matchupError && !player.matchup && (
        <div className="p-4 bg-[#1e1e23] rounded-lg">
          <div className="flex justify-between items-center">
            <div className="font-medium">{player.name}</div>
            <div className="text-xs px-2 py-1 rounded bg-[#2a2a35]">
              {player.pickId ? "Added from Parlay Builder" : "From Search"}
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            No matchup data available for this player.
          </div>
        </div>
      )}
      {player.isLoadingMatchup && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto my-2" />}
    </li>
  );
}; 
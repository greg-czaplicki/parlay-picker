'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    findPlayerMatchup,
    PlayerMatchupData,
    getLiveStatsForPlayers,
    addParlayPick,
    removeParlayPick,
    deleteParlay,
    ParlayPick,
    ParlayWithPicks,
    ParlayPickWithData 
} from '@/app/actions/matchups';
import { createBrowserClient } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Check, X } from 'lucide-react';
import { LiveTournamentStat } from '@/types/definitions';
import { Trash2 } from 'lucide-react';
import { useParlayPicksQuery } from '@/hooks/use-parlay-picks-query';
import { useCreateParlayPickMutation } from '@/hooks/use-create-parlay-pick-mutation';
import { useRemoveParlayPickMutation, useDeleteParlayMutation } from '@/hooks/use-parlay-pick-mutations';
import { useParlayPlayers, useParlayActions, useParlayStatus } from './parlay-card/parlay-card.hooks';
import type { ParlayCardProps } from './parlay-card/parlay-card.types';
import { getParlayStatus } from './parlay-card/parlay-card.utils';
import { PlayerRow } from './parlay-card/player-row';

// Structure to hold player name, matchup, and live stats
interface ParlayPlayer {
  name: string; // The name used for searching (e.g., "Corey Conners")
  pickId?: number; // ID from the parlay_picks table
  matchup: PlayerMatchupData | null;
  liveStats: Record<number, LiveTournamentStat> | null; // dg_id -> LiveStat
  isLoadingMatchup: boolean;
  isLoadingStats: boolean;
  matchupError?: string;
  statsError?: string;
  isPersisted: boolean; // Flag to indicate if it's saved in DB
}

// Helper to format player name from "Last, First" to "First Last"
const formatPlayerNameDisplay = (name: string | null | undefined): string => {
    if (!name) return "N/A";
    return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
};

// Helper to format score
const formatScore = (score: number | null | undefined): string => {
    if (score === null || score === undefined) return "-";
    if (score === 0) return "E";
    return score > 0 ? `+${score}` : `${score}`;
};

export default function ParlayCard({ 
  parlayId,
  parlayName, 
  selectedRound = null,
  onDelete
}: ParlayCardProps) {
  // Use modular hooks
  const [newPlayerName, setNewPlayerName] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const {
    players,
    isAdding,
    isRefreshing,
    addPlayer,
    removePlayer,
    refreshPlayers,
  } = useParlayPlayers(parlayId, selectedRound);
  const { deleteParlay, isDeleting } = useParlayActions(parlayId, onDelete);

  // TODO: Move refresh timestamp logic into a hook or utility
  // For now, update lastRefreshed on refresh
  const handleRefresh = async () => {
    await refreshPlayers();
    setLastRefreshed(new Date());
  };

  // Format the last refreshed time in 12-hour format
  const formatRefreshTime = () => {
    if (!lastRefreshed) return "";
    let hours = lastRefreshed.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutes = lastRefreshed.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="glass-card flex flex-col h-full">
      <div className="flex flex-row justify-between items-center p-6 pb-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{parlayName || `Parlay #${parlayId}`}</h3>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground mt-1">Last updated: {formatRefreshTime()}</p>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-xs px-2 h-8" 
            onClick={handleRefresh} 
            disabled={isRefreshing || players.length === 0 || !players.some(p => p.matchup)}
          >
            {isRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <svg className="h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            )}
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-destructive" 
            onClick={deleteParlay} 
            disabled={isDeleting}
            title="Delete Parlay"
          > 
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
          </Button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {/* Players List */}
        <div>
          {players.length > 0 ? (
            <ul className="space-y-3">
              {players.map((player) => (
                <PlayerRow
                  key={player.pickId || player.name}
                  player={player}
                  selectedRound={selectedRound}
                  removePlayer={removePlayer}
                />
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-2">No picks added to this parlay yet.</p>
          )}
        </div>
        {/* TODO: Add AddPlayerForm and modularize further */}
      </div>
    </div>
  );
}
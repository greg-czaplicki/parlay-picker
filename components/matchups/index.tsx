"use client"

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MatchupRow, MatchupFilters, isSupabase3BallMatchupRow } from "@/types/matchups";
import { PlayerStat } from "@/hooks/use-player-stats-query";
import { DesktopView } from "./desktop-view";
import { MobileView } from "./mobile-view";
import { MatchupFiltersComponent } from "./matchup-filters";

interface MatchupsProps {
  matchups: MatchupRow[];
  matchupType: "2ball" | "3ball";
  playerStatsMap: Record<string, PlayerStat>;
  onAddSelection: (selection: any) => void;
  onRemoveSelection: (id: string) => void;
  getPlayerStatus: (name: string) => { status: string; label: string };
  showFilters?: boolean;
  compactFilters?: boolean;
}

export function Matchups({
  matchups,
  matchupType,
  playerStatsMap,
  onAddSelection,
  onRemoveSelection,
  getPlayerStatus,
  showFilters = true,
  compactFilters = false
}: MatchupsProps) {
  const [filters, setFilters] = useState<MatchupFilters>({
    playerSearch: "",
    showOnlyFavorites: false,
    showOnlyPositiveEv: false,
    showOnlyNegativeEv: false,
    showOnlyWithStats: false
  });

  const [highlightText, setHighlightText] = useState<(text: string) => React.ReactNode>(
    (text: string) => text
  );

  const handleFiltersChange = useCallback((newFilters: MatchupFilters) => {
    setFilters(newFilters);

    // Update highlight function based on search term
    if (newFilters.playerSearch) {
      setHighlightText(() => (text: string) => {
        const regex = new RegExp(`(${newFilters.playerSearch})`, 'gi');
        const parts = text.split(regex);
        return (
          <>
            {parts.map((part, i) => 
              regex.test(part) ? 
                <span key={i} className="bg-yellow-500/20">{part}</span> : 
                part
            )}
          </>
        );
      });
    } else {
      setHighlightText(() => (text: string) => text);
    }
  }, []);

  // Apply filters to matchups
  const filteredMatchups = matchups.filter(matchup => {
    const players = [
      { name: matchup.player1_name, dg_id: matchup.player1_dg_id },
      { name: matchup.player2_name, dg_id: matchup.player2_dg_id },
      ...(isSupabase3BallMatchupRow(matchup) && matchup.player3_name ? [
        { name: matchup.player3_name, dg_id: matchup.player3_dg_id || 0 }
      ] : [])
    ];

    // Search filter
    if (filters.playerSearch) {
      const searchTerm = filters.playerSearch.toLowerCase();
      const hasMatch = players.some(p => p.name.toLowerCase().includes(searchTerm));
      if (!hasMatch) return false;
    }

    // Favorites filter
    if (filters.showOnlyFavorites) {
      const hasFavorite = players.some(p => {
        const status = getPlayerStatus(p.name);
        return status.status === "current";
      });
      if (!hasFavorite) return false;
    }

    // Stats filter
    if (filters.showOnlyWithStats) {
      const hasStats = players.every(p => playerStatsMap[p.dg_id.toString()]);
      if (!hasStats) return false;
    }

    // EV filters
    if (filters.showOnlyPositiveEv || filters.showOnlyNegativeEv) {
      // TODO: Implement EV calculation and filtering
      // For now, we'll skip these filters
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {showFilters && (
        <Card>
          <CardContent>
            <MatchupFiltersComponent
              filters={filters}
              onFiltersChange={handleFiltersChange}
              compactMode={compactFilters}
            />
          </CardContent>
        </Card>
      )}

      <DesktopView
        matchups={filteredMatchups}
        matchupType={matchupType}
        playerStatsMap={playerStatsMap}
        onAddSelection={onAddSelection}
        onRemoveSelection={onRemoveSelection}
        getPlayerStatus={getPlayerStatus}
        playerSearchTerm={filters.playerSearch}
        highlightText={highlightText}
      />

      <MobileView
        matchups={filteredMatchups}
        matchupType={matchupType}
        playerStatsMap={playerStatsMap}
        onAddSelection={onAddSelection}
        onRemoveSelection={onRemoveSelection}
        getPlayerStatus={getPlayerStatus}
        playerSearchTerm={filters.playerSearch}
        highlightText={highlightText}
      />
    </div>
  );
} 
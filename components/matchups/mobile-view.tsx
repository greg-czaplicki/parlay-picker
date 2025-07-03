"use client"

import { Card, CardContent } from "@/components/ui/card";
import { MatchupRow, isSupabase3BallMatchupRow, PlayerData } from "@/types/matchups";
import { formatPlayerName, formatOdds, formatPlayerPosition, formatTeeTime } from "@/utils/matchup-formatting";
import { PlayerStat } from "@/hooks/use-player-stats-query";
import { PlayerActions } from "./player-actions";

interface MobileViewProps {
  matchups: MatchupRow[];
  matchupType: "2ball" | "3ball";
  playerStatsMap: Record<string, PlayerStat>;
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
  onAddSelection: (selection: any) => void;
  onRemoveSelection: (id: string) => void;
  getPlayerStatus: (name: string) => { status: string; label: string };
}

export function MobileView({
  matchups,
  matchupType,
  playerStatsMap,
  playerSearchTerm,
  highlightText,
  onAddSelection,
  onRemoveSelection,
  getPlayerStatus
}: MobileViewProps) {
  return (
    <div className="md:hidden space-y-4">
      {matchups.map((matchup) => {
        if (!matchup.id) return null;

        const players: PlayerData[] = isSupabase3BallMatchupRow(matchup) ? [
          {
            id: "p1",
            dg_id: matchup.player1_dg_id,
            name: matchup.player1_name,
            odds: matchup.odds1,
            dgOdds: matchup.dg_odds1,
            tee_time: matchup.tee_time
          },
          {
            id: "p2",
            dg_id: matchup.player2_dg_id,
            name: matchup.player2_name,
            odds: matchup.odds2,
            dgOdds: matchup.dg_odds2,
            tee_time: matchup.tee_time
          },
          {
            id: "p3",
            dg_id: matchup.player3_dg_id || 0,
            name: matchup.player3_name || "",
            odds: matchup.odds3,
            dgOdds: matchup.dg_odds3,
            tee_time: matchup.tee_time
          }
        ].filter(p => p.dg_id !== 0) : [
          {
            id: "p1",
            dg_id: matchup.player1_dg_id,
            name: matchup.player1_name,
            odds: matchup.odds1,
            dgOdds: matchup.dg_odds1,
            tee_time: matchup.tee_time
          },
          {
            id: "p2",
            dg_id: matchup.player2_dg_id,
            name: matchup.player2_name,
            odds: matchup.odds2,
            dgOdds: matchup.dg_odds2,
            tee_time: matchup.tee_time
          }
        ];

        const { localTime } = formatTeeTime(matchup.tee_time || null);

        return (
          <Card key={matchup.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="space-y-4">
                {players.map((player, idx) => {
                  const playerStatus = getPlayerStatus(formatPlayerName(player.name));
                  const positionData = formatPlayerPosition(
                    player.dg_id.toString(),
                    matchup.tee_time || null,
                    playerStatsMap
                  );

                  return (
                    <div
                      key={idx}
                      className={`
                        p-4 rounded-lg border
                        ${playerStatus.status === "used" ? "bg-yellow-50/10 border-yellow-200/20" : ""}
                        ${playerStatus.status === "current" ? "bg-primary/5 border-primary/20" : "border-gray-800"}
                      `}
                    >
                      <PlayerActions
                        player={player}
                        matchup={matchup}
                        playerStatus={playerStatus}
                        onAddSelection={onAddSelection}
                        onRemoveSelection={onRemoveSelection}
                        playerSearchTerm={playerSearchTerm}
                        highlightText={highlightText}
                      />

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">Position</div>
                          <div className="font-medium">{positionData.position}</div>
                          <div className="text-muted-foreground text-xs">{positionData.score}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">Tee Time</div>
                          <div className="font-medium">{localTime}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">FanDuel</div>
                          <div className="font-medium">{formatOdds(player.odds)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs mb-1">DataGolf</div>
                          <div className="font-medium">{formatOdds(player.dgOdds)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
} 
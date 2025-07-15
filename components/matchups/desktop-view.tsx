"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MatchupRow, isSupabase3BallMatchupRow, PlayerData } from "@/types/matchups";
import { formatPlayerName, formatOdds, formatPlayerPosition, formatTeeTime } from "@/utils/matchup-formatting";
import { PlayerStat } from "@/hooks/use-player-stats-query";
import { PlayerActions } from "@/components/matchups/player-actions";

interface DesktopViewProps {
  matchups: MatchupRow[];
  matchupType: "2ball" | "3ball";
  playerStatsMap: Record<string, PlayerStat>;
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
  onAddSelection: (selection: any) => void;
  onRemoveSelection: (id: string) => void;
  getPlayerStatus: (name: string) => { status: string; label: string };
}

export function DesktopView({
  matchups,
  matchupType,
  playerStatsMap,
  playerSearchTerm,
  highlightText,
  onAddSelection,
  onRemoveSelection,
  getPlayerStatus
}: DesktopViewProps) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Tee Time</TableHead>
            <TableHead>FanDuel</TableHead>
            <TableHead>DataGolf</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matchups.map((matchup) => {
            if (!matchup.id) return null;

            const players: PlayerData[] = isSupabase3BallMatchupRow(matchup) ? [
              {
                id: "p1",
                dg_id: matchup.player1_dg_id,
                name: matchup.player1_name,
                odds: matchup.odds1,
                dgOdds: matchup.dg_odds1,
                tee_time: matchup.tee_time || null,
                stats: playerStatsMap[matchup.player1_dg_id.toString()]
              },
              {
                id: "p2",
                dg_id: matchup.player2_dg_id,
                name: matchup.player2_name,
                odds: matchup.odds2,
                dgOdds: matchup.dg_odds2,
                tee_time: matchup.tee_time || null,
                stats: playerStatsMap[matchup.player2_dg_id.toString()]
              },
              {
                id: "p3",
                dg_id: matchup.player3_dg_id || 0,
                name: matchup.player3_name || "",
                odds: matchup.odds3,
                dgOdds: matchup.dg_odds3,
                tee_time: matchup.tee_time || null,
                stats: playerStatsMap[matchup.player3_dg_id?.toString() || ""]
              }
            ].filter(p => p.dg_id !== 0) : [
              {
                id: "p1",
                dg_id: matchup.player1_dg_id,
                name: matchup.player1_name,
                odds: matchup.odds1,
                dgOdds: matchup.dg_odds1,
                tee_time: matchup.tee_time || null,
                stats: playerStatsMap[matchup.player1_dg_id.toString()]
              },
              {
                id: "p2",
                dg_id: matchup.player2_dg_id,
                name: matchup.player2_name,
                odds: matchup.odds2,
                dgOdds: matchup.dg_odds2,
                tee_time: matchup.tee_time || null,
                stats: playerStatsMap[matchup.player2_dg_id.toString()]
              }
            ];

            const { localTime, easternTime } = formatTeeTime(matchup.tee_time || null, matchup.event_name || "");

            return players.map((player, idx) => {
              const playerStatus = getPlayerStatus(formatPlayerName(player.name));
              const positionData = formatPlayerPosition(
                player.dg_id.toString(),
                matchup.tee_time || null,
                playerStatsMap
              );

              return (
                <TableRow
                  key={`${matchup.id}-${idx}`}
                  className={`
                    ${playerStatus.status === "used" ? "bg-yellow-50/10" : ""}
                    ${playerStatus.status === "current" ? "bg-primary/5" : ""}
                  `}
                >
                  <TableCell>
                    <PlayerActions
                      player={player}
                      matchup={matchup}
                      playerStatus={playerStatus}
                      onAddSelection={onAddSelection}
                      onRemoveSelection={onRemoveSelection}
                      playerSearchTerm={playerSearchTerm}
                      highlightText={highlightText}
                    />
                  </TableCell>
                  <TableCell>
                    <div>{positionData.position}</div>
                    <div className="text-muted-foreground text-sm">{positionData.score}</div>
                  </TableCell>
                  <TableCell>
                    <div>{localTime}</div>
                    {easternTime && (
                      <div className="text-muted-foreground text-sm">{easternTime} ET</div>
                    )}
                  </TableCell>
                  <TableCell>{formatOdds(player.odds)}</TableCell>
                  <TableCell>{formatOdds(player.dgOdds)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
    </div>
  );
} 
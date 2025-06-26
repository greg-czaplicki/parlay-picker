"use client"

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Info, PlusCircle } from "lucide-react";
import { MatchupRow, PlayerData } from "@/types/matchups";
import { formatPlayerName } from "@/utils/matchup-formatting";

interface PlayerActionsProps {
  player: PlayerData;
  matchup: MatchupRow;
  playerStatus: { status: string; label: string };
  onAddSelection: (selection: any) => void;
  onRemoveSelection: (id: string) => void;
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
}

export function PlayerActions({
  player,
  matchup,
  playerStatus,
  onAddSelection,
  onRemoveSelection,
  playerSearchTerm,
  highlightText
}: PlayerActionsProps) {
  const formattedName = formatPlayerName(player.name);
  const displayName = highlightText ? highlightText(formattedName) : formattedName;

  const handleAddSelection = () => {
    onAddSelection({
      id: player.id,
      matchupId: matchup.uuid,
      name: player.name,
      odds: player.odds,
      dgOdds: player.dgOdds,
      dg_id: player.dg_id,
      teetime: player.teetime
    });
  };

  const handleRemoveSelection = () => {
    onRemoveSelection(player.id);
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="font-medium">{displayName}</div>
        {playerStatus.status !== "none" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{playerStatus.label}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="flex items-center gap-2">
        {playerStatus.status === "none" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleAddSelection}
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        )}
        {playerStatus.status === "current" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleRemoveSelection}
          >
            <CheckCircle className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>
    </div>
  );
} 
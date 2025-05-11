"use client"

import PlayerTable from "@/components/tables/player-table"
import type { PlayerSkillRating, LiveTournamentStat } from "@/types/definitions"

interface PlayerTableWrapperProps {
  initialSeasonSkills: PlayerSkillRating[]
  initialLiveStats: LiveTournamentStat[]
}

export default function PlayerTableWrapper({ initialSeasonSkills, initialLiveStats }: PlayerTableWrapperProps) {
  console.log('PlayerTableWrapper render');
  return (
    <PlayerTable 
      initialSeasonSkills={initialSeasonSkills}
      initialLiveStats={initialLiveStats}
    />
  )
}

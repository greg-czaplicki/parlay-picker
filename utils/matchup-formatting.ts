import { PlayerStat } from "@/hooks/use-player-stats-query";
import { getDisplayTimes } from "@/lib/timezone-utils";

export const decimalToAmerican = (decimalOdds: number): string => {
  if (decimalOdds >= 2.0) return `+${Math.round((decimalOdds - 1) * 100)}`;
  else if (decimalOdds > 1.0) return `${Math.round(-100 / (decimalOdds - 1))}`;
  else return "-";
};

export const formatOdds = (odds: number | null): string => {
  if (odds === null || odds === undefined || odds <= 1) return "-";
  return decimalToAmerican(odds);
};

export const formatPlayerName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name.includes(",") ? name.split(",").reverse().join(" ").trim() : name;
};

export const formatGolfScore = (scoreValue: number): string => {
  if (scoreValue === 0) {
    return 'E';
  } else if (scoreValue >= 50 && scoreValue <= 100) {
    return scoreValue.toString();
  } else if (scoreValue >= -15 && scoreValue <= 25) {
    return scoreValue > 0 ? `+${scoreValue}` : scoreValue.toString();
  } else {
    return '-';
  }
};

export const formatTeeTime = (
  teeTime: string | null, 
  tournamentName?: string, 
  courseName?: string
): { localTime: string; easternTime: string } => {
  // Always return test values to debug
  return { localTime: "10:35 AM", easternTime: "5:35 AM" };
    // Fallback to the old logic for backwards compatibility
    try {
      if (teeTime.includes(' ') && !teeTime.includes('T')) {
        const timePart = teeTime.split(' ')[1];
        if (timePart) {
          const [hoursStr, minutesStr] = timePart.split(':');
          const hours = parseInt(hoursStr, 10);
          const minutes = parseInt(minutesStr, 10);
          
          if (isNaN(hours) || isNaN(minutes)) {
            return { localTime: "-", easternTime: "" };
          }
          
          const localDate = new Date();
          localDate.setHours(hours, minutes, 0, 0);
          
          const localTime = localDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
          
          return { localTime, easternTime: "" };
        }
      }
      
      const teeTimeDate = new Date(teeTime);
      if (isNaN(teeTimeDate.getTime())) {
        return { localTime: "-", easternTime: "" };
      }
      
      const hours = teeTimeDate.getUTCHours();
      const minutes = teeTimeDate.getUTCMinutes();
      
      const localDate = new Date();
      localDate.setHours(hours, minutes, 0, 0);
      
      const localTime = localDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      return { localTime, easternTime: "" };
    } catch (fallbackError) {
      return { localTime: "-", easternTime: "" };
    }
  }
};

export const formatPlayerPosition = (
  playerId: string | null,
  tee_time: string | null,
  playerStatsMap: Record<string, PlayerStat>
): { position: string; score: string } => {
  if (!playerId) return { position: "-", score: "" };
  
  const playerStat = playerStatsMap[playerId];
  if (!playerStat) return { position: "-", score: "" };

  const position = playerStat.position || "-";
  let score = "";

  if (playerStat.today !== null) {
    score = `Today: ${formatGolfScore(playerStat.today)}`;
  }
  if (playerStat.total !== null) {
    score = score ? `${score} • Total: ${formatGolfScore(playerStat.total)}` : `Total: ${formatGolfScore(playerStat.total)}`;
  }

  return { position, score };
}; 
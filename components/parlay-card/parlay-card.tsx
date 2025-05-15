import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import clsx from 'clsx';

export interface ParlayPlayerDisplay {
  name: string;
  isUserPick: boolean;
  currentPosition: string; // e.g., "T5"
  totalScore: number;
  roundScore: number;
  holesPlayed: number;
  totalHoles: number;
}

export interface ParlayPickDisplay {
  /**
   * Legacy: Used by old code and mock data
   */
  matchup: ParlayPlayerDisplay[]; // 2 or 3 players
  /**
   * New: Used by API response, contains all players in the matchup with stats
   */
  players?: ParlayPlayerDisplay[];
}

export interface ParlayCardProps {
  parlayId: number;
  amount: number;
  odds: number;
  payout: number;
  picks: ParlayPickDisplay[];
  status: 'likely' | 'close' | 'unlikely'; // for color coding
  isSettled: boolean;
  round: number;
}

const statusColors = {
  likely: 'bg-green-500',
  close: 'bg-yellow-400',
  unlikely: 'bg-red-500',
};

export function ParlayCard({
  parlayId,
  amount,
  odds,
  payout,
  picks,
  status,
  isSettled,
  round,
}: ParlayCardProps) {
  return (
    <Card className="bg-background/90 border border-border/40 shadow-lg flex flex-col h-full">
      <CardHeader className="flex-row justify-between items-center pb-3">
        <div>
          <CardTitle className="text-lg font-semibold">
            Parlay #{parlayId} {isSettled && <span className="ml-2 text-xs text-muted-foreground">(Settled)</span>}
          </CardTitle>
          <div className="text-xs text-muted-foreground mt-1">
            Round {round} &bull; ${amount} to win ${payout} &bull; Odds: +{odds}
          </div>
        </div>
        <div className={clsx('w-3 h-3 rounded-full', statusColors[status])} title={status} />
      </CardHeader>
      <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
        <ul className="space-y-4">
          {picks.map((pick, i) => (
            <li key={i} className="border rounded-lg p-3 bg-muted/40">
              <div className="font-medium mb-2">Matchup {i + 1} ({pick.players?.length}-ball)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {pick.players?.map((player, idx) => (
                  <div
                    key={player.name}
                    className={clsx(
                      'rounded p-2 border flex flex-col items-center',
                      player.isUserPick ? 'border-primary bg-primary/10 font-bold' : 'border-border bg-background'
                    )}
                  >
                    <div className="text-base">{player.name}</div>
                    <div className="text-xs text-muted-foreground">Pos: {player.currentPosition}</div>
                    <div className="text-xs">Total: {player.totalScore > 0 ? `+${player.totalScore}` : player.totalScore === 0 ? 'E' : player.totalScore}</div>
                    <div className="text-xs">Rnd: {player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore === 0 ? 'E' : player.roundScore}</div>
                    <div className="text-xs">Holes: {player.holesPlayed}/{player.totalHoles}</div>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Example usage with mock data (remove before integration)
// const exampleProps: ParlayCardProps = {
//   parlayId: 1234,
//   amount: 25,
//   odds: 450,
//   payout: 112.5,
//   picks: [
//     {
//       matchup: [
//         { name: 'Player 1', isUserPick: true, currentPosition: 'T5', totalScore: -6, roundScore: -2, holesPlayed: 14, totalHoles: 18 },
//         { name: 'Player 2', isUserPick: false, currentPosition: 'T8', totalScore: -4, roundScore: -1, holesPlayed: 14, totalHoles: 18 },
//       ],
//     },
//     {
//       matchup: [
//         { name: 'Player 3', isUserPick: false, currentPosition: 'T12', totalScore: -2, roundScore: 1, holesPlayed: 10, totalHoles: 18 },
//         { name: 'Player 4', isUserPick: true, currentPosition: 'T2', totalScore: -8, roundScore: -3, holesPlayed: 10, totalHoles: 18 },
//         { name: 'Player 5', isUserPick: false, currentPosition: 'T20', totalScore: 0, roundScore: 0, holesPlayed: 10, totalHoles: 18 },
//       ],
//     },
//   ],
//   status: 'likely',
//   isSettled: false,
//   round: 2,
// };
// <ParlayCard {...exampleProps} /> 
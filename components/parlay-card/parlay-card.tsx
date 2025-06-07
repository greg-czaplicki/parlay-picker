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
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-[60%]" />
            <col className="w-[20%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="py-2 px-3 text-left font-semibold">Player</th>
              <th className="py-2 px-3 text-right font-semibold">Score</th>
              <th className="py-2 px-3 text-right font-semibold">Holes</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((pick, i) => (
              <tr key={i}>
                <td className="py-2 px-3 font-mono truncate">{pick.players?.map((player) => player.name).join(', ')}</td>
                <td className="py-2 px-3 font-mono text-right">
                  {pick.players?.map((player) => 
                    player.currentPosition === 'WD' ? 'WD' : player.roundScore
                  ).join(', ')}
                </td>
                <td className="py-2 px-3 font-mono text-right">
                  {pick.players?.map((player) => 
                    player.currentPosition === 'WD' ? 'WD' : player.holesPlayed
                  ).join('/') + '/' + pick.players?.map((player) => player.totalHoles).join('/')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
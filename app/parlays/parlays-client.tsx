'use client';

import { useState, useEffect } from 'react';
import { ParlayCard, ParlayCardProps, ParlayPickDisplay, ParlayPlayerDisplay } from '@/components/parlay-card/parlay-card';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParlaysQuery } from '@/hooks/use-parlays-query';

export default function ParlaysClient({ currentRound }: { currentRound: number | null }) {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

  // Persistent data via React Query
  const { data, isLoading, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];

  // Derive unique rounds from parlays data
  const uniqueRounds: number[] = Array.from(
    new Set(
      parlays.flatMap((parlay: any) => parlay.round_num).filter((round: number | null) => round !== null)
    )
  ).sort((a, b) => Number(a) - Number(b));

  // Ephemeral UI state
  const [selectedRound, setSelectedRound] = useState<string>(() => {
    if (currentRound && uniqueRounds.includes(currentRound)) return String(currentRound);
    if (uniqueRounds.length > 1) return 'all';
    if (uniqueRounds.length === 1) return String(uniqueRounds[0]);
    return '';
  });

  useEffect(() => {
    if (
      uniqueRounds.length > 0 &&
      (!selectedRound || !uniqueRounds.includes(Number(selectedRound)))
    ) {
      if (currentRound && uniqueRounds.includes(currentRound)) {
        setSelectedRound(String(currentRound));
      } else if (uniqueRounds.length > 1) {
        setSelectedRound('all');
      } else if (uniqueRounds.length === 1) {
        setSelectedRound(String(uniqueRounds[0]));
      }
    }
  }, [uniqueRounds, currentRound]);

  if (currentRound !== null && !uniqueRounds.includes(currentRound)) {
    uniqueRounds.push(currentRound);
    uniqueRounds.sort((a, b) => Number(a) - Number(b));
  }

  // Filter parlays based on selected round
  const filteredParlays = parlays.filter((parlay: any) => {
    if (selectedRound === 'all') return true;
    if (selectedRound) return String(parlay.round_num) === selectedRound;
    return false;
  });

  // Error toast for loading
  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Error Loading Parlays', description: error.message, variant: 'destructive' });
    }
  }, [isError, error]);

  // Helper to map API parlay to ParlayCardProps
  function mapParlayToCardProps(parlay: any): ParlayCardProps | null {
    if (!parlay || !Array.isArray(parlay.picks) || parlay.picks.length === 0) return null;
    const picks: ParlayPickDisplay[] = parlay.picks.map((pick: any) => ({
      players: pick.players || [],
    }));
    const status: 'likely' | 'close' | 'unlikely' = parlay.is_settled ? 'close' : 'likely';
    return {
      parlayId: parlay.id,
      amount: Number(parlay.amount) || 0,
      odds: Number(parlay.odds) || 0,
      payout: Number(parlay.payout) || 0,
      picks,
      status,
      isSettled: !!parlay.is_settled,
      round: parlay.round_num || 0,
    };
  }

  // Helper to determine matchup status
  function getMatchupStatus(
    userPick: ParlayPlayerDisplay,
    others: ParlayPlayerDisplay[]
  ): 'likely' | 'unlikely' | 'close' {
    // Find the minimum holes played among all players (to compare fairly)
    const minHoles = Math.min(userPick.holesPlayed, ...others.map(p => p.holesPlayed));
    // Get scores for all players at minHoles
    // (Assume totalScore is up-to-date for the current holes played)
    const userScore = userPick.totalScore;
    const bestOtherScore = Math.min(...others.map(p => p.totalScore));
    const holesLeft = 18 - userPick.holesPlayed;

    // If user is behind at this point, it's unlikely
    if (userScore > bestOtherScore) return 'unlikely';

    // If user is ahead and has played the same or fewer holes, it's likely
    if (userScore < bestOtherScore && userPick.holesPlayed <= Math.max(...others.map(p => p.holesPlayed))) {
      // If lead is 2+ and only a few holes left, very likely
      if ((bestOtherScore - userScore) >= 2 && holesLeft <= 4) return 'likely';
      return 'likely';
    }

    // If user is tied or ahead but has played more holes, it's close
    return 'close';
  }

  // Helper to determine if a matchup is won, lost, tied, or in progress
  function getMatchupFinalStatus(
    userPick: ParlayPlayerDisplay,
    others: ParlayPlayerDisplay[]
  ): 'won' | 'lost' | 'tied' | null {
    // All players must have finished (18 holes)
    const allDone = [userPick, ...others].every(p => p.holesPlayed === 18);
    if (!allDone) return null;
    const userScore = userPick.totalScore;
    const bestOtherScore = Math.min(...others.map(p => p.totalScore));
    if (userScore < bestOtherScore) return 'won';
    if (userScore > bestOtherScore) return 'lost';
    return 'tied';
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Active Parlays</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Round:</span>
        <Select value={selectedRound} onValueChange={setSelectedRound}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {uniqueRounds.length === 0 ? (
              <SelectItem value="none" disabled>No rounds available</SelectItem>
            ) : uniqueRounds.length > 1 ? (
              <>
                <SelectItem value="all">All Rounds</SelectItem>
                {uniqueRounds.map((round: number) => (
                  <SelectItem key={String(round)} value={String(round)}>
                    {`Round ${round}`}
                  </SelectItem>
                ))}
              </>
            ) : (
              uniqueRounds.map((round: number) => (
                <SelectItem key={String(round)} value={String(round)}>
                  {`Round ${round}`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      {filteredParlays.length > 0 ? (
        <div className="space-y-8">
          {filteredParlays.map((parlay: any, idx: number) => {
            const cardProps = mapParlayToCardProps(parlay);
            if (!cardProps) return null;
            return (
              <div
                key={parlay.id}
                className="relative shadow-sm bg-[#1e1e23] p-6 mb-8"
              >
                <div className="absolute left-0 top-0 h-full w-1 bg-primary" />
                <div className="ml-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <div className="text-lg font-bold tracking-tight">
                      Parlay #{idx + 1}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Round {cardProps.round} &bull; <span className="font-semibold">${cardProps.amount}</span> to win <span className="font-semibold">${cardProps.payout}</span> &bull; Odds: <span className="font-mono">+{cardProps.odds}</span>
                    </div>
                  </div>
                  {cardProps.picks.map((pick, mIdx) => {
                    if (!pick.players) return null;
                    const userPick = pick.players.find((p: ParlayPlayerDisplay) => p.isUserPick);
                    const others = pick.players.filter((p: ParlayPlayerDisplay) => !p.isUserPick);
                    if (!userPick) return null;
                    const matchupStatus = getMatchupStatus(userPick, others);
                    const finalStatus = getMatchupFinalStatus(userPick, others);
                    const cardBg =
                      finalStatus === 'won'
                        ? 'bg-green-800/10 border-green-500'
                        : finalStatus === 'lost'
                        ? 'bg-red-800/10 border-red-500'
                        : finalStatus === 'tied'
                        ? 'bg-yellow-800/10 border-yellow-500'
                        : 'bg-muted border-border';
                    return (
                      <div
                        key={mIdx}
                        className={`relative mb-6 ${cardBg} shadow-sm border px-4 py-3`}
                      >
                        {/* Absolute colored status bar */}
                        <div className={`absolute left-0 top-0 h-full w-1 ${
                          finalStatus === 'won'
                            ? 'bg-green-500'
                            : finalStatus === 'lost'
                            ? 'bg-red-500'
                            : finalStatus === 'tied'
                            ? 'bg-yellow-500'
                            : matchupStatus === 'likely'
                            ? 'bg-green-500'
                            : matchupStatus === 'unlikely'
                            ? 'bg-red-500'
                            : 'bg-yellow-400'
                        }`} />
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-primary text-base">
                            Matchup {mIdx + 1}{' '}
                            <span className="text-xs text-muted-foreground">
                              ({pick.players.length === 2 ? '2-ball' : '3-ball'})
                            </span>
                          </span>
                          {/* Removed circle indicator */}
                        </div>
                        <div className="overflow-x-auto border border-border">
                          <table className="min-w-full text-sm table-fixed">
                            <thead>
                              <tr className="bg-muted">
                                <th className="py-2 px-3 text-left font-semibold w-40">Player</th>
                                <th className="py-2 px-3 text-left font-semibold w-16">Pos</th>
                                <th className="py-2 px-3 text-left font-semibold w-16">Total</th>
                                <th className="py-2 px-3 text-left font-semibold w-16">Rnd</th>
                                <th className="py-2 px-3 text-left font-semibold w-16">Thru</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pick.players.map((player: ParlayPlayerDisplay, pIdx: number) => (
                                <tr
                                  key={pIdx}
                                  className={
                                    player.isUserPick
                                      ? 'font-semibold text-primary'
                                      : 'hover:bg-accent transition'
                                  }
                                >
                                  <td className="py-2 px-3 truncate w-40">
                                    <span className="truncate">{player.name}</span>
                                  </td>
                                  <td className="py-2 px-3 font-mono">{player.currentPosition}</td>
                                  <td className="py-2 px-3 font-mono">{typeof player.totalScore === 'number' && player.totalScore !== 0 ? (player.totalScore > 0 ? `+${player.totalScore}` : player.totalScore) : 'E'}</td>
                                  <td className="py-2 px-3 font-mono">E</td>
                                  <td className="py-2 px-3 font-mono">{player.holesPlayed}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-border/50">
          <p className="text-muted-foreground">No parlays found for {selectedRound && selectedRound !== 'all' ? `Round ${selectedRound}` : 'any round'}.</p>
        </div>
      )}
    </div>
  );
}
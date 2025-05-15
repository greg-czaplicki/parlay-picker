'use client';

import { useState, useEffect } from 'react';
import { ParlayCard, ParlayCardProps, ParlayPickDisplay, ParlayPlayerDisplay } from '@/components/parlay-card/parlay-card';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParlaysQuery } from '@/hooks/use-parlays-query';
import { useQuery } from '@tanstack/react-query';
import { createBrowserClient } from '@/lib/supabase';

export default function ParlaysClient({ currentRound }: { currentRound: number | null }) {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

  // Persistent data via React Query
  const { data, isLoading, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];

  // --- NEW: Fetch available rounds from matchups (tournament state) ---
  const { data: availableRounds = [], isLoading: roundsLoading } = useQuery<number[], Error>({
    queryKey: ['availableRounds'],
    queryFn: async () => {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('matchups')
        .select('round_num')
        .neq('round_num', null);
      if (error) throw error;
      const rounds = Array.from(new Set((data || []).map((row: any) => row.round_num))).sort((a, b) => a - b);
      return rounds;
    },
    staleTime: 60_000,
  });

  // Ephemeral UI state
  const [selectedRound, setSelectedRound] = useState<string>(() => {
    if (currentRound && availableRounds.includes(currentRound)) return String(currentRound);
    if (availableRounds.length > 0) return String(availableRounds[0]);
    return '';
  });

  // Keep selectedRound in sync with availableRounds/currentRound
  useEffect(() => {
    if (
      availableRounds.length > 0 &&
      (!selectedRound || !availableRounds.includes(Number(selectedRound)))
    ) {
      if (currentRound && availableRounds.includes(currentRound)) {
        setSelectedRound(String(currentRound));
      } else {
        setSelectedRound(String(availableRounds[0]));
      }
    }
  }, [availableRounds, currentRound]);

  // Filter parlays based on selected round
  const filteredParlays = parlays.filter((parlay: any) => {
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
    const userScore = userPick.roundScore;
    const bestOtherScore = Math.min(...others.map(p => p.roundScore));
    const userHoles = userPick.holesPlayed;
    const maxOtherHoles = Math.max(...others.map(p => p.holesPlayed));
    const minOtherHoles = Math.min(...others.map(p => p.holesPlayed));

    // If user is behind at this point, it's unlikely
    if (userScore > bestOtherScore) return 'unlikely';

    // If user is finished but any opponent is not, and user is not ahead, it's close
    if (userHoles === 18 && others.some(p => p.holesPlayed < 18)) {
      if (userScore < bestOtherScore) return 'likely';
      return 'close';
    }

    // If user is ahead and has played the same or fewer holes, it's likely
    if (userScore < bestOtherScore && userHoles <= minOtherHoles) {
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
    const userScore = userPick.roundScore;
    const bestOtherScore = Math.min(...others.map(p => p.roundScore));
    if (userScore < bestOtherScore) return 'won';
    if (userScore > bestOtherScore) return 'lost';
    return 'tied';
  }

  // Helper to determine overall parlay status (won/lost/tied/null) for the active round
  function getParlayFinalStatus(cardProps: ParlayCardProps, activeRound: number | null): 'won' | 'lost' | 'tied' | null {
    // Only consider picks for the active round
    const picksForRound = cardProps.picks.filter(
      pick => cardProps.round === activeRound
    );
    if (picksForRound.length === 0) return null;

    const allMatchupsFinal = picksForRound.every(
      pick => pick.players && pick.players.length > 0 && pick.players.every(p => p.holesPlayed === 18)
    );
    if (!allMatchupsFinal) return null;

    let hasLost = false;
    let hasTied = false;
    for (const pick of picksForRound) {
      const userPick = pick.players?.find(p => p.isUserPick);
      const others = pick.players?.filter(p => !p.isUserPick) ?? [];
      if (!userPick || others.length === 0) continue;
      const userScore = userPick.roundScore;
      const bestOtherScore = Math.min(...others.map(p => p.roundScore));
      if (userScore > bestOtherScore) hasLost = true;
      else if (userScore === bestOtherScore) hasTied = true;
    }
    if (hasLost) return 'lost';
    if (hasTied) return 'tied';
    return 'won';
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Active Parlays</h1>
      </div>
      {/* Only show round selector if there are any parlays */}
      {parlays.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Round:</span>
          <Select value={selectedRound} onValueChange={setSelectedRound} disabled={roundsLoading || availableRounds.length === 0}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableRounds.length === 0 ? (
                <SelectItem value="none" disabled>No rounds available</SelectItem>
              ) : (
                availableRounds.map((round: number) => (
                  <SelectItem key={String(round)} value={String(round)}>
                    {`Round ${round}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      {filteredParlays.length > 0 ? (
        <div className="space-y-8">
          {filteredParlays.map((parlay: any, idx: number) => {
            const cardProps = mapParlayToCardProps(parlay);
            if (!cardProps) return null;
            const activeRound = selectedRound === 'all' ? null : Number(selectedRound);
            const parlayStatus = getParlayFinalStatus(cardProps, activeRound);
            const parlayCardBg =
              parlayStatus === 'won'
                ? 'bg-green-800/10 border-green-500'
                : parlayStatus === 'lost'
                ? 'bg-red-800/10 border-red-500'
                : parlayStatus === 'tied'
                ? 'bg-yellow-800/10 border-yellow-500'
                : 'bg-[#1e1e23] border-border';
            // Only show picks for the active round
            const picksForRound = activeRound === null
              ? cardProps.picks
              : cardProps.picks.filter(pick => cardProps.round === activeRound);
            return (
              <div
              key={parlay.id}
                className={`relative shadow-sm p-6 mb-8 border ${parlayCardBg}`}
              >
                <div className="ml-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
                    <div className="text-lg font-bold tracking-tight">
                      Parlay #{idx + 1}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Round {cardProps.round} &bull; <span className="font-semibold">${cardProps.amount}</span> to win <span className="font-semibold">${cardProps.payout}</span> &bull; Odds: <span className="font-mono">+{cardProps.odds}</span>
                    </div>
                  </div>
                  {picksForRound.map((pick, mIdx) => {
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
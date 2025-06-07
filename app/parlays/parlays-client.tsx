'use client';

import { useState, useEffect } from 'react';
import { ParlayCardProps, ParlayPickDisplay, ParlayPlayerDisplay } from '@/components/parlay-card/parlay-card';
import { toast } from '@/components/ui/use-toast';
import { useParlaysQuery } from '@/hooks/use-parlays-query';
import { Loader2 } from 'lucide-react';


export default function ParlaysClient({ currentRound }: { currentRound: number | null }) {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

  // Persistent data via React Query
  const { data, isLoading, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];

  // Error toast for loading
  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Error Loading Parlays', description: error.message, variant: 'destructive' });
    }
  }, [isError, error]);

  const [autoProcessing, setAutoProcessing] = useState(false);
  const { refetch } = useParlaysQuery(userId);

  // Last sync timestamp state
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Load last sync from localStorage on mount
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('lastSync') : null;
    if (t) setLastSync(new Date(t));
  }, []);

  // Auto-sync and settle on page load
  useEffect(() => {
    const autoSyncAndSettle = async () => {
      if (autoProcessing) return; // Prevent multiple simultaneous runs
      
      setAutoProcessing(true);
      try {
        // First sync the latest stats
        const syncRes = await fetch('http://localhost:3000/api/live-stats/sync', { method: 'GET' });
        if (!syncRes.ok) throw new Error('Failed to sync live stats');
        
        // Then settle any unsettled parlays
        const settleRes = await fetch('/api/settle', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoDetect: true })
        });
        
        if (!settleRes.ok) throw new Error('Failed to settle parlays');
        
        const settleData = await settleRes.json();
        
        // Update last sync timestamp
        const now = new Date();
        setLastSync(now);
        if (typeof window !== 'undefined') {
          localStorage.setItem('lastSync', now.toISOString());
        }
        
        // Show success message only if settlements were made
        if (settleData.total_settlements > 0) {
          toast({ 
            title: 'Auto-Settlement Complete', 
            description: `Settled ${settleData.total_settlements} picks across ${settleData.events_checked || 0} events`,
            variant: 'default' 
          });
        }
        
        // Refresh parlay data
        await refetch();
      } catch (err: any) {
        toast({ 
          title: 'Auto-Process Failed', 
          description: err.message || 'Could not auto-sync and settle',
          variant: 'destructive' 
        });
      } finally {
        setAutoProcessing(false);
      }
    };

    // Run auto-sync and settle on mount
    autoSyncAndSettle();
  }, []); // Empty dependency array means this runs once on mount



  // Helper to map API parlay to ParlayCardProps
  function mapParlayToCardProps(parlay: any): ParlayCardProps | null {
    if (!parlay || !Array.isArray(parlay.picks) || parlay.picks.length === 0) return null;
    const picks: ParlayPickDisplay[] = parlay.picks.map((pick: any) => ({
      players: pick.players || [],
    }));
    const status: 'likely' | 'close' | 'unlikely' = parlay.is_settled ? 'close' : 'likely';
    return {
      parlayId: parlay.uuid,
      amount: Number(parlay.amount) || 0,
      odds: Number(parlay.odds) || 0,
      payout: Number(parlay.payout) || 0,
      picks,
      status,
      isSettled: !!parlay.is_settled,
      round: parlay.round_num || 0,
    };
  }

  function getMatchupStatus(
    userPick: ParlayPlayerDisplay,
    others: ParlayPlayerDisplay[]
  ): 'likely' | 'unlikely' | 'close' {
    // Check if any player withdrew - if so, the pick should be void (show as close/pending)
    const allPlayers = [userPick, ...others];
    const hasWithdrawal = allPlayers.some(p => p.currentPosition === 'WD');
    
    if (hasWithdrawal) {
      return 'close'; // Show as neutral/pending since pick should be void
    }

    const userScore = userPick.roundScore;
    const bestOtherScore = Math.min(...others.map(p => p.roundScore));
    const holesPlayed = userPick.holesPlayed;
    const holesRemaining = 18 - holesPlayed;

  
    // If round is complete (18 holes), determine winner or tie
    if (holesPlayed === 18) {
      if (userScore < bestOtherScore) return 'likely'; // User wins
      if (userScore > bestOtherScore) return 'unlikely'; // User loses
      return 'close'; // Tie or push
    }
  
    // Score differential
    const scoreDiff = userScore - bestOtherScore; // Negative means user is leading
  
    // Define thresholds based on holes remaining
    if (holesRemaining >= 10) {
      // Early in the round, small leads are less certain
      if (scoreDiff < -1) return 'likely'; // Leading by 2+ strokes
      if (scoreDiff > 1) return 'unlikely'; // Trailing by 2+ strokes
      return 'close'; // Within 1 stroke
    } else if (holesRemaining >= 5) {
      // Mid-round, leads become more significant
      if (scoreDiff < -1) return 'likely'; // Leading by 2+ strokes
      if (scoreDiff > 0) return 'unlikely'; // Trailing by any strokes
      return 'close'; // Tied or leading by 1
    } else {
      // Late in the round, any lead is strong
      if (scoreDiff < 0) return 'likely'; // Any lead
      if (scoreDiff > 0) return 'unlikely'; // Any deficit
      return 'close'; // Tied
    }
  }

  // Helper to determine final status of a 3-ball golf matchup
  function getMatchupFinalStatus(
    userPick: ParlayPlayerDisplay,
    others: ParlayPlayerDisplay[]
  ): 'won' | 'lost' | 'tied' | 'void' | null {
    // Check if any player withdrew - if so, no final status badge (should be void)
    const allPlayers = [userPick, ...others];
    const hasWithdrawal = allPlayers.some(p => p.currentPosition === 'WD');
    
    if (hasWithdrawal) {
      return 'void'; // Return void status for withdrawal
    }

    // Validate that all players have played the same number of holes
    const holesPlayed = userPick.holesPlayed;

    // Check if the round is complete (18 holes)
    if (holesPlayed !== 18) {
      return null; // Matchup is in progress
    }

    // Compare scores
    const userScore = userPick.roundScore;
    const bestOtherScore = Math.min(...others.map(p => p.roundScore));

    if (userScore < bestOtherScore) {
      return 'won'; // User has the lowest score
    }
    if (userScore > bestOtherScore) {
      return 'lost'; // Another player has a lower score
    }
    return 'tied'; // User is tied with at least one other player
  }

  return (
    <div className="mx-auto px-2 sm:px-4 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Active Parlays</h1>
        <div className="flex flex-col items-end gap-2">
          {autoProcessing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin w-4 h-4" />
              Auto-syncing and settling...
            </div>
          )}
          <span className="text-xs text-muted-foreground">
            {lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'Not yet synced'}
          </span>
        </div>
      </div>
      {parlays.length > 0 ? (
        <div className="space-y-8">
          {parlays.map((parlay: any, idx: number) => {
            const cardProps = mapParlayToCardProps(parlay);
            if (!cardProps) return null;
            // Show all picks for each parlay
            return (
              <div
                key={parlay.uuid}
                className="relative rounded-lg shadow-md border bg-neutral-900 border-border mb-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 pt-4 pb-2">
                  <div className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <span>Parlay #{idx + 1}</span>
                    {cardProps.isSettled && (
                      <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs font-semibold">Settled</span>
                    )}
                  </div>
                  <div className="text-sm text-neutral-200 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
                    <span>Round {cardProps.round}</span>
                    <span className="hidden sm:inline text-base text-neutral-500">•</span>
                    <span>
                      <span className="font-semibold">${cardProps.amount.toLocaleString()}</span> to win <span className="font-semibold">${cardProps.payout.toLocaleString()}</span>
                    </span>
                    <span className="hidden sm:inline text-base text-neutral-500">•</span>
                    <span>Odds: <span className="font-mono">+{cardProps.odds}</span></span>
                  </div>
                </div>
                <div className="grid gap-4 px-6 pb-4">
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
                        : finalStatus === 'void'
                        ? 'bg-gray-800/10 border-gray-500'
                        : 'bg-muted border-border';
                    const statusBarColor =
                      finalStatus === 'won'
                        ? 'bg-green-500'
                        : finalStatus === 'lost'
                        ? 'bg-red-500'
                        : finalStatus === 'tied'
                        ? 'bg-yellow-500'
                        : finalStatus === 'void'
                        ? 'bg-gray-500'
                        : matchupStatus === 'likely'
                        ? 'bg-green-500'
                        : matchupStatus === 'unlikely'
                        ? 'bg-red-500'
                        : 'bg-gray-500';
                    const getHolesDisplay = (holesPlayed: number): string | number => {
                      if (holesPlayed === 0) return 1;
                      if (holesPlayed === 18) return 'F';
                      return holesPlayed;
                    };
                    return (
                      <div
                        key={mIdx}
                        className={`relative rounded-md border ${cardBg} px-0 py-0 overflow-hidden`}
                      >
                        {/* Status bar */}
                        <div className={`absolute left-0 top-0 h-full w-1 ${statusBarColor}`} />
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                          <span className="font-semibold text-primary text-base">
                            Matchup {mIdx + 1}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({pick.players.length === 2 ? '2-ball' : '3-ball'})
                            </span>
                          </span>
                          {finalStatus && (
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold
                              ${finalStatus === 'won' ? 'bg-green-100 text-green-700' : ''}
                              ${finalStatus === 'lost' ? 'bg-red-100 text-red-700' : ''}
                              ${finalStatus === 'tied' ? 'bg-yellow-100 text-yellow-700' : ''}
                              ${finalStatus === 'void' ? 'bg-gray-100 text-gray-700' : ''}
                            `}>
                              {finalStatus.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm table-fixed">
                            <colgroup>
                              <col className="w-[60%]" />
                              <col className="w-[20%]" />
                              <col className="w-[20%]" />
                            </colgroup>
                            <thead>
                              <tr className="bg-muted">
                                <th className="py-2 px-3 text-left font-semibold">Player</th>
                                <th className="py-2 px-3 text-right font-semibold">Score</th>
                                <th className="py-2 px-3 text-right font-semibold">Thru</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pick.players.map((player, pIdx) => (
                                <tr
                                  key={pIdx}
                                  className={
                                    player.isUserPick
                                      ? 'font-semibold text-primary bg-accent/30 border-l-4 border-primary'
                                      : 'hover:bg-accent/10 transition'
                                  }
                                >
                                  <td className="py-2 px-3 truncate">{player.name}</td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {(() => {
                                      // Check if player withdrew
                                      if (player.currentPosition === 'WD') return 'WD'
                                      
                                      if (typeof player.roundScore !== 'number') return '-'
                                      
                                      // For historical completed rounds, show raw stroke count
                                      // We can detect this by: holesPlayed === 18 AND roundScore > 18 (typical golf scores are 60-80)
                                      if (player.holesPlayed >= 18 && player.roundScore > 18) {
                                        return player.roundScore
                                      }
                                      
                                      // For live rounds or relative-to-par scores, show with +/- formatting
                                      if (player.roundScore === 0) return 'E'
                                      return player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore
                                    })()}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono">
                                    {player.currentPosition === 'WD' ? 'WD' : getHolesDisplay(player.holesPlayed)}
                                  </td>
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
          <p className="text-muted-foreground">No parlays found.</p>
        </div>
      )}
    </div>
  );
}
'use client';

import { useState, useEffect, useMemo } from 'react';
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
  const [showSettled, setShowSettled] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { refetch } = useParlaysQuery(userId);

  // Last sync timestamp state
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Load last sync from localStorage on mount
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('lastSync') : null;
    if (t) setLastSync(new Date(t));
  }, []);

  // Helper to organize and filter parlays
  const organizedParlays = useMemo(() => {
    if (!Array.isArray(parlays)) return { active: [], settled: [], activeTotal: 0, settledTotal: 0 };
    

    
    // A parlay is settled if all its picks have been settled
    const active = parlays.filter((parlay: any) => {
      if (!Array.isArray(parlay.picks)) return true;
      return parlay.picks.some((pick: any) => 
        !pick.settlement_status || pick.settlement_status === 'pending'
      );
    });
    
    const settled = parlays.filter((parlay: any) => {
      if (!Array.isArray(parlay.picks) || parlay.picks.length === 0) return false;
      return parlay.picks.every((pick: any) => 
        pick.settlement_status === 'settled'
      );
    });
    
    // Enhanced sort function: tournament name → round number → tee time (earliest first) → creation date (newest first)
    const sortParlays = (a: any, b: any) => {
      // Helper to extract tournament name from picks
      const getTournamentName = (parlay: any) => {
        if (!parlay.picks?.[0]?.players?.[0]) return 'Unknown Tournament';
        // Look for eventName in the player data structure
        const firstPlayer = parlay.picks[0].players[0];
        return firstPlayer.eventName || parlay.tournament_name || 'Unknown Tournament';
      };
      
      // Helper to extract earliest tee time from parlay picks
      const getEarliestTeeTime = (parlay: any) => {
        if (!parlay.picks?.length) return null;
        
        // Get all tee times from the picks (now directly available via API)
        const teeTimes: Date[] = [];
        
        parlay.picks.forEach((pick: any) => {
          if (pick.tee_time) {
            try {
              const teeTime = new Date(pick.tee_time);
              if (!isNaN(teeTime.getTime())) {
                teeTimes.push(teeTime);
              }
            } catch (e) {
              // Ignore invalid dates
            }
          }
        });
        
        // Return the earliest tee time, or null if none found
        return teeTimes.length > 0 ? new Date(Math.min(...teeTimes.map(t => t.getTime()))) : null;
      };
      
      const aTournament = getTournamentName(a);
      const bTournament = getTournamentName(b);
      
      if (aTournament !== bTournament) {
        return aTournament.localeCompare(bTournament);
      }
      
      // Then by round number
      if (a.round_num !== b.round_num) {
        return (a.round_num || 0) - (b.round_num || 0);
      }
      
      // Then by tee time (earliest first)
      const aTeeTime = getEarliestTeeTime(a);
      const bTeeTime = getEarliestTeeTime(b);
      
      if (aTeeTime && bTeeTime) {
        const timeDiff = aTeeTime.getTime() - bTeeTime.getTime();
        if (timeDiff !== 0) {
          return timeDiff; // Earlier tee times first
        }
      } else if (aTeeTime && !bTeeTime) {
        return -1; // Parlays with tee times come before those without
      } else if (!aTeeTime && bTeeTime) {
        return 1; // Parlays without tee times come after those with
      }
      
      // Finally by creation date (newest first)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    };
    
    const sortedActive = active.sort(sortParlays);
    const sortedSettled = settled.sort(sortParlays);
    
    // Apply pagination to active parlays (most important)
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedActive = sortedActive.slice(startIndex, startIndex + pageSize);
    
    return {
      active: paginatedActive,
      settled: showSettled ? sortedSettled.slice(0, pageSize) : [], // Limit settled too
      activeTotal: sortedActive.length,
      settledTotal: sortedSettled.length
    };
  }, [parlays, currentPage, pageSize, showSettled]);

  // Helper to extract tournament name from parlay
  const getTournamentName = (parlay: any): string => {
    return parlay.tournament_name || 'Unknown Tournament';
  };

  // Helper to determine overall parlay outcome
  const getParlayOutcome = (parlay: any): { status: string; color: string } => {
    if (!parlay.picks || parlay.picks.length === 0) {
      return { status: 'Pending', color: 'bg-gray-100 text-gray-700' };
    }

    const outcomes = parlay.picks.map((pick: any) => pick.pick_outcome).filter(Boolean);
    
    if (outcomes.length === 0) {
      return { status: 'Pending', color: 'bg-gray-100 text-gray-700' };
    }

    // Check if any pick was a loss
    if (outcomes.includes('loss')) {
      return { status: 'Lost', color: 'bg-red-100 text-red-700' };
    }

    // Check if any pick is void
    if (outcomes.includes('void')) {
      // If all non-void picks are wins, treat as void (refund)
      const nonVoidOutcomes = outcomes.filter((o: string) => o !== 'void');
      if (nonVoidOutcomes.length === 0 || nonVoidOutcomes.every((o: string) => o === 'win')) {
        return { status: 'Void', color: 'bg-gray-100 text-gray-700' };
      }
      // If there are losses among non-void picks, it's still a loss
      if (nonVoidOutcomes.includes('loss')) {
        return { status: 'Lost', color: 'bg-red-100 text-red-700' };
      }
    }

    // Check if any pick is a push
    if (outcomes.includes('push')) {
      // If all picks are wins or pushes, it's a push
      if (outcomes.every((o: string) => o === 'win' || o === 'push')) {
        return { status: 'Push', color: 'bg-yellow-100 text-yellow-700' };
      }
    }

    // If all picks are wins, parlay wins
    if (outcomes.every((o: string) => o === 'win')) {
      return { status: 'Won', color: 'bg-green-100 text-green-700' };
    }

    // Default to pending if we can't determine
    return { status: 'Pending', color: 'bg-gray-100 text-gray-700' };
  };

  // Pagination helpers
  const totalPages = Math.ceil(organizedParlays.activeTotal / pageSize);
  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;

  // Auto-sync and settle on page load
  useEffect(() => {
    const autoSyncAndSettle = async () => {
      if (autoProcessing) return; // Prevent multiple simultaneous runs
      
      setAutoProcessing(true);
      try {
        // First sync the latest stats
        const syncRes = await fetch('/api/live-stats/sync', { method: 'GET' });
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
    <div className="mx-auto px-3 sm:px-6 space-y-4 sm:space-y-6 max-w-6xl">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold">My Parlays</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="text-sm text-muted-foreground">
              {organizedParlays.activeTotal} active • {organizedParlays.settledTotal} settled
            </span>
            {organizedParlays.settledTotal > 0 && (
              <button
                onClick={() => setShowSettled(!showSettled)}
                className="text-sm text-primary hover:text-primary/80 underline text-left sm:text-center"
              >
                {showSettled ? 'Hide Settled' : 'Show Settled'}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
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

      {/* Mobile-Optimized Pagination Controls */}
      {organizedParlays.activeTotal > pageSize && (
        <div className="space-y-4 py-4 border-b border-border">
          {/* Page Info */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} • Showing {Math.min(pageSize, organizedParlays.activeTotal - (currentPage - 1) * pageSize)} of {organizedParlays.activeTotal} active parlays
            </div>
          </div>
          
          {/* Mobile-friendly pagination and page size controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Show:</label>
              <select 
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-sm border border-border rounded-md px-3 py-2 bg-background min-w-[120px]"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>

            {/* Navigation Buttons - Mobile Optimized */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={!canPrevPage}
                className="px-4 py-2 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent touch-manipulation"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!canPrevPage}
                className="px-4 py-2 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent touch-manipulation"
              >
                Prev
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!canNextPage}
                className="px-4 py-2 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent touch-manipulation"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={!canNextPage}
                className="px-4 py-2 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent touch-manipulation"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {organizedParlays.active.length > 0 || (showSettled && organizedParlays.settled.length > 0) ? (
        <div className="space-y-6 sm:space-y-8">
          {/* Active Parlays */}
          {organizedParlays.active.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-lg sm:text-xl font-semibold text-primary">Active Parlays</h2>
              {organizedParlays.active.map((parlay: any, idx: number) => {
                const cardProps = mapParlayToCardProps(parlay);
                if (!cardProps) return null;
                return (
                  <div
                    key={parlay.uuid}
                    className="relative rounded-lg shadow-md border bg-neutral-900 border-border"
                  >
                    {/* Mobile-Optimized Header */}
                    <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3 sm:space-y-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg sm:text-xl font-bold tracking-tight">Parlay #{idx + 1}</span>
                          {(() => {
                            const outcome = getParlayOutcome(parlay);
                            if (outcome.status !== 'Pending') {
                              return (
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${outcome.color}`}>
                                  {outcome.status}
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                        
                        {/* Mobile: Stack info vertically, Desktop: Horizontal */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-neutral-200">
                          <span className="text-xs font-medium text-primary">{getTournamentName(parlay)}</span>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <span>Round {cardProps.round}</span>
                            <span className="font-semibold">
                              ${cardProps.amount.toLocaleString()} → ${cardProps.payout.toLocaleString()}
                            </span>
                            <span className="font-mono text-primary">+{cardProps.odds}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matchups - Mobile Optimized */}
                    <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                      {[...parlay.picks]
                        .sort((a: any, b: any) => {
                          // Sort picks by tee time (earliest first)
                          const aTeeTime = a.tee_time;
                          const bTeeTime = b.tee_time;
                          
                          if (aTeeTime && bTeeTime) {
                            return new Date(aTeeTime).getTime() - new Date(bTeeTime).getTime();
                          } else if (aTeeTime && !bTeeTime) {
                            return -1;
                          } else if (!aTeeTime && bTeeTime) {
                            return 1;
                          }
                          return 0;
                        })
                        .map((apiPick: any, mIdx: number) => {
                          const pick: ParlayPickDisplay = { 
                            matchup: [], 
                            players: apiPick.players || [] 
                          };
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
                            className={`relative rounded-md border ${cardBg} overflow-hidden`}
                          >
                            {/* Status bar */}
                            <div className={`absolute left-0 top-0 h-full w-1 ${statusBarColor}`} />
                            
                            {/* Matchup Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 pt-3 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary text-base">
                                  Matchup {mIdx + 1}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({pick.players.length === 2 ? '2-ball' : '3-ball'})
                                </span>
                              </div>
                              {finalStatus && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold
                                  ${finalStatus === 'won' ? 'bg-green-100 text-green-700' : ''}
                                  ${finalStatus === 'lost' ? 'bg-red-100 text-red-700' : ''}
                                  ${finalStatus === 'tied' ? 'bg-yellow-100 text-yellow-700' : ''}
                                  ${finalStatus === 'void' ? 'bg-gray-100 text-gray-700' : ''}
                                `}>
                                  {finalStatus.toUpperCase()}
                                </span>
                              )}
                            </div>

                            {/* Desktop: Table, Mobile: Cards */}
                            <div className="px-4 pb-3">
                              {/* Mobile Card Layout */}
                              <div className="block sm:hidden space-y-2">
                                {pick.players.map((player, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className={`p-3 rounded border ${
                                      player.isUserPick
                                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-muted/50 border-border/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${
                                          player.isUserPick ? 'text-primary font-semibold' : 'text-foreground'
                                        }`}>
                                          {player.name}
                                          {player.isUserPick && (
                                            <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                              Pick
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 ml-3">
                                        <div className="text-right">
                                          <div className="font-mono font-semibold">
                                            {(() => {
                                              if (player.currentPosition === 'WD') return 'WD'
                                              if (typeof player.roundScore !== 'number') return '-'
                                              if (player.holesPlayed >= 18 && player.roundScore > 18) {
                                                return player.roundScore
                                              }
                                              if (player.roundScore === 0) return 'E'
                                              return player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore
                                            })()}
                                          </div>
                                          <div className="text-xs text-muted-foreground">Score</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-mono font-semibold">
                                            {player.currentPosition === 'WD' ? 'WD' : getHolesDisplay(player.holesPlayed)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">Thru</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Desktop Table Layout */}
                              <div className="hidden sm:block overflow-x-auto">
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
                                            if (player.currentPosition === 'WD') return 'WD'
                                            if (typeof player.roundScore !== 'number') return '-'
                                            if (player.holesPlayed >= 18 && player.roundScore > 18) {
                                              return player.roundScore
                                            }
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Settled Parlays - Same mobile optimizations */}
          {showSettled && organizedParlays.settled.length > 0 && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-lg sm:text-xl font-semibold text-muted-foreground">Settled Parlays</h2>
              {organizedParlays.settled.map((parlay: any, idx: number) => {
                const cardProps = mapParlayToCardProps(parlay);
                if (!cardProps) return null;
                return (
                  <div
                    key={parlay.uuid}
                    className="relative rounded-lg shadow-md border bg-neutral-900/50 border-border/50 opacity-75"
                  >
                    {/* Mobile-Optimized Header */}
                    <div className="px-4 sm:px-6 pt-4 pb-3 space-y-3 sm:space-y-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg sm:text-xl font-bold tracking-tight">
                            Parlay #{organizedParlays.active.length + idx + 1}
                          </span>
                          {(() => {
                            const outcome = getParlayOutcome(parlay);
                            return (
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${outcome.color}`}>
                                {outcome.status}
                              </span>
                            );
                          })()}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-neutral-200">
                          <span className="text-xs font-medium text-primary">{getTournamentName(parlay)}</span>
                          <div className="flex items-center gap-4 sm:gap-6">
                            <span>Round {cardProps.round}</span>
                            <span className="font-semibold">
                              ${cardProps.amount.toLocaleString()} → ${cardProps.payout.toLocaleString()}
                            </span>
                            <span className="font-mono text-primary">+{cardProps.odds}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Matchups - Mobile Optimized (same as active parlays) */}
                    <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
                      {[...parlay.picks]
                        .sort((a: any, b: any) => {
                          // Sort picks by tee time (earliest first)
                          const aTeeTime = a.tee_time;
                          const bTeeTime = b.tee_time;
                          
                          if (aTeeTime && bTeeTime) {
                            return new Date(aTeeTime).getTime() - new Date(bTeeTime).getTime();
                          } else if (aTeeTime && !bTeeTime) {
                            return -1;
                          } else if (!aTeeTime && bTeeTime) {
                            return 1;
                          }
                          return 0;
                        })
                        .map((apiPick: any, mIdx: number) => {
                          const pick: ParlayPickDisplay = { 
                            matchup: [], 
                            players: apiPick.players || [] 
                          };
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
                            className={`relative rounded-md border ${cardBg} overflow-hidden`}
                          >
                            <div className={`absolute left-0 top-0 h-full w-1 ${statusBarColor}`} />
                            
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 pt-3 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-primary text-base">
                                  Matchup {mIdx + 1}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({pick.players.length === 2 ? '2-ball' : '3-ball'})
                                </span>
                              </div>
                              {finalStatus && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold
                                  ${finalStatus === 'won' ? 'bg-green-100 text-green-700' : ''}
                                  ${finalStatus === 'lost' ? 'bg-red-100 text-red-700' : ''}
                                  ${finalStatus === 'tied' ? 'bg-yellow-100 text-yellow-700' : ''}
                                  ${finalStatus === 'void' ? 'bg-gray-100 text-gray-700' : ''}
                                `}>
                                  {finalStatus.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <div className="px-4 pb-3">
                              {/* Mobile Card Layout */}
                              <div className="block sm:hidden space-y-2">
                                {pick.players.map((player, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className={`p-3 rounded border ${
                                      player.isUserPick
                                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                                        : 'bg-muted/50 border-border/50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <div className={`font-medium truncate ${
                                          player.isUserPick ? 'text-primary font-semibold' : 'text-foreground'
                                        }`}>
                                          {player.name}
                                          {player.isUserPick && (
                                            <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                              Pick
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 ml-3">
                                        <div className="text-right">
                                          <div className="font-mono font-semibold">
                                            {(() => {
                                              if (player.currentPosition === 'WD') return 'WD'
                                              if (typeof player.roundScore !== 'number') return '-'
                                              if (player.holesPlayed >= 18 && player.roundScore > 18) {
                                                return player.roundScore
                                              }
                                              if (player.roundScore === 0) return 'E'
                                              return player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore
                                            })()}
                                          </div>
                                          <div className="text-xs text-muted-foreground">Score</div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-mono font-semibold">
                                            {player.currentPosition === 'WD' ? 'WD' : getHolesDisplay(player.holesPlayed)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">Thru</div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Desktop Table Layout */}
                              <div className="hidden sm:block overflow-x-auto">
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
                                            if (player.currentPosition === 'WD') return 'WD'
                                            if (typeof player.roundScore !== 'number') return '-'
                                            if (player.holesPlayed >= 18 && player.roundScore > 18) {
                                              return player.roundScore
                                            }
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16 border border-dashed border-border/50 rounded-lg">
          <p className="text-muted-foreground text-lg">No active parlays found.</p>
          <p className="text-muted-foreground text-sm mt-2">Create your first parlay from the Dashboard!</p>
        </div>
      )}
    </div>
  );
}
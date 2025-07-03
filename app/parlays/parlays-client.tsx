'use client';

import { useState, useEffect, useMemo } from 'react';
import { ParlayCardProps, ParlayPickDisplay, ParlayPlayerDisplay } from '@/components/parlay-card/parlay-card';
import { toast } from '@/components/ui/use-toast';
import { useParlaysQuery } from '@/hooks/use-parlays-query';
import { calculateParlayConfidence, getConfidenceColor, getConfidenceLabel } from '@/lib/parlay-confidence';

export default function ParlaysClient() {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

  // Persistent data via React Query
  const { data, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];

  // Error toast for loading
  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Error Loading Parlays', description: error.message, variant: 'destructive' });
    }
  }, [isError, error]);

  const [showSettled, setShowSettled] = useState(false);
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // Helper to organize and filter parlays
  const organizedParlays = useMemo(() => {
    if (!Array.isArray(parlays)) return { active: [], settled: [], activeTotal: 0, settledTotal: 0 };
    
    // Helper function to check if a pick is settled
    const isPickSettled = (pick: any): boolean => {
      return pick.settlement_status === 'settled' || 
             (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome));
    };
    
    // A parlay is settled if all its picks have been settled
    const settled = parlays.filter((parlay: any) => {
      if (!Array.isArray(parlay.picks) || parlay.picks.length === 0) return false;
      return parlay.picks.every((pick: any) => isPickSettled(pick));
    });
    
    const active = parlays.filter((parlay: any) => {
      if (!Array.isArray(parlay.picks)) return true;
      return parlay.picks.some((pick: any) => !isPickSettled(pick));
    });
    
    // Sort parlays
    const sortParlays = (a: any, b: any) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    };
    
    const sortedActive = active.sort(sortParlays);
    const sortedSettled = settled.sort(sortParlays);
    
    // Apply pagination
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedActive = sortedActive.slice(startIndex, startIndex + pageSize);
    
    return {
      active: paginatedActive,
      settled: showSettled ? sortedSettled.slice(0, pageSize) : [],
      activeTotal: sortedActive.length,
      settledTotal: sortedSettled.length
    };
  }, [parlays, currentPage, pageSize, showSettled]);

  // Helper to get tournament name
  const getTournamentName = (parlay: any): string => {
    return parlay.tournament_name || 'Unknown Tournament';
  };

  // Helper to determine overall parlay outcome
  const getParlayOutcome = (parlay: any): { status: string; color: string; bgColor: string } => {
    if (!parlay.picks || parlay.picks.length === 0) {
      return { 
        status: 'Pending', 
        color: 'text-gray-400', 
        bgColor: 'bg-gray-500/10'
      };
    }

    const outcomes = parlay.picks.map((pick: any) => pick.pick_outcome).filter(Boolean);
    
    if (outcomes.length === 0) {
      return { 
        status: 'Pending', 
        color: 'text-gray-400', 
        bgColor: 'bg-gray-500/10'
      };
    }

    if (outcomes.includes('loss')) {
      return { 
        status: 'Lost', 
        color: 'text-red-400', 
        bgColor: 'bg-red-500/10'
      };
    }

    if (outcomes.includes('void')) {
      const nonVoidOutcomes = outcomes.filter((o: string) => o !== 'void');
      if (nonVoidOutcomes.length === 0 || nonVoidOutcomes.every((o: string) => o === 'win')) {
        return { 
          status: 'Void', 
          color: 'text-gray-400', 
          bgColor: 'bg-gray-500/10'
        };
      }
      if (nonVoidOutcomes.includes('loss')) {
        return { 
          status: 'Lost', 
          color: 'text-red-400', 
          bgColor: 'bg-red-500/10'
        };
      }
    }

    if (outcomes.includes('push')) {
      if (outcomes.every((o: string) => o === 'win' || o === 'push')) {
        return { 
          status: 'Push', 
          color: 'text-yellow-400', 
          bgColor: 'bg-yellow-500/10'
        };
      }
    }

    if (outcomes.every((o: string) => o === 'win')) {
      return { 
        status: 'Won', 
        color: 'text-green-400', 
        bgColor: 'bg-green-500/10'
      };
    }

    return { 
      status: 'Pending', 
      color: 'text-gray-400', 
      bgColor: 'bg-gray-500/10'
    };
  };

  // Helper to get matchup summary
  const getMatchupSummary = (pick: any): { winner: string; status: string; color: string } => {
    if (!pick.players || pick.players.length === 0) {
      return { winner: '-', status: 'pending', color: 'text-gray-400' };
    }

    const userPick = pick.players.find((p: any) => p.isUserPick);
    if (!userPick) {
      return { winner: '-', status: 'pending', color: 'text-gray-400' };
    }

    // First check if the pick has been officially settled
    if (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome)) {
      if (pick.pick_outcome === 'win') {
        return { winner: userPick.name, status: 'won', color: 'text-green-400' };
      } else if (pick.pick_outcome === 'loss') {
        return { winner: userPick.name, status: 'lost', color: 'text-red-400' };
      } else if (pick.pick_outcome === 'push') {
        return { winner: userPick.name, status: 'push', color: 'text-yellow-400' };
      } else if (pick.pick_outcome === 'void') {
        return { winner: userPick.name, status: 'void', color: 'text-gray-400' };
      }
    }

    // If not settled, check current live status
    // A player is considered "complete" if they played 18 holes OR withdrew
    const isComplete = pick.players.every((p: any) => p.holesPlayed >= 18 || p.currentPosition === 'WD');
    
    if (!isComplete) {
      // In progress - check who's leading (use lighter colors for in-progress)
      const userScore = userPick.roundScore || 0;
      const otherPlayers = pick.players.filter((p: any) => !p.isUserPick && p.currentPosition !== 'WD');
      if (otherPlayers.length === 0) {
        // All other players withdrew, user wins by default
        return { winner: userPick.name, status: 'leading', color: 'text-green-300' };
      }
      const bestOtherScore = Math.min(...otherPlayers.map((p: any) => p.roundScore || 0));
      
      if (userScore < bestOtherScore) {
        return { winner: userPick.name, status: 'leading', color: 'text-green-300' };
      } else if (userScore > bestOtherScore) {
        return { winner: userPick.name, status: 'trailing', color: 'text-red-300' };
      } else {
        return { winner: userPick.name, status: 'tied', color: 'text-yellow-300' };
      }
    } else {
      // Round complete but not yet settled - show final round result
      const userScore = userPick.roundScore || 0;
      const otherPlayers = pick.players.filter((p: any) => !p.isUserPick && p.currentPosition !== 'WD');
      if (otherPlayers.length === 0) {
        // All other players withdrew, user wins by default
        return { winner: userPick.name, status: 'won', color: 'text-green-400' };
      }
      const bestOtherScore = Math.min(...otherPlayers.map((p: any) => p.roundScore || 0));
      
      if (userScore < bestOtherScore) {
        return { winner: userPick.name, status: 'won', color: 'text-green-400' };
      } else if (userScore > bestOtherScore) {
        return { winner: userPick.name, status: 'lost', color: 'text-red-400' };
      } else {
        return { winner: userPick.name, status: 'push', color: 'text-yellow-400' };
      }
    }

    return { winner: userPick.name, status: 'pending', color: 'text-gray-400' };
  };

  // Pagination helpers
  const totalPages = Math.ceil(organizedParlays.activeTotal / pageSize);
  const canPrevPage = currentPage > 1;
  const canNextPage = currentPage < totalPages;


  return (
    <div className="min-h-screen bg-dashboard">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Parlays</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {organizedParlays.activeTotal} active • {organizedParlays.settledTotal} settled
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {organizedParlays.settledTotal > 0 && (
              <button
                onClick={() => setShowSettled(!showSettled)}
                className="text-sm btn-glass px-4 py-2"
              >
                {showSettled ? 'Hide Settled' : 'Show Settled'}
              </button>
            )}
            
            {/* Page Size Selector */}
            <select 
              value={pageSize} 
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-sm glass-card px-3 py-2 bg-transparent"
            >
              <option value={6}>6 per page</option>
              <option value={12}>12 per page</option>
              <option value={24}>24 per page</option>
              <option value={48}>48 per page</option>
            </select>
          </div>
        </div>

        {/* Pagination Controls - Top */}
        {organizedParlays.activeTotal > pageSize && (
          <div className="flex justify-center items-center gap-2 mb-6">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={!canPrevPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!canPrevPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-muted-foreground px-3">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!canNextPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={!canNextPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Last
            </button>
          </div>
        )}

        {/* Parlays Grid */}
        {organizedParlays.active.length > 0 || (showSettled && organizedParlays.settled.length > 0) ? (
          <div>
            {/* Active Parlays */}
            {organizedParlays.active.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-primary mb-4">Active Parlays</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {organizedParlays.active.map((parlay: any, idx: number) => {
                    const outcome = getParlayOutcome(parlay);
                    const confidence = calculateParlayConfidence(parlay);
                    return (
                      <div
                        key={parlay.id}
                        className="glass-card hover:glass-hover transition-all duration-300 p-4"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-base">Parlay #{idx + 1}</h3>
                            <p className="text-xs text-muted-foreground">{getTournamentName(parlay)} R{parlay.round_num}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 min-w-0">
                            <span className={`text-xs font-semibold ${outcome.color} ${outcome.bgColor} px-2 py-1 rounded whitespace-nowrap`}>
                              {outcome.status}
                            </span>
                            <div className="text-right">
                              <div className={`text-sm font-bold ${getConfidenceColor(confidence.overallConfidence)}`}>
                                {confidence.overallConfidence}%
                              </div>
                              <div className="text-xs text-muted-foreground">
                                confidence
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Parlay Stats */}
                        <div className="flex items-center justify-between mb-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">+{parlay.odds}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>${parlay.amount}</span>
                          </div>
                          <span className="font-semibold">${parlay.payout?.toLocaleString()}</span>
                        </div>


                        {/* All Picks */}
                        <div className="space-y-2">
                          {parlay.picks.map((pick: any, pIdx: number) => {
                            const summary = getMatchupSummary(pick);
                            const statusBgColor = summary.color.includes('green') ? 'bg-green-500/20' :
                                                  summary.color.includes('red') ? 'bg-red-500/20' :
                                                  summary.color.includes('yellow') ? 'bg-yellow-500/20' :
                                                  'bg-gray-500/20';
                            const statusDotColor = summary.color.includes('green') ? 'bg-green-500' :
                                                   summary.color.includes('red') ? 'bg-red-500' :
                                                   summary.color.includes('yellow') ? 'bg-yellow-500' :
                                                   'bg-gray-500';
                            const statusIntensity = summary.color === 'text-green-400' || summary.color === 'text-red-400' || summary.color === 'text-yellow-400' ? 
                                                    'border-opacity-50' : 'border-opacity-30';
                            return (
                              <div key={pIdx} className={`text-sm py-3 px-3 rounded ${statusBgColor} border ${statusIntensity}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${statusDotColor}`} />
                                    <span className="text-muted-foreground">#{pIdx + 1}</span>
                                    <span className="truncate font-medium">{summary.winner}</span>
                                  </div>
                                  <span className={`${summary.color} font-semibold`}>
                                    {summary.status.toUpperCase()}
                                  </span>
                                </div>
                                {(() => {
                                  const userPick = pick.players?.find((p: any) => p.isUserPick);
                                  const allPlayers = pick.players?.filter((p: any) => p.currentPosition !== 'WD') || [];
                                  
                                  if (!userPick || allPlayers.length === 0) return null;
                                  
                                  const holesCompleted = userPick.holesPlayed || 0;
                                  const isComplete = pick.players?.every((p: any) => p.holesPlayed >= 18 || p.currentPosition === 'WD');
                                  
                                  // Format score display
                                  const formatScore = (score: number) => score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;
                                  
                                  // Sort players by score (best to worst)
                                  const sortedPlayers = [...allPlayers].sort((a, b) => (a.roundScore || 0) - (b.roundScore || 0));
                                  
                                  // Determine status for completed rounds
                                  let statusDisplay = `thru ${holesCompleted}`;
                                  if (isComplete) {
                                    const userScore = userPick.roundScore || 0;
                                    const bestScore = Math.min(...allPlayers.map(p => p.roundScore || 0));
                                    const winnerCount = allPlayers.filter(p => (p.roundScore || 0) === bestScore).length;
                                    
                                    if (userScore === bestScore && winnerCount === 1) {
                                      statusDisplay = '🏆 Won';
                                    } else if (userScore === bestScore && winnerCount > 1) {
                                      statusDisplay = 'Tied';
                                    } else {
                                      const margin = userScore - bestScore;
                                      statusDisplay = `-${margin}`;
                                    }
                                  }
                                  
                                  return (
                                    <div className="space-y-1">
                                      {!isComplete && (
                                        <div className="flex justify-end mb-1">
                                          <span className="text-xs font-medium opacity-60">
                                            {statusDisplay}
                                          </span>
                                        </div>
                                      )}
                                      {sortedPlayers.map((player, playerIdx) => {
                                        const score = formatScore(player.roundScore || 0);
                                        const isUser = player.isUserPick;
                                        return (
                                          <div key={playerIdx} className="flex items-center justify-between text-xs opacity-80">
                                            <span className={`${isUser ? 'font-extrabold' : ''}`}>
                                              {player.name}
                                            </span>
                                            <span className="font-mono">
                                              {score}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Settled Parlays */}
            {showSettled && organizedParlays.settled.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-muted-foreground mb-4">Settled Parlays</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {organizedParlays.settled.map((parlay: any, idx: number) => {
                    const outcome = getParlayOutcome(parlay);
                    const confidence = calculateParlayConfidence(parlay);
                    return (
                      <div
                        key={parlay.id}
                        className="glass-card opacity-75 p-4"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-base">Parlay #{organizedParlays.active.length + idx + 1}</h3>
                            <p className="text-xs text-muted-foreground">{getTournamentName(parlay)} R{parlay.round_num}</p>
                          </div>
                          <span className={`text-xs font-semibold ${outcome.color} ${outcome.bgColor} px-2 py-1 rounded`}>
                            {outcome.status}
                          </span>
                        </div>

                        {/* Parlay Stats */}
                        <div className="flex items-center justify-between mb-3 text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-primary">+{parlay.odds}</span>
                            <span className="text-muted-foreground">•</span>
                            <span>${parlay.amount}</span>
                          </div>
                          <span className="font-semibold">
                            {outcome.status === 'Won' ? `$${parlay.payout?.toLocaleString()}` : '$0'}
                          </span>
                        </div>

                        {/* All Picks */}
                        <div className="space-y-2">
                          {parlay.picks.map((pick: any, pIdx: number) => {
                            const summary = getMatchupSummary(pick);
                            const statusBgColor = summary.color.includes('green') ? 'bg-green-500/20' :
                                                  summary.color.includes('red') ? 'bg-red-500/20' :
                                                  summary.color.includes('yellow') ? 'bg-yellow-500/20' :
                                                  'bg-gray-500/20';
                            const statusDotColor = summary.color.includes('green') ? 'bg-green-500' :
                                                   summary.color.includes('red') ? 'bg-red-500' :
                                                   summary.color.includes('yellow') ? 'bg-yellow-500' :
                                                   'bg-gray-500';
                            const statusIntensity = summary.color === 'text-green-400' || summary.color === 'text-red-400' || summary.color === 'text-yellow-400' ? 
                                                    'border-opacity-50' : 'border-opacity-30';
                            return (
                              <div key={pIdx} className={`text-sm py-3 px-3 rounded ${statusBgColor} border ${statusIntensity}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-2 h-2 rounded-full ${statusDotColor}`} />
                                    <span className="text-muted-foreground">#{pIdx + 1}</span>
                                    <span className="truncate font-medium">{summary.winner}</span>
                                  </div>
                                  <span className={`${summary.color} font-semibold`}>
                                    {summary.status.toUpperCase()}
                                  </span>
                                </div>
                                {(() => {
                                  const userPick = pick.players?.find((p: any) => p.isUserPick);
                                  const allPlayers = pick.players?.filter((p: any) => p.currentPosition !== 'WD') || [];
                                  
                                  if (!userPick || allPlayers.length === 0) return null;
                                  
                                  const holesCompleted = userPick.holesPlayed || 0;
                                  const isComplete = pick.players?.every((p: any) => p.holesPlayed >= 18 || p.currentPosition === 'WD');
                                  
                                  // Format score display
                                  const formatScore = (score: number) => score === 0 ? 'E' : score > 0 ? `+${score}` : `${score}`;
                                  
                                  // Sort players by score (best to worst)
                                  const sortedPlayers = [...allPlayers].sort((a, b) => (a.roundScore || 0) - (b.roundScore || 0));
                                  
                                  // Determine status for completed rounds
                                  let statusDisplay = `thru ${holesCompleted}`;
                                  if (isComplete) {
                                    const userScore = userPick.roundScore || 0;
                                    const bestScore = Math.min(...allPlayers.map(p => p.roundScore || 0));
                                    const winnerCount = allPlayers.filter(p => (p.roundScore || 0) === bestScore).length;
                                    
                                    if (userScore === bestScore && winnerCount === 1) {
                                      statusDisplay = '🏆 Won';
                                    } else if (userScore === bestScore && winnerCount > 1) {
                                      statusDisplay = 'Tied';
                                    } else {
                                      const margin = userScore - bestScore;
                                      statusDisplay = `-${margin}`;
                                    }
                                  }
                                  
                                  return (
                                    <div className="space-y-1">
                                      {!isComplete && (
                                        <div className="flex justify-end mb-1">
                                          <span className="text-xs font-medium opacity-60">
                                            {statusDisplay}
                                          </span>
                                        </div>
                                      )}
                                      {sortedPlayers.map((player, playerIdx) => {
                                        const score = formatScore(player.roundScore || 0);
                                        const isUser = player.isUserPick;
                                        return (
                                          <div key={playerIdx} className="flex items-center justify-between text-xs opacity-80">
                                            <span className={`${isUser ? 'font-extrabold' : ''}`}>
                                              {player.name}
                                            </span>
                                            <span className="font-mono">
                                              {score}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-card text-center py-16">
            <p className="text-muted-foreground text-lg">No active parlays found.</p>
            <p className="text-muted-foreground text-sm mt-2">Create your first parlay from the Dashboard!</p>
          </div>
        )}

        {/* Bottom Pagination for convenience */}
        {organizedParlays.activeTotal > pageSize && (
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={!canPrevPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!canPrevPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-muted-foreground px-3">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!canNextPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={!canNextPage}
              className="btn-glass px-3 py-1 text-sm disabled:opacity-50"
            >
              Last
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
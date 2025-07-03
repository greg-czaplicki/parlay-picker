'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ParlayDetailModalProps {
  parlay: any;
  isOpen: boolean;
  onClose: () => void;
}

export function ParlayDetailModal({ parlay, isOpen, onClose }: ParlayDetailModalProps) {
  if (!isOpen || !parlay) return null;

  const getHolesDisplay = (holesPlayed: number): string | number => {
    if (holesPlayed === 0) return 1;
    if (holesPlayed === 18) return 'F';
    return holesPlayed;
  };

  const getScoreDisplay = (player: any) => {
    if (player.currentPosition === 'WD') return 'WD';
    if (typeof player.roundScore !== 'number') return '-';
    if (player.holesPlayed >= 18 && player.roundScore > 18) {
      return player.roundScore;
    }
    if (player.roundScore === 0) return 'E';
    return player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore;
  };

  const getPickStatus = (pick: any) => {
    const userPick = pick.players?.find((p: any) => p.isUserPick);
    
    // First check if the pick has been officially settled
    if (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome)) {
      if (pick.pick_outcome === 'win') return { label: 'Won', color: 'text-green-400 bg-green-500/20', borderColor: 'border-green-500/50' };
      if (pick.pick_outcome === 'loss') return { label: 'Lost', color: 'text-red-400 bg-red-500/20', borderColor: 'border-red-500/50' };
      if (pick.pick_outcome === 'push') return { label: 'Push', color: 'text-yellow-400 bg-yellow-500/20', borderColor: 'border-yellow-500/50' };
      if (pick.pick_outcome === 'void') return { label: 'Void', color: 'text-gray-400 bg-gray-500/20', borderColor: 'border-gray-500/50' };
    }

    if (!userPick || !pick.players) {
      return { label: 'Pending', color: 'text-gray-400 bg-gray-500/20', borderColor: 'border-gray-500/30' };
    }

    // If not settled, check current live status
    // A player is considered "complete" if they played 18 holes OR withdrew
    const isComplete = pick.players.every((p: any) => p.holesPlayed >= 18 || p.currentPosition === 'WD');
    
    if (!isComplete) {
      // In progress - check who's leading (use lighter colors)
      const userScore = userPick.roundScore || 0;
      const otherPlayers = pick.players.filter((p: any) => !p.isUserPick && p.currentPosition !== 'WD');
      if (otherPlayers.length === 0) {
        // All other players withdrew, user wins by default
        return { label: 'Leading', color: 'text-green-300 bg-green-500/15', borderColor: 'border-green-500/30' };
      }
      const bestOtherScore = Math.min(...otherPlayers.map((p: any) => p.roundScore || 0));
      
      if (userScore < bestOtherScore) {
        return { label: 'Leading', color: 'text-green-300 bg-green-500/15', borderColor: 'border-green-500/30' };
      } else if (userScore > bestOtherScore) {
        return { label: 'Trailing', color: 'text-red-300 bg-red-500/15', borderColor: 'border-red-500/30' };
      } else {
        return { label: 'Tied', color: 'text-yellow-300 bg-yellow-500/15', borderColor: 'border-yellow-500/30' };
      }
    } else {
      // Round complete but not yet settled
      const userScore = userPick.roundScore || 0;
      const otherPlayers = pick.players.filter((p: any) => !p.isUserPick && p.currentPosition !== 'WD');
      if (otherPlayers.length === 0) {
        // All other players withdrew, user wins by default
        return { label: 'Won', color: 'text-green-400 bg-green-500/20', borderColor: 'border-green-500/40' };
      }
      const bestOtherScore = Math.min(...otherPlayers.map((p: any) => p.roundScore || 0));
      
      if (userScore < bestOtherScore) {
        return { label: 'Won', color: 'text-green-400 bg-green-500/20', borderColor: 'border-green-500/40' };
      } else if (userScore > bestOtherScore) {
        return { label: 'Lost', color: 'text-red-400 bg-red-500/20', borderColor: 'border-red-500/40' };
      } else {
        return { label: 'Push', color: 'text-yellow-400 bg-yellow-500/20', borderColor: 'border-yellow-500/40' };
      }
    }
  };

  const getParlayOutcome = () => {
    if (!parlay.picks || parlay.picks.length === 0) {
      return { status: 'Pending', color: 'text-gray-400 bg-gray-500/10' };
    }

    const outcomes = parlay.picks.map((pick: any) => pick.pick_outcome).filter(Boolean);
    
    if (outcomes.length === 0) {
      return { status: 'Pending', color: 'text-gray-400 bg-gray-500/10' };
    }

    if (outcomes.includes('loss')) {
      return { status: 'Lost', color: 'text-red-400 bg-red-500/10' };
    }

    if (outcomes.includes('void')) {
      const nonVoidOutcomes = outcomes.filter((o: string) => o !== 'void');
      if (nonVoidOutcomes.length === 0 || nonVoidOutcomes.every((o: string) => o === 'win')) {
        return { status: 'Void', color: 'text-gray-400 bg-gray-500/10' };
      }
      if (nonVoidOutcomes.includes('loss')) {
        return { status: 'Lost', color: 'text-red-400 bg-red-500/10' };
      }
    }

    if (outcomes.includes('push')) {
      if (outcomes.every((o: string) => o === 'win' || o === 'push')) {
        return { status: 'Push', color: 'text-yellow-400 bg-yellow-500/10' };
      }
    }

    if (outcomes.every((o: string) => o === 'win')) {
      return { status: 'Won', color: 'text-green-400 bg-green-500/10' };
    }

    return { status: 'Pending', color: 'text-gray-400 bg-gray-500/10' };
  };

  const outcome = getParlayOutcome();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-dashboard border border-border rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold">Parlay Details</h2>
            <p className="text-sm text-muted-foreground">
              {parlay.tournament_name} • Round {parlay.round_num}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Parlay Summary */}
          <div className="glass-card p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Parlay Summary</h3>
                <span className={`px-3 py-1 rounded text-sm font-semibold ${outcome.color}`}>
                  {outcome.status}
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {outcome.status === 'Won' ? `$${parlay.payout?.toLocaleString()}` : 
                   outcome.status === 'Push' || outcome.status === 'Void' ? `$${parlay.amount}` : 
                   '$0'}
                </div>
                <div className="text-sm text-muted-foreground">Payout</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Bet Amount</div>
                <div className="font-semibold">${parlay.amount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Odds</div>
                <div className="font-mono font-semibold text-primary">+{parlay.odds}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Potential Payout</div>
                <div className="font-semibold">${parlay.payout?.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Total Picks</div>
                <div className="font-semibold">{parlay.picks?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Individual Picks */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Individual Picks</h3>
            {parlay.picks?.map((pick: any, pickIndex: number) => {
              const status = getPickStatus(pick);
              const userPick = pick.players?.find((p: any) => p.isUserPick);
              
              return (
                <div key={pickIndex} className={`glass-card p-4 ${status.borderColor} border-2`}>
                  {/* Pick Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">Pick #{pickIndex + 1}</h4>
                      <span className="text-sm text-muted-foreground">
                        ({pick.players?.length === 2 ? '2-ball' : '3-ball'})
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${status.color} border ${status.borderColor}`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Your Pick */}
                  {userPick && (
                    <div className={`mb-3 p-3 rounded-lg border-2 ${status.color} ${status.borderColor}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{userPick.name}</div>
                          <div className="text-xs opacity-75">Your Pick • {status.label}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg">{getScoreDisplay(userPick)}</div>
                          <div className="text-xs opacity-75">
                            {userPick.currentPosition === 'WD' ? 'WD' : `Thru ${getHolesDisplay(userPick.holesPlayed)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* All Players Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted">
                          <th className="py-2 px-3 text-left font-semibold">Player</th>
                          <th className="py-2 px-3 text-right font-semibold">Score</th>
                          <th className="py-2 px-3 text-right font-semibold">Thru</th>
                          <th className="py-2 px-3 text-right font-semibold">Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pick.players?.map((player: any, playerIndex: number) => (
                          <tr
                            key={playerIndex}
                            className={
                              player.isUserPick
                                ? 'font-semibold text-primary bg-accent/30 border-l-4 border-primary'
                                : 'hover:bg-accent/10 transition'
                            }
                          >
                            <td className="py-2 px-3">
                              {player.name}
                              {player.isUserPick && (
                                <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                                  Your Pick
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {getScoreDisplay(player)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {player.currentPosition === 'WD' ? 'WD' : getHolesDisplay(player.holesPlayed)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {player.currentPosition || '-'}
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

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-border">
          <button
            onClick={onClose}
            className="btn-glass px-6 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
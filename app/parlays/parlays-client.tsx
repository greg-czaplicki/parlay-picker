'use client';

import { useState, useEffect } from 'react';
import { ParlayCardProps, ParlayPickDisplay, ParlayPlayerDisplay } from '@/components/parlay-card/parlay-card';
import { toast } from '@/components/ui/use-toast';
<<<<<<< HEAD
import { useParlaysQuery } from '@/hooks/use-parlays-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
=======
import { Loader2, PlusCircle } from 'lucide-react';
import { createParlay, ParlayWithPicks, ParlayPickWithData, addParlayPick } from '@/app/actions/matchups';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32

export default function ParlaysClient({ currentRound }: { currentRound: number | null }) {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

<<<<<<< HEAD
  // Persistent data via React Query
  const { data, isLoading, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];
=======
export default function ParlaysClient({ initialParlays, initialPicksWithData, currentRound, error }: ParlaysClientProps) {
  const [parlays, setParlays] = useState<ParlayWithPicks[]>(initialParlays);
  const [isCreating, setIsCreating] = useState(false);
  const [newParlayName, setNewParlayName] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('current');
  const [filteredParlays, setFilteredParlays] = useState<ParlayWithPicks[]>([]);
  const router = useRouter();
  
  // Log current round value from server
  console.log("ParlaysClient received currentRound:", currentRound);
  
  // Find unique round numbers from all picks
  const uniqueRounds = Array.from(
    new Set(
      initialPicksWithData
        .map(pickData => pickData.pick.round_num)
        .filter(round => round !== null)
    )
  ).sort((a, b) => Number(a) - Number(b));
  
  // Handle query parameters for adding a player from RecommendedPicks
  useEffect(() => {
    const handleAddPlayerFromParams = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const shouldAdd = searchParams.get('add') === 'true';
      
      if (shouldAdd) {
        const playerName = searchParams.get('player');
        const playerIdStr = searchParams.get('playerId');
        const matchupIdStr = searchParams.get('matchupId');
        const eventName = searchParams.get('eventName');
        const roundNumStr = searchParams.get('roundNum') || '2'; // Default to Round 2
        
        if (playerName && playerIdStr) {
          const playerId = parseInt(playerIdStr, 10);
          const matchupId = matchupIdStr ? parseInt(matchupIdStr, 10) : null;
          const roundNum = parseInt(roundNumStr, 10);
          
          // Find the most recent parlay or create a new one
          let targetParlayId: number | null = null;
          
          if (parlays.length > 0) {
            // Find the most recent parlay for this round
            const roundParlays = parlays.filter(p => {
              // Check if this is an empty parlay
              if (p.picks.length === 0) return true;
              
              // Check if any pick is from this round
              return p.picks.some(pick => {
                const pickData = initialPicksWithData.find(data => data.pick.id === pick.id);
                return pickData?.pick.round_num === roundNum;
              });
            });
            
            if (roundParlays.length > 0) {
              // Use the most recent parlay
              targetParlayId = roundParlays[0].id;
            }
          }
          
          // If no suitable parlay found, create a new one
          if (!targetParlayId) {
            try {
              const { parlay, error } = await createParlay(`Round ${roundNum} Parlay`);
              if (error || !parlay) {
                throw new Error(error || "Failed to create parlay");
              }
              targetParlayId = parlay.id;
              // Add the new parlay to the state
              setParlays(prev => [...prev, { ...parlay, picks: [] }]);
            } catch (err) {
              console.error("Error creating parlay:", err);
              toast({
                title: "Error Creating Parlay",
                description: "Failed to create a new parlay for this pick.",
                variant: "destructive"
              });
              return;
            }
          }
          
          // Now add the player to the parlay
          try {
            const { pick, error } = await addParlayPick({
              parlay_id: targetParlayId,
              picked_player_dg_id: playerId,
              picked_player_name: playerName,
              matchup_id: matchupId || undefined,
              event_name: eventName || undefined,
              round_num: roundNum,
            });
            
            if (error) {
              throw new Error(error);
            }
            
            // Success message
            toast({
              title: "Player Added",
              description: `${playerName} added to your parlay.`,
              variant: "default"
            });
            
            // Clear the URL parameters and refresh to update the UI
            window.history.replaceState({}, document.title, "/parlays");
            router.refresh();
            
          } catch (err) {
            console.error("Error adding player to parlay:", err);
            toast({
              title: "Error Adding Player",
              description: "Failed to add player to parlay.",
              variant: "destructive"
            });
          }
        }
      }
    };
    
    handleAddPlayerFromParams();
  }, [router, parlays, initialPicksWithData]);
  
  // Add current round to uniqueRounds if it doesn't exist
  if (currentRound !== null && !uniqueRounds.includes(currentRound)) {
    uniqueRounds.push(currentRound);
    uniqueRounds.sort((a, b) => Number(a) - Number(b));
  }
>>>>>>> c659d1db1816cec61d8fc390432d423803ff4e32

  // Error toast for loading
  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Error Loading Parlays', description: error.message, variant: 'destructive' });
    }
  }, [isError, error]);

  const [syncing, setSyncing] = useState(false);
  const { refetch } = useParlaysQuery(userId);

  // Last sync timestamp state
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Load last sync from localStorage on mount
  useEffect(() => {
    const t = typeof window !== 'undefined' ? localStorage.getItem('lastSync') : null;
    if (t) setLastSync(new Date(t));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('http://localhost:3000/api/live-stats/sync', { method: 'GET' });
      if (!res.ok) throw new Error('Failed to sync live stats');
      const now = new Date();
      setLastSync(now);
      if (typeof window !== 'undefined') {
        localStorage.setItem('lastSync', now.toISOString());
      }
      toast({ title: 'Sync Complete', description: 'Live stats refreshed!', variant: 'default' });
      await refetch();
    } catch (err: any) {
      toast({ title: 'Sync Failed', description: err.message || 'Could not sync live stats', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

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

  function getMatchupStatus(
    userPick: ParlayPlayerDisplay,
    others: ParlayPlayerDisplay[]
  ): 'likely' | 'unlikely' | 'close' {
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
  ): 'won' | 'lost' | 'tied' | null {
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
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="flex items-center gap-2">
            {syncing && <Loader2 className="animate-spin w-4 h-4" />}
            Sync
          </Button>
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
                key={parlay.id}
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
                  {/* Show picks for this parlay */}
                  <ul className="mb-4">
                    {parlay.picks && parlay.picks.length > 0 ? (
                      parlay.picks.map((pick: any) => (
                        <li key={pick.id} className="text-sm text-neutral-200">
                          <span className="font-semibold">{pick.picked_player_name}</span>
                          {pick.picked_player_dg_id ? (
                            <span className="ml-2 text-xs text-neutral-400">(ID: {pick.picked_player_dg_id})</span>
                          ) : null}
                          {pick.matchup_id ? (
                            <span className="ml-2 text-xs text-neutral-400">Matchup: {pick.matchup_id}</span>
                          ) : null}
                          <span className="ml-2 text-xs text-neutral-400">Outcome: {pick.outcome}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-neutral-400">No picks found for this parlay.</li>
                    )}
                  </ul>
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
                    const statusBarColor =
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
                            `}>
                              {finalStatus.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm table-fixed">
                            <thead>
                              <tr className="bg-muted">
                                <th className="py-2 px-3 text-left font-semibold w-40">Player</th>
                                <th className="py-2 px-3 text-right font-semibold w-16">Pos</th>
                                <th className="py-2 px-3 text-right font-semibold w-16">Total</th>
                                <th className="py-2 px-3 text-right font-semibold w-16">Today</th>
                                <th className="py-2 px-3 text-right font-semibold w-16">Thru</th>
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
                                  <td className="py-2 px-3 truncate w-40">{player.name}</td>
                                  <td className="py-2 px-3 text-right font-mono">{player.currentPosition}</td>
                                  <td className="py-2 px-3 text-right font-mono">{typeof player.totalScore === 'number' && player.totalScore !== 0 ? (player.totalScore > 0 ? `+${player.totalScore}` : player.totalScore) : 'E'}</td>
                                  <td className="py-2 px-3 text-right font-mono">{typeof player.roundScore === 'number' && player.roundScore !== 0 ? (player.roundScore > 0 ? `+${player.roundScore}` : player.roundScore) : 'E'}</td>
                                  <td className="py-2 px-3 text-right font-mono">{getHolesDisplay(player.holesPlayed)}</td>
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
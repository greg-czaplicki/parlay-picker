import { useState, useRef, useEffect, useMemo } from 'react';
import { useParlayPicksQuery } from '@/hooks/use-parlay-picks-query';
import { useCreateParlayPickMutation } from '@/hooks/use-create-parlay-pick-mutation';
import { useRemoveParlayPickMutation } from '@/hooks/use-parlay-pick-mutations';
import { useDeleteParlayMutation } from '@/hooks/use-parlay-pick-mutations';
import { createBrowserClient } from '@/lib/supabase';
import { findPlayerMatchup, getLiveStatsForPlayers } from '@/app/actions/matchups';
import { toast } from '@/components/ui/use-toast';
import type { ParlayPlayer, ParlayStatusResult } from './parlay-card.types';
import { formatPlayerNameDisplay } from './parlay-card.utils';
import { Check, X } from 'lucide-react';
import React from 'react';
// import type { ParlayPlayer, ParlayCardProps } from './parlay-card.types';

/**
 * Custom hook to manage parlay players: fetch, add, remove, update.
 * Handles player state, data loading, and mutations.
 */
export function useParlayPlayers(parlayId: number, selectedRound: number | null) {
  const { data: picks = [], isLoading: picksLoading } = useParlayPicksQuery(parlayId);
  const createPickMutation = useCreateParlayPickMutation(parlayId);
  const removePickMutation = useRemoveParlayPickMutation();

  const [players, setPlayers] = useState<ParlayPlayer[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMounted = useRef(true);

  // Initialize players from picks
  useEffect(() => {
    console.log('[useParlayPlayers] picks:', picks);
    setPlayers(prevPlayers => {
      const mapped = picks.map((pick: any) => {
        const existing = prevPlayers.find(p => p.pickId === pick.id);
        return existing
          ? { ...existing, name: pick.picked_player_name, pickId: pick.id }
          : {
              name: pick.picked_player_name,
              pickId: pick.id,
              matchup: null,
              liveStats: null,
              isLoadingMatchup: true,
              isLoadingStats: false,
              isPersisted: true,
              matchupError: undefined,
              statsError: undefined,
            };
      });
      // Only update if different (shallow compare by pickId and name)
      if (
        prevPlayers.length !== mapped.length ||
        prevPlayers.some((p, i) => p.pickId !== mapped[i].pickId || p.name !== mapped[i].name)
      ) {
        console.log('[useParlayPlayers] setPlayers: updating players', mapped);
        return mapped;
      }
      return prevPlayers;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks]);

  // After players are initialized, trigger data loading for each player
  useEffect(() => {
    console.log('[useParlayPlayers] players after sync:', players);
    players.forEach((player, index) => {
      if (player.isLoadingMatchup && !player.matchupError) {
        console.log('[useParlayPlayers] loadMatchupForPlayer', player, index);
        loadMatchupForPlayer(player, index);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // Reload stats for all players when selectedRound changes
  useEffect(() => {
    if (!players.length) return;
    players.forEach((player, index) => {
      if (player.matchup) {
        loadStatsForPlayer(player, index, selectedRound);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound]);

  // --- Data Loading Functions ---
  /**
   * Loads matchup data for a player and updates state.
   */
  const loadMatchupForPlayer = async (player: ParlayPlayer, index: number) => {
    if (!isMounted.current) return;
    try {
      const { matchup, error } = await findPlayerMatchup(player.name);
      if (!isMounted.current) return;
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchup, matchupError: error, isLoadingMatchup: false } : p
      ));
      if (isMounted.current) {
        if (matchup) {
          await loadStatsForPlayer(player, index, selectedRound);
        } else {
          await loadStatsByPlayerName(player, index);
        }
      }
    } catch (err) {
      if (!isMounted.current) return;
      setPlayers(prev => prev.map((p, i) =>
        i === index ? { ...p, matchupError: 'Failed to load matchup', isLoadingMatchup: false } : p
      ));
      if (isMounted.current) {
        await loadStatsByPlayerName(player, index);
      }
    }
  };

  /**
   * Loads stats by player name if no matchup is found.
   */
  const loadStatsByPlayerName = async (player: ParlayPlayer, index: number) => {
    if (!isMounted.current) return;
    try {
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, isLoadingStats: true } : p));
      let playerName = player.name;
      let searchPatterns = [playerName];
      if (playerName.includes(",")) {
        const [lastName, firstName] = playerName.split(",").map(part => part.trim());
        searchPatterns.push(`${firstName} ${lastName}`);
      } else {
        const parts = playerName.split(" ");
        if (parts.length >= 2) {
          const firstName = parts.slice(0, -1).join(" ");
          const lastName = parts[parts.length - 1];
          searchPatterns.push(`${lastName}, ${firstName}`);
        }
      }
      const supabase = createBrowserClient();
      const likeQueries = searchPatterns.map(pattern => `player_name.ilike."%${pattern}%"`).join(",");
      const { data: playerStats, error } = await supabase
        .from('live_tournament_stats')
        .select('*')
        .or(likeQueries)
        .order('data_golf_updated_at', { ascending: false })
        .limit(10);
      if (!isMounted.current) return;
      if (error) {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, statsError: 'Failed to query stats by name', isLoadingStats: false } : p));
        return;
      }
      if (!playerStats || playerStats.length === 0) {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, isLoadingStats: false } : p));
        return;
      }
      const statsMap: Record<number, any> = {};
      playerStats.forEach((stat: any) => {
        if (stat.dg_id) statsMap[stat.dg_id] = stat;
      });
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, liveStats: statsMap, isLoadingStats: false } : p));
    } catch (err) {
      if (!isMounted.current) return;
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, statsError: 'Failed to load stats by name', isLoadingStats: false } : p));
    }
  };

  /**
   * Loads stats for a player's matchup.
   */
  const loadStatsForPlayer = async (player: ParlayPlayer, index: number, roundNum: number | null = selectedRound) => {
    if (!player.matchup || !isMounted.current) return;
    try {
      const playerIds = [player.matchup.p1_dg_id, player.matchup.p2_dg_id, player.matchup.p3_dg_id].filter((id: any) => id !== null);
      if (playerIds.length === 0) {
        setPlayers(prev => prev.map((p, i) => i === index ? { ...p, isLoadingStats: false, statsError: 'No player IDs for stats' } : p));
        return;
      }
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, isLoadingStats: true } : p));
      const { stats, error } = await getLiveStatsForPlayers(playerIds, roundNum);
      if (!isMounted.current) return;
      const statsMap: Record<number, any> = {};
      (stats || []).forEach((stat: any) => {
        if (stat.dg_id) statsMap[stat.dg_id] = stat;
      });
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, liveStats: statsMap, statsError: error, isLoadingStats: false } : p));
    } catch (err) {
      if (!isMounted.current) return;
      setPlayers(prev => prev.map((p, i) => i === index ? { ...p, statsError: 'Failed to load stats', isLoadingStats: false } : p));
    }
  };

  /**
   * Adds a player to the parlay.
   */
  const addPlayer = async (playerName: string) => {
    const trimmedName = playerName.trim();
    if (!trimmedName || players.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast({
        title: 'Invalid Input',
        description: trimmedName ? 'Player already added.' : 'Please enter a player name.',
        variant: 'destructive',
      });
      return;
    }
    setIsAdding(true);
    try {
      const { matchup, error: matchupError } = await findPlayerMatchup(trimmedName);
      if (matchupError) throw new Error(matchupError);
      if (!matchup) {
        toast({ title: 'Matchup Not Found', description: `No 3-ball matchup found for ${trimmedName}.`, variant: 'default' });
        setIsAdding(false);
        return;
      }
      let pickedPlayerId: number | null | undefined;
      if (formatPlayerNameDisplay(matchup.p1_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p1_dg_id;
      else if (formatPlayerNameDisplay(matchup.p2_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p2_dg_id;
      else if (formatPlayerNameDisplay(matchup.p3_player_name).toLowerCase() === trimmedName.toLowerCase()) pickedPlayerId = matchup.p3_dg_id;
      if (!pickedPlayerId) throw new Error('Could not identify picked player ID within the found matchup.');
      createPickMutation.mutate({
        parlay_id: parlayId,
        picked_player_dg_id: pickedPlayerId,
        picked_player_name: trimmedName,
        matchup_id: matchup.id,
        event_name: matchup.event_name,
        round_num: matchup.round_num,
      }, {
        onSuccess: () => {
          toast({ title: 'Player Added', description: `${trimmedName} added to your parlay.` });
        },
        onError: (err: any) => {
          toast({ title: 'Error Adding Player', description: err?.message || 'Failed to add player.', variant: 'destructive' });
        },
        onSettled: () => setIsAdding(false),
      });
    } catch (e) {
      setIsAdding(false);
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
      toast({ title: 'Error Adding Player', description: errorMessage, variant: 'destructive' });
    }
  };

  /**
   * Removes a player from the parlay.
   */
  const removePlayer = async (pickIdToRemove?: number) => {
    if (!pickIdToRemove) return;
    removePickMutation.mutate(pickIdToRemove, {
      onSuccess: () => {
        toast({ title: 'Pick Removed', description: 'Player removed from parlay.' });
      },
      onError: (err: any) => {
        toast({ title: 'Error Removing Pick', description: err?.message || 'Failed to remove pick.', variant: 'destructive' });
      },
    });
  };

  /**
   * Refreshes all player data (matchups and stats).
   */
  const refreshPlayers = async () => {
    if (isRefreshing || players.length === 0 || !isMounted.current) return;
    setIsRefreshing(true);
    try {
      for (let index = 0; index < players.length; index++) {
        if (!isMounted.current) break;
        const player = players[index];
        if (!player.matchup && !player.matchupError) {
          await loadMatchupForPlayer(player, index);
        } else if (player.matchup) {
          await loadStatsForPlayer(player, index, selectedRound);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } finally {
      if (isMounted.current) setIsRefreshing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  return {
    players,
    isAdding,
    isRefreshing,
    addPlayer,
    removePlayer,
    refreshPlayers,
    setPlayers, // for advanced usage
    loadMatchupForPlayer, // for advanced usage
    loadStatsByPlayerName, // for advanced usage
    loadStatsForPlayer, // for advanced usage
  };
}

/**
 * Custom hook to calculate parlay player status (win/loss/tied/finished).
 * Extracts logic from calculateStatus in ParlayCard.
 * @param player ParlayPlayer
 * @param selectedRound number | null
 * @returns ParlayStatusResult
 */
export function useParlayStatus(player: ParlayPlayer, selectedRound: number | null): ParlayStatusResult {
  return useMemo(() => {
    let playerLineStyle = 'font-bold text-primary';
    let playerLineIcon: React.ReactNode | null = null;
    let groupContainerStyle = '';
    const groupIsLoadingStats = player.isLoadingStats;

    const checkIcon = React.createElement(Check, { size: 14, className: 'inline-block ml-1.5 text-green-500' });
    const xIcon = React.createElement(X, { size: 14, className: 'inline-block ml-1.5 text-red-500' });

    if (player.matchup && player.liveStats && !player.isLoadingStats && !player.statsError) {
      const p1Id = player.matchup.p1_dg_id;
      const p2Id = player.matchup.p2_dg_id;
      const p3Id = player.matchup.p3_dg_id;

      const p1Stat = p1Id ? player.liveStats[p1Id] : undefined;
      const p2Stat = p2Id ? player.liveStats[p2Id] : undefined;
      const p3Stat = p3Id ? player.liveStats[p3Id] : undefined;

      // Find which player (p1, p2, p3) corresponds to the searched name
      let selectedPlayerId: number | null = null;
      if (p1Id && formatPlayerNameDisplay(player.matchup.p1_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p1Id;
      else if (p2Id && formatPlayerNameDisplay(player.matchup.p2_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p2Id;
      else if (p3Id && formatPlayerNameDisplay(player.matchup.p3_player_name).toLowerCase() === player.name.toLowerCase()) selectedPlayerId = p3Id;

      const selectedLiveStat = selectedPlayerId ? player.liveStats[selectedPlayerId] : undefined;

      // Check if the stats are relevant for the selected round
      const isP1StatRelevant = !selectedRound || !p1Stat?.round_num || 
        (selectedRound && p1Stat?.round_num && String(p1Stat.round_num) === String(selectedRound));
      const isP2StatRelevant = !selectedRound || !p2Stat?.round_num || 
        (selectedRound && p2Stat?.round_num && String(p2Stat.round_num) === String(selectedRound));
      const isP3StatRelevant = !selectedRound || !p3Stat?.round_num || 
        (selectedRound && p3Stat?.round_num && String(p3Stat.round_num) === String(selectedRound));
      const isSelectedStatRelevant = !selectedRound || !selectedLiveStat?.round_num || 
        (selectedRound && selectedLiveStat?.round_num && String(selectedLiveStat.round_num) === String(selectedRound));

      // If we're viewing a different round than the picks, don't show win/loss styling
      if (selectedRound && player.matchup.round_num !== selectedRound) {
        return { playerLineStyle, playerLineIcon, groupContainerStyle };
      }

      // Ensure all 3 players and the selected player's stats are available for comparison
      if (p1Stat && p2Stat && p3Stat && selectedLiveStat && selectedPlayerId &&
          isP1StatRelevant && isP2StatRelevant && isP3StatRelevant && isSelectedStatRelevant) {
        const scores = [
          isP1StatRelevant ? (p1Stat.today ?? Infinity) : Infinity,
          isP2StatRelevant ? (p2Stat.today ?? Infinity) : Infinity,
          isP3StatRelevant ? (p3Stat.today ?? Infinity) : Infinity,
        ];
        const selectedScore = isSelectedStatRelevant ? (selectedLiveStat.today ?? Infinity) : Infinity;

        const finished = [
          p1Stat.thru === 18 || p1Stat.position === 'F' || p1Stat.position === 'CUT' || p1Stat.position === 'WD',
          p2Stat.thru === 18 || p2Stat.position === 'F' || p2Stat.position === 'CUT' || p2Stat.position === 'WD',
          p3Stat.thru === 18 || p3Stat.position === 'F' || p3Stat.position === 'CUT' || p3Stat.position === 'WD',
        ];
        const selectedFinished = finished[p1Id === selectedPlayerId ? 0 : p2Id === selectedPlayerId ? 1 : 2];
        const allFinished = finished.every(f => f);

        // Find min score, excluding Infinity
        const validScores = scores.filter(s => s !== Infinity);
        const minScore = validScores.length > 0 ? Math.min(...validScores) : Infinity;

        const isWinning = selectedScore === minScore && scores.filter(s => s === minScore).length === 1;
        const isTiedForLead = selectedScore === minScore && scores.filter(s => s === minScore).length > 1;
        const isLosing = selectedScore > minScore;
        const shotsBehind = isLosing ? selectedScore - minScore : 0;

        // Player Line Style & Icon
        if (selectedScore === Infinity) {
          playerLineStyle = 'font-bold text-muted-foreground';
        } else if (allFinished) {
          // Final Result styling (applies to group container too)
          if (isWinning || isTiedForLead) {
            playerLineStyle = 'font-bold text-green-500';
            playerLineIcon = checkIcon;
            groupContainerStyle = 'border border-green-500/30 bg-green-500/5 rounded-md p-2';
          } else { // Lost and Finished
            playerLineStyle = 'font-bold text-red-500';
            playerLineIcon = xIcon;
            groupContainerStyle = 'border border-red-500/30 bg-red-500/5 rounded-md p-2';
          }
        } else {
          // In-Progress Styling (only player line changes color)
          if (isWinning) {
            playerLineStyle = 'font-bold text-green-500';
          } else if (isTiedForLead) {
            playerLineStyle = 'font-bold text-yellow-500';
          } else if (isLosing) {
            if (shotsBehind === 1) {
              playerLineStyle = 'font-bold text-orange-400'; // Losing by 1
            } else { // shotsBehind > 1
              playerLineStyle = 'font-bold text-red-400'; // Losing by 2+ (Lighter Red)
            }
          }
          // Set default padding for in-progress group container
          groupContainerStyle = 'border border-transparent p-2';
        }
      }
    }
    // Ensure default padding if calculated style is empty (e.g., loading)
    if (!groupContainerStyle) {
      groupContainerStyle = 'border border-transparent p-2';
    }
    return { playerLineStyle, playerLineIcon, groupContainerStyle };
  }, [player, selectedRound]);
}

/**
 * Custom hook for parlay-level actions (delete, etc).
 * Wraps useDeleteParlayMutation and related logic.
 */
export function useParlayActions(parlayId: number, onDelete?: (parlayId: number) => void) {
  const deleteParlayMutation = useDeleteParlayMutation();
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Deletes the entire parlay after confirmation.
   */
  const deleteParlay = async () => {
    if (!confirm(`Are you sure you want to delete this parlay?`)) return;
    setIsDeleting(true);
    try {
      await deleteParlayMutation.mutateAsync(parlayId, {
        onSuccess: () => {
          toast({ title: 'Parlay Deleted', description: 'Parlay has been deleted.' });
          if (onDelete) onDelete(parlayId);
        },
        onError: (err: any) => {
          toast({ title: 'Error Deleting Parlay', description: err?.message || 'Failed to delete parlay.', variant: 'destructive' });
        },
      });
    } catch (err) {
      toast({ title: 'Error Deleting Parlay', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    deleteParlay,
    isDeleting,
  };
} 
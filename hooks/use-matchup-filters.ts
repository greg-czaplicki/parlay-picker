import { useState, useMemo, useCallback } from 'react';
import { MatchupRow } from '@/types/matchups';
import { PlayerStat } from '@/hooks/use-player-stats-query';
import { LiveTournamentStat } from '@/types/definitions';
import { MatchupComparisonEngine, MatchupComparison } from '@/lib/matchup-comparison-engine';
import { 
  MatchupRelativeFilters, 
  MatchupFilterState, 
  FilterPreset, 
  FILTER_PRESETS,
  MatchupAnalysisResult,
  FilterBadge
} from '@/types/matchup-filters';

interface UseMatchupFiltersProps {
  matchups: MatchupRow[] | undefined;
  playerStats?: PlayerStat[];
  tournamentStats?: LiveTournamentStat[];
}

interface UseMatchupFiltersResult {
  filteredMatchups: MatchupRow[];
  filterState: MatchupFilterState;
  updateFilter: (filterId: keyof MatchupRelativeFilters, value: any) => void;
  applyPreset: (preset: FilterPreset) => void;
  clearFilters: () => void;
  getMatchupAnalysis: (matchupId: number) => MatchupAnalysisResult | null;
  getRawMatchupAnalysis: (matchupId: number) => MatchupComparison | null;
  getValuePlayers: () => Array<{ 
    dgId: number; 
    name: string; 
    odds: number | null; 
    matchupId: number;
    reason: string;
    sgTotal?: number | null;
  }>;
  isLoading: boolean;
  activePreset: FilterPreset | null;
}

export function useMatchupFilters({
  matchups,
  playerStats,
  tournamentStats
}: UseMatchupFiltersProps): UseMatchupFiltersResult {
  const [filters, setFilters] = useState<MatchupRelativeFilters>({});
  const [activePreset, setActivePreset] = useState<FilterPreset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize comparison engine
  const engine = useMemo(() => {
    return new MatchupComparisonEngine(playerStats, tournamentStats);
  }, [playerStats, tournamentStats]);

  // Memoized analysis cache
  const analysisCache = useMemo(() => {
    const cache = new Map<number, MatchupComparison>();
    if (!matchups || matchups.length === 0) {
      console.log('No matchups available for analysis');
      return cache;
    }

    console.log(`Analyzing ${matchups.length} matchups...`);
    console.log('First matchup structure:', matchups[0]);

    matchups.forEach((matchup, index) => {
      try {
        const analysis = engine.analyzeMatchup(matchup);
        cache.set(matchup.id, analysis);
        if (index < 3) { // Log first 3 analyses
          console.log(`Analysis for matchup ${matchup.id}:`, analysis);
        }
      } catch (error) {
        console.warn(`Failed to analyze matchup ${matchup.id}:`, error, matchup);
        // Skip this matchup rather than breaking the entire cache
      }
    });

    console.log(`Analysis cache created with ${cache.size} entries`);
    return cache;
  }, [matchups, engine]);

  // Apply filters to matchups
  const filteredMatchups = useMemo(() => {
    if (!matchups || matchups.length === 0) return [];
    
    // If no filters active, return all matchups
    const activeFilterCount = Object.keys(filters).filter(key => 
      filters[key as keyof MatchupRelativeFilters] !== undefined && 
      filters[key as keyof MatchupRelativeFilters] !== false
    ).length;

    if (activeFilterCount === 0) return matchups;

    // Apply filters
    return matchups.filter(matchup => {
      const analysis = analysisCache.get(matchup.id);
      if (!analysis) {
        console.log(`No analysis for matchup ${matchup.id}`);
        return false;
      }

      const checks: boolean[] = [];

      // Odds filters
      if (filters.minOddsGap !== undefined) {
        const oddsCheck = analysis.analysis.hasOddsGap && analysis.analysis.oddsGapSize >= filters.minOddsGap;
        console.log(`Matchup ${matchup.id} odds check:`, {
          hasOddsGap: analysis.analysis.hasOddsGap,
          oddsGapSize: analysis.analysis.oddsGapSize,
          minRequired: filters.minOddsGap,
          passes: oddsCheck
        });
        checks.push(oddsCheck);
      }
      if (filters.showOddsSgMismatch) {
        checks.push(analysis.analysis.hasOddsSgMismatch);
      }
      if (filters.maxOddsSpread !== undefined) {
        const maxOdds = Math.max(...analysis.players.map(p => p.odds ?? 0).filter(o => o !== 0));
        const minOdds = Math.min(...analysis.players.map(p => p.odds ?? Infinity).filter(o => o !== Infinity));
        const spread = maxOdds - minOdds;
        checks.push(spread <= filters.maxOddsSpread);
      }
      if (filters.showDgFdDisagreement) {
        // Check if DG and FD rank players differently
        const fdRanking = [...analysis.players].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
        const dgRanking = [...analysis.players].sort((a, b) => (a.dgOdds ?? 0) - (b.dgOdds ?? 0));
        const disagreement = fdRanking[0]?.dgId !== dgRanking[0]?.dgId;
        checks.push(disagreement);
      }

      // SG filters
      if (filters.sgTotalGapMin !== undefined) {
        checks.push(analysis.analysis.sgGapSize >= filters.sgTotalGapMin);
      }
      if (filters.sgCategoryDominance !== undefined) {
        checks.push(
          analysis.analysis.sgCategoryDominance !== null && 
          analysis.analysis.sgCategoryDominance.categories >= filters.sgCategoryDominance
        );
      }
      if (filters.sgPuttGapMin !== undefined) {
        checks.push(analysis.analysis.hasPuttingEdge && analysis.analysis.puttingGapSize >= filters.sgPuttGapMin);
      }
      if (filters.sgBallStrikingGapMin !== undefined) {
        checks.push(analysis.analysis.hasBallStrikingEdge && analysis.analysis.ballStrikingGapSize >= filters.sgBallStrikingGapMin);
      }

      // Form filters
      if (filters.showPositionMismatch) {
        checks.push(analysis.analysis.hasPositionMismatch);
      }
      if (filters.positionGapMin !== undefined) {
        const positions = analysis.players.map(p => p.position).filter(p => p !== null) as number[];
        if (positions.length >= 2) {
          const gap = Math.max(...positions) - Math.min(...positions);
          checks.push(gap >= filters.positionGapMin);
        } else {
          checks.push(false);
        }
      }
      if (filters.scoreGapToday !== undefined) {
        const scores = analysis.players.map(p => p.todayScore).filter(s => s !== null) as number[];
        if (scores.length >= 2) {
          const gap = Math.max(...scores) - Math.min(...scores);
          checks.push(gap >= filters.scoreGapToday);
        } else {
          checks.push(false);
        }
      }

      // DataGolf filters
      if (filters.showDataSourceDisagreement) {
        checks.push(analysis.analysis.hasDataSourceDisagreement);
      }
      if (filters.showDataConsensus) {
        checks.push(analysis.analysis.hasDataConsensus);
      }
      if (filters.dgAdvantageMin !== undefined) {
        checks.push(analysis.analysis.dgAdvantageSize >= filters.dgAdvantageMin);
      }
      if (filters.strongDisagreementOnly) {
        checks.push(analysis.analysis.dataSourceDisagreementType === 'strong');
      }

      // Apply AND/OR logic
      const result = filters.requireAll ? checks.every(c => c) : checks.some(c => c);
      console.log(`Matchup ${matchup.id} final result:`, {
        checks,
        requireAll: filters.requireAll,
        result
      });
      return result;
    });
  }, [matchups, filters, analysisCache]);

  // Get analysis result for a specific matchup
  const getMatchupAnalysis = useCallback((matchupId: number): MatchupAnalysisResult | null => {
    const analysis = analysisCache.get(matchupId);
    if (!analysis) return null;

    const badges: FilterBadge[] = [];
    let passesFilters = false;

    // Check which filters this matchup matches
    if (analysis.analysis.hasOddsGap && (!filters.minOddsGap || analysis.analysis.oddsGapSize >= filters.minOddsGap)) {
      badges.push({
        type: 'odds-gap',
        label: 'Odds Gap',
        value: `${Math.round(analysis.analysis.oddsGapSize)}¢`,
        color: 'yellow'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasOddsSgMismatch) {
      badges.push({
        type: 'sg-mismatch',
        label: 'SG Mismatch',
        color: 'red'
      });
      passesFilters = true;
    }

    if (analysis.analysis.sgCategoryDominance) {
      badges.push({
        type: 'stat-dom',
        label: `${analysis.analysis.sgCategoryDominance.categories}/4 Categories`,
        color: 'green'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasPuttingEdge) {
      badges.push({
        type: 'putting-edge',
        label: 'Putting Edge',
        value: `+${analysis.analysis.puttingGapSize.toFixed(2)}`,
        color: 'blue'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasBallStrikingEdge) {
      badges.push({
        type: 'ball-striking',
        label: 'Ball Striking',
        value: `+${analysis.analysis.ballStrikingGapSize.toFixed(2)}`,
        color: 'blue'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasPositionMismatch) {
      badges.push({
        type: 'form',
        label: 'Position Mismatch',
        color: 'yellow'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasDataSourceDisagreement) {
      badges.push({
        type: 'data-disagreement',
        label: analysis.analysis.dataSourceDisagreementType === 'strong' ? 'Strong Data Disagreement' : 'Data Disagreement',
        color: 'purple'
      });
      passesFilters = true;
    }

    if (analysis.analysis.hasDataConsensus) {
      badges.push({
        type: 'data-consensus',
        label: 'Data Consensus',
        color: 'green'
      });
      passesFilters = true;
    }

    if (analysis.analysis.dgAdvantageSize > 0.1 && analysis.analysis.dgAdvantagePlayer) {
      badges.push({
        type: 'dg-advantage',
        label: 'DataGolf Advantage',
        value: `+${analysis.analysis.dgAdvantageSize.toFixed(2)}`,
        color: 'purple'
      });
      passesFilters = true;
    }

    return {
      passesFilters,
      badges,
      highlightPlayer: analysis.analysis.dgAdvantagePlayer || analysis.analysis.sgLeader || analysis.analysis.oddsLeader || undefined
    };
  }, [analysisCache, filters]);

  // Get raw analysis for modal (returns full MatchupComparison)
  const getRawMatchupAnalysis = useCallback((matchupId: number): MatchupComparison | null => {
    return analysisCache.get(matchupId) || null;
  }, [analysisCache]);

  // Update a single filter
  const updateFilter = useCallback((filterId: keyof MatchupRelativeFilters, value: any) => {
    setActivePreset(null); // Clear active preset when manually adjusting filters
    setFilters(prev => ({
      ...prev,
      [filterId]: value
    }));
  }, []);

  // Apply a preset
  const applyPreset = useCallback((preset: FilterPreset) => {
    if (activePreset === preset) {
      // If clicking the same preset, clear it
      setFilters({});
      setActivePreset(null);
    } else {
      // Apply new preset
      setFilters(FILTER_PRESETS[preset]);
      setActivePreset(preset);
    }
  }, [activePreset]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({});
    setActivePreset(null);
  }, []);

  // Calculate filter state
  const filterState: MatchupFilterState = useMemo(() => {
    const activeFilterCount = Object.keys(filters).filter(key => 
      filters[key as keyof MatchupRelativeFilters] !== undefined && 
      filters[key as keyof MatchupRelativeFilters] !== false
    ).length;

    return {
      ...filters,
      isActive: activeFilterCount > 0,
      activeFilterCount
    };
  }, [filters]);

  // Extract specific value players from filtered matchups
  const getValuePlayers = useCallback(() => {
    const valuePlayers: Array<{ 
      dgId: number; 
      name: string; 
      odds: number | null; 
      matchupId: number;
      reason: string;
      sgTotal?: number | null;
    }> = [];

    console.log(`Getting value players from ${filteredMatchups.length} filtered matchups`);

    filteredMatchups.forEach(matchup => {
      const analysis = analysisCache.get(matchup.id);
      if (!analysis) {
        console.log(`No analysis found for matchup ${matchup.id}`);
        return;
      }

      console.log(`Matchup ${matchup.id} analysis:`, {
        hasOddsGap: analysis.analysis.hasOddsGap,
        oddsGapSize: analysis.analysis.oddsGapSize,
        players: analysis.players.map(p => ({ name: p.name, odds: p.odds }))
      });

      // For different filter types, extract the relevant "value" player
      if (filters.minOddsGap && analysis.analysis.hasOddsGap) {
        // Find underdogs with competitive SG stats (use DataGolf if available, else PGA Tour)
        const playersWithOdds = analysis.players.filter(p => p.odds !== null && (p.dgSgTotal !== null || p.sgTotal !== null));
        console.log(`Players with odds and SG:`, playersWithOdds.map(p => ({ 
          name: p.name, 
          odds: p.odds, 
          pgaSg: p.sgTotal,
          dgSg: p.dgSgTotal 
        })));
        
        if (playersWithOdds.length >= 2) {
          const sortedByOdds = [...playersWithOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
          const favorite = sortedByOdds[0]; // Lowest odds = favorite
          const underdogs = sortedByOdds.slice(1); // Everyone else
          
          // Find underdogs who are competitive with the favorite (prefer DataGolf SG)
          const competitiveUnderdogs = underdogs.filter(dog => {
            const favSg = favorite.dgSgTotal ?? favorite.sgTotal ?? 0;
            const dogSg = dog.dgSgTotal ?? dog.sgTotal ?? 0;
            const sgGap = favSg - dogSg;
            // Dog is competitive if within 0.3 SG or actually better
            return sgGap <= 0.3;
          });
          
          if (competitiveUnderdogs.length > 0) {
            // Pick the best value: lowest SG gap relative to odds gap
            const bestValue = competitiveUnderdogs.reduce((best, current) => {
              const favSg = favorite.dgSgTotal ?? favorite.sgTotal ?? 0;
              const currentSg = current.dgSgTotal ?? current.sgTotal ?? 0;
              const bestSg = best.dgSgTotal ?? best.sgTotal ?? 0;
              
              const currentSgGap = favSg - currentSg;
              const bestSgGap = favSg - bestSg;
              
              // If current has better SG than best, pick current
              if (currentSgGap < bestSgGap) return current;
              // If tied on SG, pick the one with better odds
              if (currentSgGap === bestSgGap && (current.odds ?? 0) > (best.odds ?? 0)) return current;
              return best;
            });
            
            const favSg = favorite.dgSgTotal ?? favorite.sgTotal ?? 0;
            const bestValueSg = bestValue.dgSgTotal ?? bestValue.sgTotal ?? 0;
            const sgDiff = favSg - bestValueSg;
            
            // Calculate the actual American odds gap between this player and the favorite
            const favoriteAmerican = ((favorite.odds ?? 1) - 1) * 100;
            const bestValueAmerican = ((bestValue.odds ?? 1) - 1) * 100;
            const oddsGap = Math.round(bestValueAmerican - favoriteAmerican);
            
            let reason = `${oddsGap}pt odds gap`;
            
            // Add data source context if both are available
            const usingDg = bestValue.dgSgTotal !== null && favorite.dgSgTotal !== null;
            if (usingDg) {
              reason += ` (DataGolf)`;
            }
            
            if (sgDiff < 0) {
              reason += `, leads SG by ${Math.abs(sgDiff).toFixed(2)}`;
            } else if (sgDiff <= 0.1) {
              reason += `, nearly even SG`;
            } else {
              reason += `, only ${sgDiff.toFixed(2)} SG behind`;
            }
            
            console.log(`Found value underdog:`, { 
              name: bestValue.name, 
              odds: bestValue.odds, 
              pgaSg: bestValue.sgTotal,
              dgSg: bestValue.dgSgTotal,
              sgGap: sgDiff,
              usingDataGolf: usingDg
            });
            
            valuePlayers.push({
              dgId: bestValue.dgId,
              name: bestValue.name,
              odds: bestValue.odds,
              matchupId: matchup.id,
              reason,
              sgTotal: bestValueSg // Use the SG we actually analyzed with
            });
          }
        }
      }

      if (filters.showOddsSgMismatch && analysis.analysis.hasOddsSgMismatch) {
        // Find the player with better SG but worse odds
        const sgLeader = analysis.players.find(p => p.name === analysis.analysis.sgLeader);
        if (sgLeader) {
          valuePlayers.push({
            dgId: sgLeader.dgId,
            name: sgLeader.name,
            odds: sgLeader.odds,
            matchupId: matchup.id,
            reason: `Better SG than favorite`,
            sgTotal: sgLeader.sgTotal
          });
        }
      }

      if (filters.sgCategoryDominance && analysis.analysis.sgCategoryDominance) {
        // Find the player who dominates categories
        const dominator = analysis.players.find(p => p.name === analysis.analysis.sgCategoryDominance?.player);
        if (dominator) {
          valuePlayers.push({
            dgId: dominator.dgId,
            name: dominator.name,
            odds: dominator.odds,
            matchupId: matchup.id,
            reason: `Leads ${analysis.analysis.sgCategoryDominance.categories} SG categories by 0.05+`,
            sgTotal: dominator.sgTotal
          });
        }
      }

      if (filters.showDgFdDisagreement) {
        // Check if DG and FD rank players differently
        const playersWithBothOdds = analysis.players.filter(p => p.odds !== null && p.dgOdds !== null);
        if (playersWithBothOdds.length >= 2) {
          const fdRanking = [...playersWithBothOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0));
          const dgRanking = [...playersWithBothOdds].sort((a, b) => (a.dgOdds ?? 0) - (b.dgOdds ?? 0));
          
          if (fdRanking[0]?.dgId !== dgRanking[0]?.dgId) {
            // DataGolf's favorite is not FanDuel's favorite - this is value
            const dgFavorite = dgRanking[0];
            valuePlayers.push({
              dgId: dgFavorite.dgId,
              name: dgFavorite.name,
              odds: dgFavorite.odds,
              matchupId: matchup.id,
              reason: `DataGolf favorite but not FanDuel favorite`,
              sgTotal: dgFavorite.sgTotal
            });
          }
        }
      }

      // DataGolf vs PGA Tour disagreement value
      if (filters.showDataSourceDisagreement && analysis.analysis.hasDataSourceDisagreement && analysis.analysis.dgAdvantagePlayer) {
        const dgAdvantagePlayer = analysis.players.find(p => p.name === analysis.analysis.dgAdvantagePlayer);
        if (dgAdvantagePlayer) {
          const dgAdvantage = analysis.analysis.dgAdvantageSize;
          let reason = `DataGolf rates ${dgAdvantage.toFixed(2)} SG higher than PGA Tour`;
          
          if (analysis.analysis.dataSourceDisagreementType === 'strong') {
            reason = `Strong data disagreement - ${reason}`;
          }
          
          valuePlayers.push({
            dgId: dgAdvantagePlayer.dgId,
            name: dgAdvantagePlayer.name,
            odds: dgAdvantagePlayer.odds,
            matchupId: matchup.id,
            reason,
            sgTotal: dgAdvantagePlayer.dgSgTotal // Use DataGolf SG since that's the advantage
          });
        }
      }
    });

    // Remove duplicates (same player from multiple reasons)
    const uniquePlayers = valuePlayers.filter((player, index, array) => 
      array.findIndex(p => p.dgId === player.dgId && p.matchupId === player.matchupId) === index
    );

    return uniquePlayers;
  }, [filteredMatchups, analysisCache, filters]);

  return {
    filteredMatchups,
    filterState,
    updateFilter,
    applyPreset,
    clearFilters,
    getMatchupAnalysis,
    getRawMatchupAnalysis,
    getValuePlayers,
    isLoading,
    activePreset
  };
}
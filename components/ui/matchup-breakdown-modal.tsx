"use client"

import { FC, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatPlayerName } from '@/lib/utils';
import { MatchupComparison } from '@/lib/matchup-comparison-engine';

interface MatchupBreakdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchupAnalysis: MatchupComparison | null;
  recommendedPlayer: {
    name: string;
    reason: string;
    odds: number | null;
    sgTotal: number | null;
  };
}

export const MatchupBreakdownModal: FC<MatchupBreakdownModalProps> = ({
  open,
  onOpenChange,
  matchupAnalysis,
  recommendedPlayer
}) => {
  if (!matchupAnalysis) {
    return null;
  }

  const { players, analysis } = matchupAnalysis;
  
  // Sort players by odds (favorite first)
  const sortedPlayers = [...players].sort((a, b) => (a.odds ?? 999) - (b.odds ?? 999));
  
  // Find the recommended player in the analysis
  const recommendedPlayerData = players.find(p => 
    formatPlayerName(p.name).toLowerCase() === formatPlayerName(recommendedPlayer.name).toLowerCase()
  );

  const formatOdds = (decimalOdds: number | null) => {
    if (decimalOdds == null || decimalOdds <= 1.01) {
      return 'N/A';
    }
    
    if (decimalOdds >= 2.00) {
      // Positive American odds: (Decimal - 1) * 100
      const americanOdds = (decimalOdds - 1) * 100;
      return `+${Math.round(americanOdds)}`;
    } else {
      // Negative American odds: -100 / (Decimal - 1)
      const americanOdds = -100 / (decimalOdds - 1);
      return `${Math.round(americanOdds)}`;
    }
  };

  const getSGColor = (sg: number | null) => {
    if (!sg) return 'text-gray-400';
    if (sg > 1.0) return 'text-green-400';
    if (sg > 0.5) return 'text-yellow-400';
    if (sg > 0) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatSG = (sg: number | null) => {
    if (sg === null || sg === undefined) return 'N/A';
    return sg >= 0 ? `+${sg.toFixed(2)}` : sg.toFixed(2);
  };

  // Calculate SG leaders for each category
  const sgLeaders = useMemo(() => {
    const leaders: Record<string, number> = {};
    const MINIMUM_GAP = 0.05;
    
    // For each PGA Tour SG category, find the leader
    ['sgTotal', 'sgPutt', 'sgApp', 'sgArg', 'sgOtt'].forEach(category => {
      const playersWithStat = players.filter(p => p[category as keyof typeof p] !== null);
      if (playersWithStat.length >= 2) {
        const sorted = [...playersWithStat].sort((a, b) => 
          (b[category as keyof typeof b] as number || 0) - (a[category as keyof typeof a] as number || 0)
        );
        const leader = sorted[0];
        const secondBest = sorted[1];
        const gap = (leader[category as keyof typeof leader] as number || 0) - 
                   (secondBest[category as keyof typeof secondBest] as number || 0);
        
        // Only mark as leader if gap is meaningful
        if (gap >= MINIMUM_GAP) {
          leaders[category] = leader.dgId;
        }
      }
    });

    // For each DataGolf SG category, find the leader
    ['dgSgTotal', 'dgSgPutt', 'dgSgApp', 'dgSgArg', 'dgSgOtt'].forEach(category => {
      const playersWithStat = players.filter(p => (p as any)[category] !== null);
      if (playersWithStat.length >= 2) {
        const sorted = [...playersWithStat].sort((a, b) => 
          ((b as any)[category] || 0) - ((a as any)[category] || 0)
        );
        const leader = sorted[0];
        const secondBest = sorted[1];
        const gap = ((leader as any)[category] || 0) - ((secondBest as any)[category] || 0);
        
        if (gap >= MINIMUM_GAP) {
          leaders[category] = leader.dgId;
        }
      }
    });
    
    return leaders;
  }, [players]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Matchup Breakdown</span>
            <Badge variant="outline" className="text-xs">
              {matchupAnalysis.type.toUpperCase()}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Why This Player Was Recommended */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              🎯 Why {formatPlayerName(recommendedPlayer.name)} is Recommended
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Reason:</strong> {recommendedPlayer.reason}
            </p>
            {analysis.hasOddsGap && recommendedPlayer.reason.includes('odds gap') && (
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>Odds Gap:</strong> {(() => {
                  // Calculate gap between recommended player and favorite
                  const recommendedPlayerData = players.find(p => 
                    formatPlayerName(p.name).toLowerCase() === formatPlayerName(recommendedPlayer.name).toLowerCase()
                  );
                  const favorite = [...players].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0))[0];
                  
                  if (!recommendedPlayerData || !favorite.odds || !recommendedPlayerData.odds) {
                    return `${Math.round(analysis.oddsGapSize * 100)} point difference`;
                  }
                  
                  const favoriteOdds = (favorite.odds - 1) * 100;
                  const recommendedOdds = (recommendedPlayerData.odds - 1) * 100;
                  const gap = Math.abs(recommendedOdds - favoriteOdds);
                  
                  return `${Math.round(gap)} point difference`;
                })()} suggests pricing disagreement
              </p>
            )}
            {analysis.hasOddsSgMismatch && !recommendedPlayer.reason.includes('DataGolf rates') && (
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>Value Mismatch:</strong> Player has better stats than their odds suggest
              </p>
            )}
            {recommendedPlayer.reason.includes('DataGolf rates') && (
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                <strong>Data Intelligence:</strong> DataGolf model significantly favors this player over market assessment
              </p>
            )}
          </div>

          {/* Player Comparison Table */}
          <div>
            <h3 className="font-semibold mb-3">Player Comparison</h3>
            <div className="mb-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              <span className="font-medium">📊 Data Sources:</span> For SG stats, PGA Tour data is shown on the <strong>left</strong> and DataGolf data on the <strong>right</strong> (PGA / DG format)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Player</th>
                    <th className="text-center py-2 font-medium">FD Odds</th>
                    <th className="text-center py-2 font-medium">DG Odds</th>
                    <th className="text-center py-2 font-medium">SG Total</th>
                    <th className="text-center py-2 font-medium">SG Putt</th>
                    <th className="text-center py-2 font-medium">SG App</th>
                    <th className="text-center py-2 font-medium">SG Arg</th>
                    <th className="text-center py-2 font-medium">SG OTT</th>
                    <th className="text-center py-2 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, index) => {
                    const isRecommended = formatPlayerName(player.name).toLowerCase() === 
                                        formatPlayerName(recommendedPlayer.name).toLowerCase();
                    
                    return (
                      <tr 
                        key={player.dgId} 
                        className={`border-b ${isRecommended ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                      >
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            {formatPlayerName(player.name)}
                            {isRecommended && (
                              <Badge variant="default" className="text-xs">
                                PICK
                              </Badge>
                            )}
                            {index === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                FAV
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-2 font-mono">
                          {formatOdds(player.odds)}
                        </td>
                        <td className="text-center py-2 font-mono">
                          {player.dgOdds && (
                            <span className={
                              // Highlight if this player is DG favorite but not FD favorite
                              (() => {
                                const playersWithBothOdds = players.filter(p => p.odds && p.dgOdds);
                                if (playersWithBothOdds.length < 2) return '';
                                
                                const fdFav = [...playersWithBothOdds].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0))[0];
                                const dgFav = [...playersWithBothOdds].sort((a, b) => (a.dgOdds ?? 0) - (b.dgOdds ?? 0))[0];
                                
                                if (player.dgId === dgFav.dgId && player.dgId !== fdFav.dgId) {
                                  return 'font-bold bg-yellow-500/20 px-2 py-0.5 rounded';
                                }
                                return '';
                              })()
                            }>
                              {formatOdds(player.dgOdds)}
                            </span>
                          )}
                          {!player.dgOdds && 'N/A'}
                        </td>
                        <td className="text-center py-2 font-mono">
                          <div className="flex justify-center items-center gap-1">
                            <span className={`${getSGColor(player.sgTotal)} ${sgLeaders.sgTotal === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG(player.sgTotal)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className={`${getSGColor((player as any).dgSgTotal)} ${sgLeaders.dgSgTotal === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG((player as any).dgSgTotal)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 font-mono">
                          <div className="flex justify-center items-center gap-1">
                            <span className={`${getSGColor(player.sgPutt)} ${sgLeaders.sgPutt === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG(player.sgPutt)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className={`${getSGColor((player as any).dgSgPutt)} ${sgLeaders.dgSgPutt === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG((player as any).dgSgPutt)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 font-mono">
                          <div className="flex justify-center items-center gap-1">
                            <span className={`${getSGColor(player.sgApp)} ${sgLeaders.sgApp === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG(player.sgApp)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className={`${getSGColor((player as any).dgSgApp)} ${sgLeaders.dgSgApp === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG((player as any).dgSgApp)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 font-mono">
                          <div className="flex justify-center items-center gap-1">
                            <span className={`${getSGColor(player.sgArg)} ${sgLeaders.sgArg === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG(player.sgArg)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className={`${getSGColor((player as any).dgSgArg)} ${sgLeaders.dgSgArg === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG((player as any).dgSgArg)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2 font-mono">
                          <div className="flex justify-center items-center gap-1">
                            <span className={`${getSGColor(player.sgOtt)} ${sgLeaders.sgOtt === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG(player.sgOtt)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className={`${getSGColor((player as any).dgSgOtt)} ${sgLeaders.dgSgOtt === player.dgId ? 'font-bold bg-green-500/20 px-1 py-0.5 rounded' : ''}`}>
                              {formatSG((player as any).dgSgOtt)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center py-2">
                          {player.position ?? 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Analysis Insights */}
          <div className={`grid grid-cols-1 gap-4 ${recommendedPlayer.reason.includes('odds gap') ? 'md:grid-cols-2' : ''}`}>
            {/* Odds Analysis - only show for odds-based recommendations */}
            {recommendedPlayer.reason.includes('odds gap') && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">📊 Odds Analysis</h4>
                <div className="text-sm space-y-1">
                  <div>Gap Size: <span className="font-mono">{(() => {
                    // Calculate gap between recommended player and favorite
                    const recommendedPlayerData = players.find(p => 
                      formatPlayerName(p.name).toLowerCase() === formatPlayerName(recommendedPlayer.name).toLowerCase()
                    );
                    const favorite = [...players].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0))[0];
                    
                    if (!recommendedPlayerData || !favorite.odds || !recommendedPlayerData.odds) {
                      return `${Math.round(analysis.oddsGapSize * 100)} pts`;
                    }
                    
                    const favoriteOdds = (favorite.odds - 1) * 100;
                    const recommendedOdds = (recommendedPlayerData.odds - 1) * 100;
                    const gap = Math.abs(recommendedOdds - favoriteOdds);
                    
                    return `${Math.round(gap)} pts`;
                  })()}</span></div>
                  <div>Favorite: <span className="font-medium">{analysis.oddsLeader}</span></div>
                  {analysis.hasOddsSgMismatch && (
                    <div className="text-amber-600 dark:text-amber-400">
                      ⚠️ SG/Odds Mismatch Detected
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SG Analysis */}
            <div className="border rounded-lg p-3">
              <h4 className="font-medium mb-2">🏌️ Performance Analysis</h4>
              <div className="text-sm space-y-1">
                <div>SG Leader: <span className="font-medium">{analysis.sgLeader}</span></div>
                <div>SG Gap: <span className="font-mono">{analysis.sgGapSize.toFixed(2)}</span></div>
                {analysis.sgCategoryDominance && (
                  <div className="text-green-600 dark:text-green-400">
                    🏆 {analysis.sgCategoryDominance.player} leads {analysis.sgCategoryDominance.categories}/4 categories by 0.05+ SG
                  </div>
                )}
                {analysis.hasPuttingEdge && (
                  <div className="text-blue-600 dark:text-blue-400">
                    ⛳ Putting advantage: +{analysis.puttingGapSize.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            {/* DataGolf Analysis - only show if we have DataGolf data */}
            {(analysis.dgLeader || analysis.hasDataSourceDisagreement) && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">🔍 Data Intelligence</h4>
                <div className="text-sm space-y-1">
                  {analysis.dgLeader && (
                    <div>DataGolf Leader: <span className="font-medium">{analysis.dgLeader}</span></div>
                  )}
                  {analysis.dgGapSize > 0 && (
                    <div>DG Gap: <span className="font-mono">{analysis.dgGapSize.toFixed(2)}</span></div>
                  )}
                  {analysis.hasDataSourceDisagreement && (
                    <div className={`${analysis.dataSourceDisagreementType === 'strong' ? 'text-purple-600 dark:text-purple-400' : 'text-purple-500 dark:text-purple-300'}`}>
                      🧠 {analysis.dataSourceDisagreementType === 'strong' ? 'Strong' : 'Mild'} data source disagreement
                    </div>
                  )}
                  {analysis.hasDataConsensus && (
                    <div className="text-green-600 dark:text-green-400">
                      ✅ High confidence - both data sources agree
                    </div>
                  )}
                  {analysis.dgAdvantagePlayer && analysis.dgAdvantageSize > 0.1 && (
                    <div className="text-purple-600 dark:text-purple-400">
                      📈 DataGolf rates {analysis.dgAdvantagePlayer} {analysis.dgAdvantageSize.toFixed(2)} SG higher
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Key Takeaway */}
          <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">💡 Key Takeaway</h4>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {recommendedPlayer.reason.includes('odds gap') && analysis.hasOddsSgMismatch
                ? `${formatPlayerName(recommendedPlayer.name)} offers value due to both odds disagreement and superior performance metrics compared to their odds.`
                : recommendedPlayer.reason.includes('odds gap')
                ? `${formatPlayerName(recommendedPlayer.name)} represents value based on odds pricing disagreement between sportsbooks.`
                : recommendedPlayer.reason.includes('SG categories')
                ? (() => {
                    // Check if the recommended player is the favorite or has similar odds
                    const recommendedPlayerData = players.find(p => 
                      formatPlayerName(p.name).toLowerCase() === formatPlayerName(recommendedPlayer.name).toLowerCase()
                    );
                    const favorite = [...players].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0))[0];
                    
                    if (!recommendedPlayerData || !favorite.odds || !recommendedPlayerData.odds) {
                      return `${formatPlayerName(recommendedPlayer.name)} dominates multiple statistical categories and represents strong value.`;
                    }
                    
                    const favoriteOdds = (favorite.odds - 1) * 100;
                    const recommendedOdds = (recommendedPlayerData.odds - 1) * 100;
                    const oddsGap = Math.abs(recommendedOdds - favoriteOdds);
                    
                    if (recommendedPlayerData.dgId === favorite.dgId) {
                      return `${formatPlayerName(recommendedPlayer.name)} is the betting favorite and also leads statistically - a strong combination.`;
                    } else if (oddsGap <= 20) {
                      return `${formatPlayerName(recommendedPlayer.name)} dominates multiple statistical categories despite similar odds to the favorite.`;
                    } else {
                      return `${formatPlayerName(recommendedPlayer.name)} dominates multiple statistical categories, making him great value at longer odds.`;
                    }
                  })()
                : recommendedPlayer.reason.includes('DataGolf rates')
                ? (() => {
                    const recommendedPlayerData = players.find(p => 
                      formatPlayerName(p.name).toLowerCase() === formatPlayerName(recommendedPlayer.name).toLowerCase()
                    );
                    const favorite = [...players].sort((a, b) => (a.odds ?? 0) - (b.odds ?? 0))[0];
                    const isFavorite = recommendedPlayerData?.dgId === favorite?.dgId;
                    
                    return isFavorite 
                      ? `${formatPlayerName(recommendedPlayer.name)} is the betting favorite, but DataGolf's model rates them significantly higher than PGA Tour data suggests, indicating the market may still be undervaluing their true skill level.`
                      : `${formatPlayerName(recommendedPlayer.name)} represents value based on DataGolf's superior player assessment model, which rates them much higher than both PGA Tour stats and market pricing indicate.`;
                  })()
                : analysis.hasOddsSgMismatch
                ? `${formatPlayerName(recommendedPlayer.name)} has better performance stats than their betting odds suggest, indicating potential value.`
                : `${formatPlayerName(recommendedPlayer.name)} meets the filter criteria for this matchup type.`
              }
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
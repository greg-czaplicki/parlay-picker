"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, AlertCircle, Info, Filter as FilterIcon } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { useParlayContext, ParlaySelection } from "@/context/ParlayContext"
import { useRecommendedPicksQuery, Player } from "@/hooks/use-recommended-picks-query"
import { useFilteredPlayers } from "@/hooks/use-filtered-players"
import { useFilterManager } from "@/hooks/use-filter-manager"
import { useParlaysQuery } from '@/hooks/use-parlays-query'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilterPanel } from "@/components/ui/filter-panel"
import { FilterChipList } from "@/components/ui/filter-chip"
import { Badge } from "@/components/ui/badge"
import { formatPlayerName } from "@/lib/utils"

interface RecommendedPicksProps {
  eventId: number | null;
  matchupType: "2ball" | "3ball";
  limit?: number;
  oddsGapPercentage?: number;
  bookmaker?: string;
  roundNum?: number | null;
  showFilters?: boolean;
  compactFilters?: boolean;
  filteredData?: Player[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
}

// Helper to format Decimal odds into American odds string
const formatOdds = (decimalOdds: number | null | undefined): string => {
  if (decimalOdds == null || decimalOdds <= 1.01) {
      // Handle null, undefined, or odds too low to be meaningful/convertible
      return "N/A"; 
  }
  
  if (decimalOdds >= 2.00) {
    // Positive American odds: (Decimal - 1) * 100
    const americanOdds = (decimalOdds - 1) * 100;
    return `+${Math.round(americanOdds)}`;
  } else {
    // Negative American odds: -100 / (Decimal - 1)
    const americanOdds = -100 / (decimalOdds - 1);
    // Negative sign is implicit in the calculation result
    return `${Math.round(americanOdds)}`; 
  }
};

// Helper to convert decimal odds to American odds as a number
const convertToAmericanOdds = (decimalOdds: number | null | undefined): number => {
  if (decimalOdds == null || decimalOdds <= 1.01) {
      // Handle null, undefined, or odds too low to be meaningful/convertible
      return 0; 
  }
  
  if (decimalOdds >= 2.00) {
    // Positive American odds: (Decimal - 1) * 100
    return Math.round((decimalOdds - 1) * 100);
  } else {
    // Negative American odds: -100 / (Decimal - 1)
    return Math.round(-100 / (decimalOdds - 1));
  }
};

// Helper to color code SG values
function getSGColorClass(sg: number | null | undefined) {
  if (sg == null || isNaN(sg)) return "text-gray-400";
  if (sg >= 2) return "text-green-700 font-bold";
  if (sg >= 1) return "text-green-500 font-semibold";
  if (sg >= 0) return "text-green-300";
  if (sg >= -1) return "text-red-400";
  if (sg >= -2) return "text-red-600 font-semibold";
  return "text-red-800 font-bold";
}

export default function RecommendedPicks({
  eventId,
  matchupType,
  limit = 10,
  oddsGapPercentage = 40,
  bookmaker = "fanduel",
  roundNum,
  showFilters = true,
  compactFilters = false,
  filteredData,
  isLoading: externalIsLoading,
  isError: externalIsError,
  error: externalError,
}: RecommendedPicksProps) {
  // Get the parlay context
  const { addSelection, removeSelection, selections } = useParlayContext()
  // Track which players have been added to the parlay
  const [addedPlayers, setAddedPlayers] = useState<Record<string, boolean>>({})

  // Fetch complete matchup data to find opponents
  const { data: fullMatchupData } = useRecommendedPicksQuery(
    eventId,
    matchupType,
    bookmaker,
    100, // Get more data for opponents
    500, // Higher limit to get all players
    roundNum
  )

  // Filter management - only used if showFilters is true and no external data provided
  const filterManager = useFilterManager({ 
    autoSave: true, 
    enablePerformanceTracking: true 
  })

  // Use external data if provided, otherwise use our own filtered hook
  const shouldUseExternalData = filteredData !== undefined;

  // Use our new filtered players hook - only when not using external data
  const {
    data: internalRecommendations,
    isLoading: internalIsLoading,
    isError: internalIsError,
    error: internalError,
    originalCount,
    filteredCount,
    appliedFilters,
    performance
  } = useFilteredPlayers(
    shouldUseExternalData ? null : eventId, 
    matchupType, 
    roundNum, 
    {
      filterIds: filterManager.selectedFilters,
      filterOptions: filterManager.filterOptions,
      bookmaker,
      oddsGapPercentage,
      limit,
      debounceMs: 300,
      enableCaching: true
    }
  )

  // Use external data if provided, otherwise use internal data
  const filteredRecommendations = shouldUseExternalData ? filteredData : internalRecommendations;
  const isLoading = shouldUseExternalData ? (externalIsLoading ?? false) : internalIsLoading;
  const isError = shouldUseExternalData ? (externalIsError ?? false) : internalIsError;
  const error = shouldUseExternalData ? externalError : internalError;



  // All user parlays for indicator logic - only check against active parlays (not settled ones)
  const userId = '00000000-0000-0000-0000-000000000001';
  const { data: allParlays = [] } = useParlaysQuery(userId);
  
  // Filter to only active parlays (parlays that have at least one unsettled pick)
  const activeParlays = (allParlays ?? []).filter((parlay: any) => {
    if (!Array.isArray(parlay.picks)) return true;
    return parlay.picks.some((pick: any) => 
      !pick.settlement_status || pick.settlement_status === 'pending'
    );
  });
  
  const allParlayPicks = activeParlays.flatMap((parlay: any) => parlay.picks || []);
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => formatPlayerName(pick.picked_player_name || '').toLowerCase() === formatPlayerName(playerName).toLowerCase());

  // Use filtered recommendations directly - no cross-filtering with main matchups table
  const finalRecommendations = filteredRecommendations;

  // Helper function to find opponents for a player in the same matchup
  const getOpponents = (currentPlayer: Player) => {
    if (!fullMatchupData) return [];
    
    return fullMatchupData.filter(player => 
      player.matchupId === currentPlayer.matchupId && 
      player.dg_id !== currentPlayer.dg_id
    );
  };

  // Function to add a player to the parlay
  const addToParlay = (selection: ParlaySelection, playerId: string) => {
    // Format player name to "First Last" format
    const formattedPlayerName = formatPlayerName(selection.player)
    selection.player = formattedPlayerName
    
    addSelection(selection)
    
    // Track this player as added
    setAddedPlayers(prev => ({ ...prev, [playerId]: true }))
    
    toast({
      title: "Added to Parlay",
      description: `${formattedPlayerName} has been added to your parlay.`,
      duration: 3000
    })
  }
  
  // Function to remove a player from the parlay
  const removeFromParlay = (selectionId: string, playerId: string, playerName: string) => {
    removeSelection(selectionId)
    
    // Mark player as removed in local state
    setAddedPlayers(prev => ({ ...prev, [playerId]: false }))
    
    toast({
      title: "Removed from Parlay",
      description: `${formatPlayerName(playerName)} has been removed from your parlay.`,
      duration: 3000
    })
  }
  
  // Check if a player is already in the parlay
  const isPlayerInParlay = (playerId: string, playerName: string): { inParlay: boolean, selectionId?: string } => {
    // First check our local tracking state
    if (addedPlayers[playerId]) {
      // Find the selection ID
      const selection = selections.find(s => {
        // Try to match by player name using formatted names
        const nameToCheck = formatPlayerName(s.player)
        const nameToMatch = formatPlayerName(playerName)
        
        return nameToCheck.toLowerCase() === nameToMatch.toLowerCase()
      })
      
      return { inParlay: true, selectionId: selection?.id }
    }
    
    return { inParlay: false }
  }
  
  // Sync addedPlayers state with selections from context
  useEffect(() => {
    // Find players that are currently in recommendations and also in selections
    const newAddedPlayers: Record<string, boolean> = {};
    (finalRecommendations ?? []).forEach((player: Player) => {
      const formattedPlayerName = formatPlayerName(player.name)
      const isInParlay = selections.some((selection: ParlaySelection) => {
        const selectionPlayerName = formatPlayerName(selection.player)
        return selectionPlayerName.toLowerCase() === formattedPlayerName.toLowerCase()
      })
      newAddedPlayers[String(player.dg_id)] = isInParlay
    })
    setAddedPlayers(newAddedPlayers)
  }, [finalRecommendations, selections])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showFilters && !shouldUseExternalData && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilterIcon className="h-5 w-5" />
                Recommendation Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        )}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="glass-card">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error Loading Recommendations</AlertTitle>
        <AlertDescription>
          {error?.message || "Failed to load recommended picks. Please try again."}
        </AlertDescription>
      </Alert>
    )
  }

  if (!finalRecommendations || finalRecommendations.length === 0) {
    return (
      <div className="space-y-4">
        {showFilters && !shouldUseExternalData && (
          <FilterPanel
            selectedFilters={filterManager.selectedFilters}
            onFiltersChange={(filterIds) => {
              // Clear existing filters and add new ones
              filterManager.clearAllFilters()
              filterIds.forEach(id => filterManager.addFilter(id))
            }}
            filterOptions={filterManager.filterOptions}
            onFilterOptionsChange={filterManager.updateFilterOptions}
            multiSelect={true}
            showResultCount={true}
            resultCount={0}
            isLoading={isLoading}
            compact={compactFilters}
          />
        )}
        <Alert className="glass-card">
          <Info className="h-4 w-4" />
          <AlertTitle>No Recommendations Available</AlertTitle>
          <AlertDescription>
            {!shouldUseExternalData && filterManager.hasFilters 
              ? `No players match your current filters. Try adjusting your filter criteria.`
              : `No recommended picks found for the selected event and criteria.`
            }
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filter Section - only show if not using external data */}
        {showFilters && !shouldUseExternalData && (
          <FilterPanel
            selectedFilters={filterManager.selectedFilters}
            onFiltersChange={(filterIds) => {
              // Clear existing filters and add new ones
              filterManager.clearAllFilters()
              filterIds.forEach(id => filterManager.addFilter(id))
            }}
            filterOptions={filterManager.filterOptions}
            onFilterOptionsChange={filterManager.updateFilterOptions}
            multiSelect={true}
            showResultCount={true}
            resultCount={finalRecommendations.length}
            isLoading={isLoading}
            compact={compactFilters}
          />
        )}

        {/* Results Summary - only show if not using external data */}
        {!shouldUseExternalData && filterManager.hasFilters && (
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm">
                    {filteredCount} of {originalCount} players
                  </Badge>
                  {appliedFilters.length > 0 && (
                    <FilterChipList
                      filterIds={appliedFilters}
                      onRemove={filterManager.removeFilter}
                      onClearAll={filterManager.clearAllFilters}
                      size="sm"
                      maxVisible={3}
                    />
                  )}
                </div>
                {performance.filterTime > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(performance.filterTime)}ms
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        <Card className="glass-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">
              Recommended Picks
            </CardTitle>
            {matchupType === "2ball" && (
              <p className="text-sm text-muted-foreground mt-2">
                2-ball matchups are head-to-head betting markets between any two players.
              </p>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {finalRecommendations.map((player: Player, index: number) => {
                const playerId = String(player.dg_id);
                const { inParlay, selectionId } = isPlayerInParlay(playerId, player.name);
                const isInOtherParlay = isPlayerInAnyParlay(player.name);
                const opponents = getOpponents(player);
                
                // Check if any opponents are in active parlays (betting against yourself)
                const conflictingOpponents = opponents.filter(opponent => 
                  isPlayerInAnyParlay(opponent.name)
                );
                const hasMatchupConflict = conflictingOpponents.length > 0;

                return (
                  <div
                    key={`${player.dg_id}-${player.matchupId}-${index}`}
                    className={`
                      p-6 border rounded-lg transition-colors
                      ${inParlay ? 'bg-primary/5 border-primary' : 'bg-card border-border'}
                      ${isInOtherParlay && !inParlay && !hasMatchupConflict ? '!bg-blue-50/5 !border-blue-400' : ''}
                      ${hasMatchupConflict ? 'bg-amber-50/5 border-amber-400 border-2' : ''}
                    `}
                  >
                    {/* Player Header */}
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg text-foreground">{formatPlayerName(player.name)}</h3>
                      <div className="flex items-center gap-2">
                        {hasMatchupConflict && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertCircle className="h-5 w-5 text-amber-600" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Betting against yourself! You already have {conflictingOpponents.map(o => formatPlayerName(o.name)).join(', ')} in active parlays</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {isInOtherParlay && !inParlay && !hasMatchupConflict && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-5 w-5 text-blue-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Player is in another parlay</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* Opponents */}
                    {opponents.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm text-muted-foreground">
                          vs.{' '}
                          {opponents
                            .sort((a, b) => (a.odds || Infinity) - (b.odds || Infinity)) // Sort by best odds first (lowest decimal)
                            .map((opponent, index) => {
                              const isConflicting = conflictingOpponents.some(conflicted => conflicted.dg_id === opponent.dg_id);
                              const opponentText = `${formatPlayerName(opponent.name)} (${formatOdds(opponent.odds)})`;
                              
                              return (
                                <span key={opponent.dg_id}>
                                  {index > 0 && ', '}
                                  <span className={isConflicting ? 'text-amber-800 font-semibold' : ''}>
                                    {isConflicting && '⚠️ '}
                                    {opponentText}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Stats Grid - More Spacious */}
                    <div className="grid grid-cols-4 gap-6 mb-6">
                      {/* Odds */}
                      <div className="text-center">
                        <div className="text-xl font-bold text-foreground">{formatOdds(player.odds)}</div>
                        <div className="text-sm text-muted-foreground mt-1">Odds</div>
                      </div>
                      
                      {/* Gap (if exists) */}
                      {(player as any).oddsGapToNext ? (
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">
                            +{(() => {
                              const favoriteAmericanOdds = convertToAmericanOdds(player.odds);
                              const nextBestAmericanOdds = convertToAmericanOdds((player as any).nextBestOdds);
                              
                              // Calculate gap based on odds signs
                              let americanGap;
                              
                              if (favoriteAmericanOdds < 0 && nextBestAmericanOdds > 0) {
                                // Crossing even odds line: total distance from both even odds lines
                                // Favorite distance from -100, next best distance from +100
                                const favoriteDistance = Math.abs(favoriteAmericanOdds - (-100));
                                const nextBestDistance = Math.abs(nextBestAmericanOdds - 100);
                                americanGap = favoriteDistance + nextBestDistance;
                              } else if (favoriteAmericanOdds > 0 && nextBestAmericanOdds > 0) {
                                // Both positive: simple difference
                                americanGap = nextBestAmericanOdds - favoriteAmericanOdds;
                              } else if (favoriteAmericanOdds < 0 && nextBestAmericanOdds < 0) {
                                // Both negative: difference of absolute values  
                                americanGap = Math.abs(nextBestAmericanOdds) - Math.abs(favoriteAmericanOdds);
                              } else {
                                // Fallback to simple absolute difference
                                americanGap = Math.abs(nextBestAmericanOdds - favoriteAmericanOdds);
                              }
                              
                              return Math.round(americanGap);
                            })()}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Edge</div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className={`text-xl font-bold ${getSGColorClass(player.sgTotal)}`}>
                            {player.sgTotal?.toFixed(2) ?? 'N/A'}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">SG Total</div>
                        </div>
                      )}
                      
                      {/* Value Score (when composite score exists) */}
                      {(player as any).compositeScore ? (
                        <div className="text-center">
                          <div className="text-xl font-bold text-blue-600">
                            {((player as any).compositeScore * 9 + 1).toFixed(1)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Value</div>
                        </div>
                      ) : (
                        /* SG Total (when gap exists but no composite score) */
                        (player as any).oddsGapToNext && (
                          <div className="text-center">
                            <div className={`text-lg font-semibold ${getSGColorClass(player.sgTotal)}`}>
                              {player.sgTotal?.toFixed(2) ?? 'N/A'}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">SG Total</div>
                          </div>
                        )
                      )}
                      
                      {/* Season SG */}
                      {player.seasonSgTotal ? (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-blue-600">
                            {player.seasonSgTotal.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Season SG</div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-lg font-semibold text-muted-foreground">
                            -
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">Season SG</div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center">
                      {inParlay ? (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => selectionId && removeFromParlay(selectionId, playerId, player.name)}
                          className="text-destructive hover:text-destructive w-full py-3"
                        >
                          Remove from Parlay
                        </Button>
                      ) : (
                        <Button
                          variant={hasMatchupConflict ? "outline" : "default"}
                          size="lg"
                          onClick={() => {
                            if (hasMatchupConflict) {
                              // Show warning toast for betting against yourself
                              const conflictNames = conflictingOpponents.map(o => formatPlayerName(o.name)).join(', ');
                              toast({
                                title: "Betting Against Yourself!",
                                description: `You already have ${conflictNames} in active parlays. Adding ${formatPlayerName(player.name)} means you're betting against yourself in the same matchup.`,
                                duration: 5000,
                                variant: "destructive"
                              });
                            }
                            
                            const selection: ParlaySelection = {
                              id: `${player.dg_id}-${player.matchupId}`,
                              matchupType: matchupType,
                              group: `Event ${eventId || 'Unknown'}`,
                              player: player.name,
                              odds: player.odds,
                              matchupId: String(player.matchupId),
                              eventName: player.eventName || '',
                              roundNum: player.roundNum || roundNum || 1,
                              valueRating: player.valueRating || 7.5,
                              confidenceScore: player.confidenceScore || 75
                            }
                            addToParlay(selection, playerId)
                          }}
                          className={`w-full py-3 ${hasMatchupConflict ? 'border-amber-400 text-amber-700 hover:bg-amber-500' : ''}`}
                        >
                          <Plus className="h-5 w-5 mr-2" />
                          {hasMatchupConflict 
                            ? "Add Anyway (Conflict)" 
                            : isInOtherParlay 
                              ? "Add Anyway (In Parlay)" 
                              : "Add to Parlay"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
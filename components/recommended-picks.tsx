"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, AlertCircle, Info, Filter as FilterIcon } from "lucide-react"
import { getMatchups, Matchup } from "@/app/actions/matchups"
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

  // Debug logging
  console.log('RecommendedPicks Debug:', {
    shouldUseExternalData,
    baseDataLength: internalRecommendations?.length || 0,
    filteredDataLength: filteredRecommendations?.length || 0,
    originalCount,
    filteredCount,
    selectedFilters: filterManager.selectedFilters,
    appliedFilters,
    firstFewPlayers: filteredRecommendations?.slice(0, 3)
  })

  // All user parlays for indicator logic
  const userId = '00000000-0000-0000-0000-000000000001';
  const { data: allParlays = [] } = useParlaysQuery(userId);
  const allParlayPicks = (allParlays ?? []).flatMap((parlay: any) => parlay.picks || []);
  const isPlayerInAnyParlay = (playerName: string) =>
    allParlayPicks.some((pick: any) => (pick.picked_player_name || '').toLowerCase() === playerName.toLowerCase());

  // Use filtered recommendations directly - no cross-filtering with main matchups table
  const finalRecommendations = filteredRecommendations;

  // Function to add a player to the parlay
  const addToParlay = (selection: ParlaySelection, playerId: string) => {
    // Format player name to "First Last" format if it's in "Last, First" format
    let playerName = selection.player
    if (playerName.includes(",")) {
      const [lastName, firstName] = playerName.split(",").map(part => part.trim())
      playerName = `${firstName} ${lastName}`
      selection.player = playerName
    }
    
    addSelection(selection)
    
    // Track this player as added
    setAddedPlayers(prev => ({ ...prev, [playerId]: true }))
    
    toast({
      title: "Added to Parlay",
      description: `${playerName} has been added to your parlay.`,
      duration: 3000
    })
  }
  
  // Function to remove a player from the parlay
  const removeFromParlay = (selectionId: string, playerId: string, playerName: string) => {
    removeSelection(selectionId)
    
    // Mark player as removed in local state
    setAddedPlayers(prev => ({ ...prev, [playerId]: false }))
    
    // Format player name if needed for toast
    let displayName = playerName
    if (displayName.includes(",")) {
      const [lastName, firstName] = displayName.split(",").map(part => part.trim())
      displayName = `${firstName} ${lastName}`
    }
    
    toast({
      title: "Removed from Parlay",
      description: `${displayName} has been removed from your parlay.`,
      duration: 3000
    })
  }
  
  // Check if a player is already in the parlay
  const isPlayerInParlay = (playerId: string, playerName: string): { inParlay: boolean, selectionId?: string } => {
    // First check our local tracking state
    if (addedPlayers[playerId]) {
      // Find the selection ID
      const selection = selections.find(s => {
        // Try to match by player name, accounting for "Last, First" vs "First Last" format
        let nameToCheck = s.player
        let nameToMatch = playerName
        
        if (nameToCheck.includes(",")) {
          const [lastName, firstName] = nameToCheck.split(",").map(part => part.trim())
          nameToCheck = `${firstName} ${lastName}`
        }
        
        if (nameToMatch.includes(",")) {
          const [lastName, firstName] = nameToMatch.split(",").map(part => part.trim())
          nameToMatch = `${firstName} ${lastName}`
        }
        
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
      let formattedPlayerName = player.name
      if (formattedPlayerName.includes(",")) {
        const [lastName, firstName] = formattedPlayerName.split(",").map(part => part.trim())
        formattedPlayerName = `${firstName} ${lastName}`
      }
      const isInParlay = selections.some((selection: ParlaySelection) => {
        let selectionPlayerName = selection.player
        if (selectionPlayerName.includes(",")) {
          const [lastName, firstName] = selectionPlayerName.split(",").map(part => part.trim())
          selectionPlayerName = `${firstName} ${lastName}`
        }
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
          <CardHeader>
            <CardTitle className="text-lg">
              Recommended Picks
              {eventId && <span className="text-sm font-normal text-muted-foreground ml-2">Event {eventId}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              {finalRecommendations.map((player: Player, index: number) => {
                const playerId = String(player.dg_id);
                const { inParlay, selectionId } = isPlayerInParlay(playerId, player.name);
                const isInOtherParlay = isPlayerInAnyParlay(player.name);

                return (
                  <div
                    key={`${player.dg_id}-${player.matchupId}-${index}`}
                    className={`
                      p-4 border rounded-lg transition-colors
                      ${inParlay ? 'bg-primary/5 border-primary' : 'bg-card border-border'}
                      ${isInOtherParlay && !inParlay ? 'bg-yellow-50/5 border-yellow-200' : ''}
                    `}
                  >
                    {/* Player Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-base text-foreground">{player.name}</h3>
                      {isInOtherParlay && !inParlay && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-yellow-500" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Player is in another parlay</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {/* Odds */}
                      <div className="text-center">
                        <div className="text-lg font-bold text-foreground">{formatOdds(player.odds)}</div>
                        <div className="text-xs text-muted-foreground">Odds</div>
                      </div>
                      
                      {/* Gap (if exists) */}
                      {(player as any).oddsGapToNext ? (
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-600">
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
                          <div className="text-xs text-muted-foreground">Edge</div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className={`text-lg font-bold ${getSGColorClass(player.sgTotal)}`}>
                            {player.sgTotal?.toFixed(2) ?? 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground">SG Total</div>
                        </div>
                      )}
                      
                      {/* Value Score (when composite score exists) */}
                      {(player as any).compositeScore ? (
                        <div className="text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {((player as any).compositeScore * 9 + 1).toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground">Value</div>
                        </div>
                      ) : (
                        /* SG Total (when gap exists but no composite score) */
                        (player as any).oddsGapToNext && (
                          <div className="text-center">
                            <div className={`text-sm font-semibold ${getSGColorClass(player.sgTotal)}`}>
                              {player.sgTotal?.toFixed(2) ?? 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">SG Total</div>
                          </div>
                        )
                      )}
                      
                      {/* Season SG */}
                      {player.seasonSgTotal && (
                        <div className="text-center">
                          <div className="text-sm font-semibold text-blue-600">
                            {player.seasonSgTotal.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">Season</div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-center">
                      {inParlay ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => selectionId && removeFromParlay(selectionId, playerId, player.name)}
                          className="text-destructive hover:text-destructive w-full"
                        >
                          Remove from Parlay
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => {
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
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add to Parlay
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
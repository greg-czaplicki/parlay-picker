"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Plus, AlertCircle, Info, Filter as FilterIcon, Star } from "lucide-react"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { MatchupBreakdownModal } from "@/components/ui/matchup-breakdown-modal"
import { MatchupComparison } from "@/lib/matchup-comparison-engine"
// Player search functionality is now handled by parent component

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
  // Player search props
  playerSearchTerm?: string;
  highlightText?: (text: string) => React.ReactNode;
  // Matchup analysis function for breakdown modal
  getMatchupAnalysis?: (matchupId: number) => MatchupComparison | null;
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

// Helper to color code SG values for dark theme
function getSGColorClass(sg: number | null | undefined) {
  if (sg == null || isNaN(sg)) return "text-neutral-400";
  if (sg >= 2) return "text-green-400 font-bold";
  if (sg >= 1) return "text-green-300 font-semibold";
  if (sg >= 0) return "text-green-200";
  if (sg >= -1) return "text-red-300";
  if (sg >= -2) return "text-red-400 font-semibold";
  return "text-red-500 font-bold";
}

// Create a wrapper component for the slide-out panel
export function RecommendedPicksPanel(props: RecommendedPicksProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Show panel trigger and content only on mobile */}
      <div className="md:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="default" 
              size="sm" 
              className="fixed h-auto right-0 top-1/2 -translate-y-1/2 z-50 shadow-lg py-8 flex flex-col items-center gap-2 rounded-tr-none rounded-br-none border-r-0"
            >
              <Star className="h-4 w-4" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs">Recommended Picks</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
            <div className="p-6">
              <RecommendedPicksContent {...props} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Show content directly on desktop */}
      <div className="hidden md:block">
        <div>
          <div>
            <RecommendedPicksContent {...props} />
          </div>
        </div>
      </div>
    </>
  )
}

// Rename the default export to indicate it's the inner component
export function RecommendedPicksContent({
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
  playerSearchTerm,
  highlightText,
  getMatchupAnalysis,
}: RecommendedPicksProps) {
  // Get the parlay context
  const { addSelection, removeSelection, selections } = useParlayContext()
  // Track which players have been added to the parlay
  const [addedPlayers, setAddedPlayers] = useState<Record<string, boolean>>({})
  // Add pagination state
  const [displayLimit, setDisplayLimit] = useState(10)
  // Modal state for matchup breakdown
  const [selectedMatchupAnalysis, setSelectedMatchupAnalysis] = useState<MatchupComparison | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<{
    name: string;
    reason: string;
    odds: number | null;
    sgTotal: number | null;
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
    allParlayPicks.some((pick: any) => formatPlayerName(pick.selection_name || pick.picked_player_name || '').toLowerCase() === formatPlayerName(playerName).toLowerCase());

  // Add player search state and functionality


  // Apply player search filtering if search term is provided
  const finalRecommendations = useMemo(() => {
    if (!playerSearchTerm) {
      return filteredRecommendations || []
    }
    
    return (filteredRecommendations || []).filter(player => {
      const formattedName = formatPlayerName(player.name)
      const nameToSearch = formattedName.toLowerCase()
      const searchTerms = playerSearchTerm.toLowerCase().split(' ').filter(term => term.length > 0)
      return searchTerms.every(term => nameToSearch.includes(term))
    })
  }, [filteredRecommendations, playerSearchTerm]);

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

  // Handle opening matchup breakdown modal
  const handleShowBreakdown = (player: Player) => {
    if (!getMatchupAnalysis || !player.matchupId) {
      console.warn('No matchup analysis function provided or matchup ID missing')
      return;
    }

    const analysis = getMatchupAnalysis(player.matchupId);
    if (!analysis) {
      console.warn(`No analysis found for matchup ${player.matchupId}`)
      return;
    }

    setSelectedMatchupAnalysis(analysis);
    setSelectedPlayer({
      name: player.name,
      reason: (player as any).reason || 'Recommended pick',
      odds: player.odds,
      sgTotal: player.sgTotal
    });
    setIsModalOpen(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showFilters && !shouldUseExternalData && (
          <Card className="bg-gray-950/30 border-gray-800">
            <CardHeader className="bg-[#1e1e23]">
              <CardTitle className="flex items-center gap-2 text-white">
                <FilterIcon className="h-5 w-5" />
                Recommendation Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        )}
        <Card className="bg-gray-950/30 border-gray-800">
          <CardContent className="p-4">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border border-gray-800 rounded-lg bg-gray-900/60">
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
      <Alert variant="destructive" className="bg-gray-950/30 border-red-500/50">
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
        <Alert className="bg-gray-950/30 border-gray-800">
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
                    {playerSearchTerm ? `${finalRecommendations.length} of ${filteredCount}` : `${filteredCount} of ${originalCount}`} players
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
            <CardTitle className="text-xl text-white">Recommended Picks</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {finalRecommendations.slice(0, displayLimit).map((player: Player, index: number) => {
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
                      p-4 border rounded-lg transition-colors
                      ${inParlay ? 'bg-primary/10 border-primary' : 'glass-card'}
                      ${isInOtherParlay && !inParlay && !hasMatchupConflict ? ' !border-blue-300' : ''}
                      ${hasMatchupConflict ?  '!border-yellow-200 border-1' : ''}
                    `}
                  >
                    <div className="flex flex-col h-full">
                      {/* Player Header */}
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg text-white">
                          {playerSearchTerm && highlightText ? highlightText(player.name) : formatPlayerName(player.name)}
                        </h3>
                        <div className="flex items-center gap-2">
                          {/* Info icon for matchup breakdown */}
                          {getMatchupAnalysis && player.matchupId && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleShowBreakdown(player)}
                                  className="h-8 w-8 p-0 hover:bg-white/10"
                                >
                                  <Info className="h-4 w-4 text-gray-400 hover:text-white" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-foreground">View matchup breakdown</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {hasMatchupConflict && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertCircle className="h-5 w-5 text-yellow-200" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-foreground">Betting against yourself! You already have {conflictingOpponents.map(o => formatPlayerName(o.name)).join(', ')} in active parlays</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {isInOtherParlay && !inParlay && !hasMatchupConflict && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-5 w-5 text-blue-300" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-foreground">Player is in another parlay</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>

                      {/* Opponents */}
                      {opponents.length > 0 && (
                        <div className="mb-3 text-sm text-muted-foreground">
                          <span>vs.</span>
                          <div className="pl-2">
                            {opponents
                              .sort((a, b) => (a.odds || Infinity) - (b.odds || Infinity)) // Sort by best odds first (lowest decimal)
                              .map((opponent) => {
                                const isConflicting = conflictingOpponents.some(conflicted => conflicted.dg_id === opponent.dg_id);
                                const highlightedName = playerSearchTerm && highlightText ? highlightText(opponent.name) : formatPlayerName(opponent.name);
                                
                                return (
                                  <div key={opponent.dg_id} className="mt-1">
                                    <span className={isConflicting ? 'text-yellow-200' : ''}>
                                      {highlightedName} ({formatOdds(opponent.odds)}){isConflicting && ' ⚠️'}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Stats Row */}
                      <div className="flex-grow flex items-center mb-4">
                        <div className="w-full grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
                          {/* Odds */}
                          <div className="flex flex-col justify-center">
                            <div className="text-lg font-bold text-white">{formatOdds(player.odds)}</div>
                            <div className="text-xs text-muted-foreground mt-1">Odds</div>
                          </div>

                          {/* SG Total */}
                          <div className="flex flex-col justify-center">
                            <div className={`text-lg font-bold ${getSGColorClass(player.sgTotal)}`}>
                              {player.sgTotal?.toFixed(2) ?? 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">SG Total</div>
                          </div>

                          {/* Season SG */}
                          <div className="flex flex-col justify-center">
                            <div className={`text-lg font-bold ${getSGColorClass(
                              (player as any).season_sg_total_calculated ?? player.season_sg_total
                            )}`}>
                              {(() => {
                                const calculatedValue = (player as any).season_sg_total_calculated;
                                const rawValue = player.season_sg_total;
                                return (calculatedValue ?? rawValue)?.toFixed(2) ?? 'N/A';
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Season SG</div>
                          </div>

                          {/* Edge (Conditional) */}
                          {(player as any).oddsGapToNext ? (
                            <div className="hidden sm:flex flex-col justify-center">
                              <div className="text-lg font-bold text-green-500">
                                +{(() => {
                                  const favoriteAmericanOdds = convertToAmericanOdds(player.odds);
                                  const nextBestAmericanOdds = convertToAmericanOdds((player as any).nextBestOdds);
                                  let americanGap;
                                  if (favoriteAmericanOdds < 0 && nextBestAmericanOdds > 0) {
                                    const favoriteDistance = Math.abs(favoriteAmericanOdds - (-100));
                                    const nextBestDistance = Math.abs(nextBestAmericanOdds - 100);
                                    americanGap = favoriteDistance + nextBestDistance;
                                  } else if (favoriteAmericanOdds > 0 && nextBestAmericanOdds > 0) {
                                    americanGap = nextBestAmericanOdds - favoriteAmericanOdds;
                                  } else if (favoriteAmericanOdds < 0 && nextBestAmericanOdds < 0) {
                                    americanGap = Math.abs(nextBestAmericanOdds) - Math.abs(favoriteAmericanOdds);
                                  } else {
                                    americanGap = Math.abs(nextBestAmericanOdds - favoriteAmericanOdds);
                                  }
                                  return Math.round(americanGap);
                                })()}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">Edge</div>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-center mt-auto">
                        {inParlay ? (
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => selectionId && removeFromParlay(selectionId, playerId, player.name)}
                            className="text-red-400 hover:text-red-300 border-red-500/50 hover:border-red-400 w-full py-3"
                          >
                            Remove from Parlay
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="lg"
                            onClick={(e) => {
                              // Prevent double clicks
                              const button = e.currentTarget;
                              button.disabled = true;
                              setTimeout(() => {
                                if (button) {
                                  button.disabled = false;
                                }
                              }, 1000);
                              
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
                                matchupId: player.matchupId,
                                matchupKey: player.matchupKey,
                                eventName: player.eventName || '',
                                roundNum: player.roundNum || roundNum || 1,
                                valueRating: player.valueRating || 7.5,
                                confidenceScore: player.confidenceScore || 75,
                                teeTime: player.teeTime || null
                              }
                              addToParlay(selection, playerId)
                            }}
                            className={`w-full py-3 transition-all duration-200 hover:scale-[1.02] active:scale-95 ${hasMatchupConflict ? 'border-yellow-500/50 text-yellow-200 hover:bg-yellow-500/20 hover:border-yellow-400' : ''} ${isInOtherParlay ? 'border-blue-500/50 text-blue-200 hover:bg-blue-500/20 hover:border-blue-400' : ''}`}
                          >
                            <Plus className="h-5 w-5 mr-2" />
                            {hasMatchupConflict 
                              ? "Add Anyway" 
                              : isInOtherParlay 
                                ? "Add Anyway" 
                                : "Add to Parlay"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Load More Button */}
            {finalRecommendations.length > displayLimit && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="default"
                  onClick={() => setDisplayLimit(prev => prev + 10)}
                >
                  Load More
                  <span className="text-xs">
                    ({displayLimit} of {finalRecommendations.length})
                  </span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Matchup Breakdown Modal */}
        <MatchupBreakdownModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          matchupAnalysis={selectedMatchupAnalysis}
          recommendedPlayer={selectedPlayer || {
            name: '',
            reason: '',
            odds: null,
            sgTotal: null
          }}
        />
      </div>
    </TooltipProvider>
  )
}

// Export the panel as the default for backward compatibility
export default RecommendedPicksPanel;
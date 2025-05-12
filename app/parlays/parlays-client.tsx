'use client';

import { useState, useEffect } from 'react';
import ParlayCard from '@/components/parlay-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { createParlay, ParlayWithPicks, ParlayPickWithData, addParlayPick } from '@/app/actions/matchups';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ParlaysClientProps {
  initialParlays: ParlayWithPicks[];
  initialPicksWithData: ParlayPickWithData[];
  currentRound: number | null;
  error?: string;
}

export default function ParlaysClient({ initialParlays, initialPicksWithData, currentRound, error }: ParlaysClientProps) {
  const [parlays, setParlays] = useState<ParlayWithPicks[]>(initialParlays);
  const [isCreating, setIsCreating] = useState(false);
  const [newParlayName, setNewParlayName] = useState('');
  const [selectedRound, setSelectedRound] = useState<string>('current');
  const [filteredParlays, setFilteredParlays] = useState<ParlayWithPicks[]>([]);
  const router = useRouter();
  
  // Log current round value from server
  // [logger.ts] Not using console.log in client components. Use browser devtools for debugging if needed.
  
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
              picked_player_dg_id: playerId ?? null,
              picked_player_name: playerName ?? null,
              matchup_id: matchupId ?? null,
              event_name: eventName ?? null,
              round_num: roundNum ?? null,
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

  // Filter parlays based on selected round
  useEffect(() => {
    // Log for debugging
    // [logger.ts] Not using console.log in client components. Use browser devtools for debugging if needed.
    // console.log("Current server-side round:", currentRound);
    // console.log("Unique rounds from picks:", uniqueRounds);
    
    if (selectedRound === 'all') {
      // console.log("Showing all rounds");
      setFilteredParlays(parlays);
    } else if (selectedRound === 'current') {
      // console.log(`Filtering for current round (Round 2)`);
      
      // Round 2 is the current round, show:
      // 1. Parlays that have picks from Round 2
      // 2. Empty parlays (no picks yet) since they should be for Round 2
      setFilteredParlays(
        parlays.filter(parlay => {
          // Find this parlay's picks with data
          const parlayPicksWithData = initialPicksWithData.filter(
            pickData => pickData.pick.parlay_id === parlay.id
          );
          
          // If there are no picks yet, show this parlay in Round 2
          if (parlay.picks.length === 0) {
            return true;
          }
          
          // Otherwise, check if any pick is from Round 2
          return parlayPicksWithData.some(
            pickData => pickData.pick.round_num === 2
          );
        })
      );
    } else if (selectedRound && !isNaN(Number(selectedRound))) {
      // Filter to show parlays with picks from the selected round
      const roundNum = Number(selectedRound);
      // console.log(`Filtering for specific round: ${roundNum}`);
      setFilteredParlays(
        parlays.filter(parlay => {
          // Don't show empty parlays for non-current rounds
          if (parlay.picks.length === 0) {
            return false;
          }
          
          const parlayPicksWithData = initialPicksWithData.filter(
            pickData => pickData.pick.parlay_id === parlay.id
          );
          
          return parlayPicksWithData.some(
            pickData => pickData.pick.round_num === roundNum
          );
        })
      );
    } else {
      // console.log("Default case - showing all parlays");
      setFilteredParlays(parlays);
    }
  }, [selectedRound, parlays, initialPicksWithData, currentRound]);

  // Show error toast if there was an error loading parlays
  if (error) {
    toast({ 
      title: "Error Loading Parlays", 
      description: error, 
      variant: "destructive" 
    });
  }

  const handleCreateParlay = async () => {
    setIsCreating(true);
    try {
      const { parlay: newParlay, error } = await createParlay(newParlayName || undefined);
      if (error || !newParlay) {
        toast({ title: "Error Creating Parlay", description: error || "Failed to create.", variant: "destructive" });
      } else {
        setParlays(prev => [...prev, { ...newParlay, picks: [] }]); // Add new parlay with empty picks
        setNewParlayName(''); // Clear input
        
        // Make sure we're viewing the current round so the new parlay is visible
        setSelectedRound('current');
        
        toast({ 
          title: "Round 2 Parlay Created", 
          description: `Parlay "${newParlay.name || `ID: ${newParlay.id}`}" added for Round 2.` 
        });
        
        // Refresh the page data to ensure we have the latest data
        router.refresh();
      }
    } catch (err: any) {
      console.error("Error creating parlay:", err);
      toast({ 
        title: "Error Creating Parlay", 
        description: err?.message || "An unexpected error occurred", 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Active Parlays</h1>
        
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Input
            type="text"
            placeholder="New parlay name (optional)"
            value={newParlayName}
            onChange={(e) => setNewParlayName(e.target.value)}
            className="w-full sm:w-48 h-9"
            disabled={isCreating}
          />
          <Button onClick={handleCreateParlay} disabled={isCreating} size="sm">
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add Parlay
          </Button>
        </div>
      </div>
      
      {/* Round filter dropdown */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Round:</span>
        <Select value={selectedRound} onValueChange={setSelectedRound}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select round" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Round 2 (Current)</SelectItem>
            <SelectItem value="all">All Rounds</SelectItem>
            {uniqueRounds.map(round => (
              <SelectItem key={round} value={String(round)}>
                Round {round} {round === 2 ? '(Current)' : (round === 1 ? '(Complete)' : '')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredParlays.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredParlays.map((parlay) => {
            // Find preloaded data for this parlay's picks
            const parlayPicksWithData = initialPicksWithData.filter(
              pickData => pickData.pick.parlay_id === parlay.id
            );
            
            return (
              <ParlayCard
                  key={parlay.id}
                  parlayId={parlay.id}
                  parlayName={parlay.name}
                  initialPicks={parlay.picks} // Pass initial picks for this parlay
                  initialPicksWithData={parlayPicksWithData} // Pass preloaded data
                  selectedRound={selectedRound === 'current' ? currentRound : selectedRound === 'all' ? null : Number(selectedRound)}
                  onDelete={(deletedId) => {
                    setParlays(prev => prev.filter(p => p.id !== deletedId));
                    router.refresh(); // Refresh to update server data
                  }}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
          <p className="text-muted-foreground">No parlays found for {selectedRound === 'current' ? `Round ${currentRound}` : selectedRound === 'all' ? 'any round' : `Round ${selectedRound}`}.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Click "Add Parlay" to create a new one.
          </p>
        </div>
      )}
    </div>
  );
}
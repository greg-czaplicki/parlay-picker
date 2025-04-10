'use client';

import { useState, useEffect } from 'react';
import ParlayCard from '@/components/parlay-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { getParlaysAndPicks, createParlay, ParlayWithPicks } from '@/app/actions/matchups';

export default function ParlaysPage() {
  const [parlays, setParlays] = useState<ParlayWithPicks[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newParlayName, setNewParlayName] = useState('');

  // Fetch existing parlays on mount (only once)
  useEffect(() => {
    const fetchParlays = async () => {
      if (!isLoading) setIsLoading(true);
      
      try {
        const { parlays: fetchedParlays, error } = await getParlaysAndPicks();
        
        if (error) {
          toast({ title: "Error Loading Parlays", description: error, variant: "destructive" });
        } else {
          setParlays(fetchedParlays || []);
        }
      } catch (err: any) {
        console.error("Error fetching parlays:", err);
        toast({ 
          title: "Error Loading Parlays", 
          description: err?.message || "Failed to load parlays", 
          variant: "destructive" 
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchParlays();
  }, []); // Empty dependency array ensures this only runs once

  const handleCreateParlay = async () => {
      setIsCreating(true);
      const { parlay: newParlay, error } = await createParlay(newParlayName || undefined);
      if (error || !newParlay) {
          toast({ title: "Error Creating Parlay", description: error || "Failed to create.", variant: "destructive" });
      } else {
          setParlays(prev => [...prev, { ...newParlay, picks: [] }]); // Add new parlay with empty picks
          setNewParlayName(''); // Clear input
          toast({ title: "Parlay Created", description: `Parlay "${newParlay.name || `ID: ${newParlay.id}`}" added.` });
      }
      setIsCreating(false);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
         <h1 className="text-2xl font-bold">My Active Parlays</h1>
         {/* Button/Input to create new parlay */}
         <div className="flex items-center space-x-2">
             <Input
                type="text"
                placeholder="New parlay name (optional)"
                value={newParlayName}
                onChange={(e) => setNewParlayName(e.target.value)}
                className="w-48 h-9"
                disabled={isCreating}
             />
             <Button onClick={handleCreateParlay} disabled={isCreating} size="sm">
                 {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                 Add Parlay
             </Button>
         </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin inline-block text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading parlays...</p>
        </div>
      ) : parlays.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {parlays.map((parlay) => (
            <ParlayCard
                key={parlay.id}
                parlayId={parlay.id}
                parlayName={parlay.name}
                initialPicks={parlay.picks} // Pass initial picks for this parlay
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
            <p className="text-muted-foreground">No parlays created yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Click "Add Parlay" to get started.</p>
        </div>
      )}
    </div>
  );
} 
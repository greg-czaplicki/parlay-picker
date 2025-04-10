'use client';

import { useState } from 'react';
import ParlayCard from '@/components/parlay-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { createParlay, ParlayWithPicks, ParlayPickWithData } from '@/app/actions/matchups';
import { useRouter } from 'next/navigation';

interface ParlaysClientProps {
  initialParlays: ParlayWithPicks[];
  initialPicksWithData: ParlayPickWithData[];
  error?: string;
}

export default function ParlaysClient({ initialParlays, initialPicksWithData, error }: ParlaysClientProps) {
  const [parlays, setParlays] = useState<ParlayWithPicks[]>(initialParlays);
  const [isCreating, setIsCreating] = useState(false);
  const [newParlayName, setNewParlayName] = useState('');
  const router = useRouter();

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
        toast({ title: "Parlay Created", description: `Parlay "${newParlay.name || `ID: ${newParlay.id}`}" added.` });
        
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

      {parlays.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {parlays.map((parlay) => {
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
              />
            );
          })}
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
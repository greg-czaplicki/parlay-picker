'use client';

import { useState, useEffect } from 'react';
import ParlayCard from '@/components/parlay-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Loader2, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useParlaysQuery } from '@/hooks/use-parlays-query';
import { useCreateParlayMutation } from '@/hooks/use-create-parlay-mutation';
import { queryKeys } from '@/lib/query-keys';

export default function ParlaysClient({ currentRound }: { currentRound: number | null }) {
  // Use the seeded test user until real auth is implemented
  const userId = '00000000-0000-0000-0000-000000000001';

  // Persistent data via React Query
  const { data, isLoading, isError, error } = useParlaysQuery(userId);
  const parlays = Array.isArray(data) ? data : [];
  const createParlayMutation = useCreateParlayMutation(userId);

  // Derive unique rounds from parlays data
  const uniqueRounds: number[] = Array.from(
    new Set(
      (Array.isArray(parlays) ? parlays : []).flatMap((parlay: { parlay_picks?: { round_num: number | null }[] }) =>
        (parlay.parlay_picks ?? []).map((pick: { round_num: number | null }) => pick.round_num).filter((round: number | null): round is number => round !== null)
      ) as number[]
    )
  ).sort((a, b) => Number(a) - Number(b));

  // Ephemeral UI state
  const [selectedRound, setSelectedRound] = useState<string>(
    uniqueRounds.length > 1 ? 'all' : uniqueRounds.length === 1 ? String(uniqueRounds[0]) : ''
  );

  if (currentRound !== null && !uniqueRounds.includes(currentRound)) {
    uniqueRounds.push(currentRound);
    uniqueRounds.sort((a, b) => Number(a) - Number(b));
  }

  // Filter parlays based on selected round
  const filteredParlays: { id: number; name: string; parlay_picks?: { round_num: number | null }[] }[] = parlays.filter((parlay: { id: number; name: string; parlay_picks?: { round_num: number | null }[] }) => {
    if (selectedRound === 'all') return true;
    if (selectedRound) {
      return (parlay.parlay_picks ?? []).some((pick: { round_num: number | null }) => String(pick.round_num) === selectedRound);
    }
    return false;
  });

  // Error toast for loading
  useEffect(() => {
    if (isError && error) {
      toast({ title: 'Error Loading Parlays', description: error.message, variant: 'destructive' });
    }
  }, [isError, error]);

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">My Active Parlays</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Round:</span>
        <Select value={selectedRound} onValueChange={setSelectedRound}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Select round" />
          </SelectTrigger>
          <SelectContent>
            {uniqueRounds.length === 0 ? (
              <SelectItem value="none" disabled>No rounds available</SelectItem>
            ) : uniqueRounds.length > 1 ? (
              <>
                <SelectItem value="all">All Rounds</SelectItem>
                {uniqueRounds.map((round: number) => (
                  <SelectItem key={String(round)} value={String(round)}>
                    {`Round ${round}`}
                  </SelectItem>
                ))}
              </>
            ) : (
              uniqueRounds.map((round: number) => (
                <SelectItem key={String(round)} value={String(round)}>
                  {`Round ${round}`}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
      {filteredParlays.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredParlays.map(parlay => (
            <ParlayCard
              key={parlay.id}
              parlayId={parlay.id}
              parlayName={parlay.name}
              selectedRound={selectedRound && selectedRound !== 'all' ? Number(selectedRound) : null}
              // Add any additional props needed for new hooks
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
          <p className="text-muted-foreground">No parlays found for {selectedRound && selectedRound !== 'all' ? `Round ${selectedRound}` : 'any round'}.</p>
        </div>
      )}
    </div>
  );
}
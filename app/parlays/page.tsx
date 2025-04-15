import { getParlaysAndPicks, batchLoadParlayPicksData } from '@/app/actions/matchups';
import ParlaysClient from './parlays-client';
import { createServerClient } from "@/lib/supabase";

export default async function ParlaysPage() {
  // Fetch parlays data on the server
  const { parlays, error } = await getParlaysAndPicks();
  
  // Preload data for all picks across all parlays
  const allPicks = parlays?.flatMap(parlay => parlay.picks) || [];
  
  let picksWithData = [];
  let picksDataError;
  
  // Only attempt to load pick data if we have picks
  if (allPicks.length > 0) {
    const { picksWithData: loadedPicksWithData, error: picksError } = await batchLoadParlayPicksData(allPicks);
    picksWithData = loadedPicksWithData;
    picksDataError = picksError;
  }
  
  // Hardcode Round 2 as the current round for Masters 2025
  const currentRound = 2; // This is now hardcoded and not fetched from DB
  
  // Pass the data to a client component
  return (
    <ParlaysClient 
      initialParlays={parlays || []} 
      initialPicksWithData={picksWithData}
      currentRound={currentRound}
      error={error || picksDataError} 
    />
  );
}
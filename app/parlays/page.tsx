import { getParlaysAndPicks, batchLoadParlayPicksData } from '@/app/actions/matchups';
import ParlaysClient from './parlays-client';

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
  
  // Pass the data to a client component
  return (
    <ParlaysClient 
      initialParlays={parlays || []} 
      initialPicksWithData={picksWithData}
      error={error || picksDataError} 
    />
  );
}
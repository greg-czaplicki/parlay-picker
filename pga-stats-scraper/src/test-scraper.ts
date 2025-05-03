import { scrapeStatsCategory } from './scraper';
import { PlayerStats, StatsCategory } from './types/stats';

/**
 * Test function to verify scraper functionality with a single category
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @param category Optional category to test, defaults to SG_TOTAL
 */
export async function testScraper(debugMode: boolean = false, category: StatsCategory = StatsCategory.SG_TOTAL) {
  console.log(`Running test scraper for ${category} category (debug mode: ${debugMode ? 'ON' : 'OFF'})...`);
  
  try {
    console.log(`Trying to scrape ${category} data`);
    
    try {
      const players = await scrapeStatsCategory(category, debugMode);
      
      if (!players || players.length === 0) {
        console.error(`❌ Test failed: No players found for ${category}`);
        return;
      }
      
      console.log(`✅ Successfully scraped ${players.length} players`);
      
      // Print first 5 players as sample data
      console.log('\nSample data (first 5 players):');
      players.slice(0, 5).forEach((player: PlayerStats, index: number) => {
        // Display the appropriate stat based on category
        let statDisplay = '';
        switch(category) {
          case StatsCategory.SG_TOTAL:
            statDisplay = `SG Total = ${player.sgTotal}`;
            break;
          case StatsCategory.SG_OTT:
            statDisplay = `SG Off-the-Tee = ${player.sgOtt}`;
            break; 
          case StatsCategory.SG_APP:
            statDisplay = `SG Approach = ${player.sgApp}`;
            break;
          case StatsCategory.SG_ARG:
            statDisplay = `SG Around-the-Green = ${player.sgArg}`;
            break;
          case StatsCategory.SG_PUTT:
            statDisplay = `SG Putting = ${player.sgPutt}`;
            break;
          case StatsCategory.DRIVING_ACCURACY:
            statDisplay = `Driving Accuracy = ${player.drivingAccuracy}`;
            break;
          case StatsCategory.DRIVING_DISTANCE:
            statDisplay = `Driving Distance = ${player.drivingDistance}`;
            break;
          default:
            statDisplay = `Stats for ${category}`;
        }
        console.log(`${index + 1}. ${player.playerName}: ${statDisplay} (ID: ${player.playerId})`);
      });
      
      console.log('\nTest completed successfully');
    } catch (error) {
      console.error(`Failed to scrape ${category}: ${error}`);
      
      // Fallback to DRIVING_DISTANCE as an alternative
      console.log(`Trying DRIVING_DISTANCE as fallback...`);
      try {
        const fallbackPlayers = await scrapeStatsCategory(StatsCategory.DRIVING_DISTANCE, debugMode);
        
        if (!fallbackPlayers || fallbackPlayers.length === 0) {
          console.error('❌ Test failed: No players found for fallback category');
          return;
        }
        
        console.log(`✅ Successfully scraped ${fallbackPlayers.length} players with fallback`);
        
        // Print first 5 players as sample data
        console.log('\nSample data (first 5 players):');
        fallbackPlayers.slice(0, 5).forEach((player: PlayerStats, index: number) => {
          console.log(`${index + 1}. ${player.playerName}: Driving Distance = ${player.drivingDistance} (ID: ${player.playerId})`);
        });
        
        console.log('\nTest completed successfully with fallback category');
      } catch (fallbackError) {
        console.error('❌ Test failed with all categories:', fallbackError);
      }
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}
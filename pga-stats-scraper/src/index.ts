import { scrapeAllStats } from './scraper';
import { storePlayerSeasonStats } from './utils/supabase';
import * as cron from 'node-cron';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Run the scraper and store results in database
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 */
async function runScraper(debugMode: boolean = false) {
  console.log(`Starting PGA Tour stats scraper (debug mode: ${debugMode ? 'ON' : 'OFF'})...`);
  
  try {
    // Scrape stats from PGA Tour website
    const playerStats = await scrapeAllStats(debugMode);
    console.log(`Scraped stats for ${playerStats.length} players`);
    
    if (playerStats.length === 0) {
      console.error('No player stats found. Aborting database update.');
      return;
    }
    
    // Store stats in database
    const result = await storePlayerSeasonStats(playerStats);
    
    if (result.success) {
      console.log(`Successfully updated player season stats: ${result.message}`);
    } else {
      console.error(`Failed to update player season stats: ${result.error}`);
    }
  } catch (error) {
    console.error('Unexpected error running scraper:', error);
  }
}

// If invoked directly (node src/index.js), run the scraper immediately
if (require.main === module) {
  // Check if this is a test run
  const isTestRun = process.argv.includes('--test');
  const debugMode = process.argv.includes('--debug');
  
  if (debugMode) {
    console.log('Debug mode enabled - browser UI will be visible');
  }
  
  if (isTestRun) {
    console.log('Running in test mode - scraping a single category...');
    
    // Check if a specific category was requested
    let categoryParam = '';
    for (const arg of process.argv) {
      if (arg.startsWith('--category=')) {
        categoryParam = arg.split('=')[1];
        break;
      }
    }
    
    // Import and run test function
    import('./test-scraper').then(async ({ testScraper }) => {
      // Import StatsCategory for mapping
      const { StatsCategory } = await import('./types/stats');
      
      // Map the category string to enum if provided
      if (categoryParam && Object.values(StatsCategory).includes(categoryParam as any)) {
        console.log(`Testing with specific category: ${categoryParam}`);
        testScraper(debugMode, categoryParam as any).catch(console.error);
      } else {
        // Use default (SG_TOTAL)
        testScraper(debugMode).catch(console.error);
      }
    });
  } else {
    // Run the full scraper
    runScraper(debugMode).catch(console.error);
  }
} else {
  // Set up scheduled job to run weekly
  // Default: Monday at 3:00 AM (adjust as needed)
  const scheduleCron = process.env.SCRAPER_CRON || '0 3 * * 1';
  
  console.log(`Setting up scheduled job with cron pattern: ${scheduleCron}`);
  
  cron.schedule(scheduleCron, () => {
    console.log(`Running scheduled scraper job at ${new Date().toISOString()}`);
    runScraper().catch(console.error);
  });
  
  console.log('PGA Tour stats scraper scheduled. Waiting for next run time...');
}

// Export for potential programmatic usage
export { runScraper };
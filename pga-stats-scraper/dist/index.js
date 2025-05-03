"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runScraper = runScraper;
const scraper_1 = require("./scraper");
const supabase_1 = require("./utils/supabase");
const cron = __importStar(require("node-cron"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
/**
 * Run the scraper and store results in database
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 */
async function runScraper(debugMode = false) {
    console.log(`Starting PGA Tour stats scraper (debug mode: ${debugMode ? 'ON' : 'OFF'})...`);
    try {
        // Scrape stats from PGA Tour website
        const playerStats = await (0, scraper_1.scrapeAllStats)(debugMode);
        console.log(`Scraped stats for ${playerStats.length} players`);
        if (playerStats.length === 0) {
            console.error('No player stats found. Aborting database update.');
            return;
        }
        // Store stats in database
        const result = await (0, supabase_1.storePlayerSeasonStats)(playerStats);
        if (result.success) {
            console.log(`Successfully updated player season stats: ${result.message}`);
        }
        else {
            console.error(`Failed to update player season stats: ${result.error}`);
        }
    }
    catch (error) {
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
        Promise.resolve().then(() => __importStar(require('./test-scraper'))).then(async ({ testScraper }) => {
            // Import StatsCategory for mapping
            const { StatsCategory } = await Promise.resolve().then(() => __importStar(require('./types/stats')));
            // Map the category string to enum if provided
            if (categoryParam && Object.values(StatsCategory).includes(categoryParam)) {
                console.log(`Testing with specific category: ${categoryParam}`);
                testScraper(debugMode, categoryParam).catch(console.error);
            }
            else {
                // Use default (SG_TOTAL)
                testScraper(debugMode).catch(console.error);
            }
        });
    }
    else {
        // Run the full scraper
        runScraper(debugMode).catch(console.error);
    }
}
else {
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

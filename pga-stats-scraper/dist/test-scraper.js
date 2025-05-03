"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testScraper = testScraper;
const scraper_1 = require("./scraper");
const stats_1 = require("./types/stats");
/**
 * Test function to verify scraper functionality with a single category
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @param category Optional category to test, defaults to SG_TOTAL
 */
async function testScraper(debugMode = false, category = stats_1.StatsCategory.SG_TOTAL) {
    console.log(`Running test scraper for ${category} category (debug mode: ${debugMode ? 'ON' : 'OFF'})...`);
    try {
        console.log(`Trying to scrape ${category} data`);
        try {
            const players = await (0, scraper_1.scrapeStatsCategory)(category, debugMode);
            if (!players || players.length === 0) {
                console.error(`❌ Test failed: No players found for ${category}`);
                return;
            }
            console.log(`✅ Successfully scraped ${players.length} players`);
            // Print first 5 players as sample data
            console.log('\nSample data (first 5 players):');
            players.slice(0, 5).forEach((player, index) => {
                // Display the appropriate stat based on category
                let statDisplay = '';
                switch (category) {
                    case stats_1.StatsCategory.SG_TOTAL:
                        statDisplay = `SG Total = ${player.sgTotal}`;
                        break;
                    case stats_1.StatsCategory.SG_OTT:
                        statDisplay = `SG Off-the-Tee = ${player.sgOtt}`;
                        break;
                    case stats_1.StatsCategory.SG_APP:
                        statDisplay = `SG Approach = ${player.sgApp}`;
                        break;
                    case stats_1.StatsCategory.SG_ARG:
                        statDisplay = `SG Around-the-Green = ${player.sgArg}`;
                        break;
                    case stats_1.StatsCategory.SG_PUTT:
                        statDisplay = `SG Putting = ${player.sgPutt}`;
                        break;
                    case stats_1.StatsCategory.DRIVING_ACCURACY:
                        statDisplay = `Driving Accuracy = ${player.drivingAccuracy}`;
                        break;
                    case stats_1.StatsCategory.DRIVING_DISTANCE:
                        statDisplay = `Driving Distance = ${player.drivingDistance}`;
                        break;
                    default:
                        statDisplay = `Stats for ${category}`;
                }
                console.log(`${index + 1}. ${player.playerName}: ${statDisplay} (ID: ${player.playerId})`);
            });
            console.log('\nTest completed successfully');
        }
        catch (error) {
            console.error(`Failed to scrape ${category}: ${error}`);
            // Fallback to DRIVING_DISTANCE as an alternative
            console.log(`Trying DRIVING_DISTANCE as fallback...`);
            try {
                const fallbackPlayers = await (0, scraper_1.scrapeStatsCategory)(stats_1.StatsCategory.DRIVING_DISTANCE, debugMode);
                if (!fallbackPlayers || fallbackPlayers.length === 0) {
                    console.error('❌ Test failed: No players found for fallback category');
                    return;
                }
                console.log(`✅ Successfully scraped ${fallbackPlayers.length} players with fallback`);
                // Print first 5 players as sample data
                console.log('\nSample data (first 5 players):');
                fallbackPlayers.slice(0, 5).forEach((player, index) => {
                    console.log(`${index + 1}. ${player.playerName}: Driving Distance = ${player.drivingDistance} (ID: ${player.playerId})`);
                });
                console.log('\nTest completed successfully with fallback category');
            }
            catch (fallbackError) {
                console.error('❌ Test failed with all categories:', fallbackError);
            }
        }
    }
    catch (error) {
        console.error('❌ Test failed with error:', error);
    }
}

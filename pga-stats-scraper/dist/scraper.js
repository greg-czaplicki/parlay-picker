"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeStatsCategory = scrapeStatsCategory;
exports.scrapeAllStats = scrapeAllStats;
exports.scrapeCourseInfo = scrapeCourseInfo;
exports.scrapeMultipleCourses = scrapeMultipleCourses;
const playwright_1 = require("playwright");
const stats_1 = require("./types/stats");
/**
 * Scrapes PGA Tour stats for a specific category
 * @param category Stats category to scrape
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @returns Array of player data with stats for that category
 */
async function scrapeStatsCategory(category, debugMode = false) {
    console.log(`Starting to scrape ${category} from ${stats_1.statsCategoryUrls[category]}`);
    const browser = await playwright_1.chromium.launch({
        headless: !debugMode, // Run headful mode when debugging
        slowMo: debugMode ? 1000 : 0, // Slow down operations for debugging
        args: [
            // Bypass common bot detection techniques
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
            '--no-sandbox',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
        ]
    });
    try {
        // Set up browser context with more browser-like properties
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            hasTouch: false
        });
        // Add script to remove webdriver flag that can trigger bot detection
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        const page = await context.newPage();
        // Try primary URL first
        console.log(`Navigating to primary URL: ${stats_1.statsCategoryUrls[category]}`);
        let pageLoaded = false;
        try {
            // Add additional page behaviors
            await page.addInitScript(() => {
                // Add some randomization to mouse movements and scrolling
                const originalMouseMove = MouseEvent.prototype.movementX;
                Object.defineProperty(MouseEvent.prototype, 'movementX', {
                    get: function () { return Math.floor(Math.random() * 10) - 5; }
                });
                Object.defineProperty(MouseEvent.prototype, 'movementY', {
                    get: function () { return Math.floor(Math.random() * 10) - 5; }
                });
            });
            console.log(`Navigating to ${stats_1.statsCategoryUrls[category]}...`);
            // Navigate to the stats page with less strict wait condition
            await page.goto(stats_1.statsCategoryUrls[category], { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Simulate more natural page interaction - scroll down a bit to trigger lazy loading
            await page.evaluate(() => window.scrollBy(0, 300));
            // Wait for a bit to let the page settle
            await page.waitForTimeout(2000);
            // Try again with a little more scrolling
            await page.evaluate(() => window.scrollBy(0, 500));
            // Take a screenshot for debugging if needed
            if (debugMode) {
                await page.screenshot({ path: `debug-${category}-primary.png` });
                console.log(`Screenshot saved to debug-${category}-primary.png`);
            }
            pageLoaded = true;
            console.log(`Successfully loaded primary URL for ${category}`);
        }
        catch (error) {
            console.log(`Failed to load primary URL for ${category}: ${error}`);
        }
        // If primary URL fails, try backup URL
        if (!pageLoaded) {
            try {
                console.log(`Trying backup URL: ${stats_1.backupStatsCategoryUrls[category]}`);
                console.log(`Navigating to ${stats_1.backupStatsCategoryUrls[category]}...`);
                // Navigate with less strict wait condition
                await page.goto(stats_1.backupStatsCategoryUrls[category], { waitUntil: 'domcontentloaded', timeout: 60000 });
                // Simulate more natural page interaction - scroll down a bit to trigger lazy loading
                await page.evaluate(() => window.scrollBy(0, 300));
                // Wait for a bit to let the page settle
                await page.waitForTimeout(2000);
                // Try again with a little more scrolling
                await page.evaluate(() => window.scrollBy(0, 500));
                // Take a screenshot for debugging if needed
                if (debugMode) {
                    await page.screenshot({ path: `debug-${category}-backup.png` });
                    console.log(`Screenshot saved to debug-${category}-backup.png`);
                }
                pageLoaded = true;
                console.log(`Successfully loaded backup URL for ${category}`);
            }
            catch (backupError) {
                console.log(`Failed to load backup URL for ${category}: ${backupError}`);
                throw new Error(`Could not load any URL for ${category}`);
            }
        }
        // Try to identify tables in the document
        if (debugMode) {
            console.log('Analyzing page structure...');
            const numTables = await page.evaluate(() => document.querySelectorAll('table').length);
            console.log(`Found ${numTables} tables on the page`);
            // Look for any tables with player data
            const hasPlayerLinks = await page.evaluate(() => {
                const playerLinks = document.querySelectorAll('a[href*="/players/"]');
                return playerLinks.length;
            });
            console.log(`Found ${hasPlayerLinks} player links on the page`);
        }
        // Look for the "All Players" section - but don't wait for it specifically
        const hasAllPlayers = await page.evaluate(() => {
            const paragraphs = document.querySelectorAll('p');
            let found = false;
            paragraphs.forEach((p) => {
                if (p.textContent && p.textContent.includes('All Players')) {
                    found = true;
                }
            });
            return found;
        });
        if (hasAllPlayers) {
            console.log(`Found "All Players" section on the page`);
        }
        else {
            console.log(`Could not find "All Players" section, will try to locate table another way`);
        }
        // Get current season information
        let seasonText = 'Current Season';
        try {
            seasonText = await page.evaluate(() => {
                const heading = document.querySelector('h1');
                if (heading)
                    return heading.textContent || 'Current Season';
                // Try to find season information in other elements
                const seasonElements = document.querySelectorAll('.season-selector, [data-season]');
                if (seasonElements.length > 0) {
                    return seasonElements[0].textContent || 'Current Season';
                }
                return 'Current Season';
            });
        }
        catch (e) {
            console.log('Error getting season text:', e);
        }
        const lastUpdated = new Date().toISOString();
        console.log(`Scraping ${category} data for ${seasonText}`);
        // First try to get HTML content to debug
        if (debugMode) {
            const htmlContent = await page.content();
            // Write first 5000 chars of HTML to file for debugging
            require('fs').writeFileSync(`debug-${category}-html.txt`, htmlContent.substring(0, 10000));
            console.log(`Saved first 10000 chars of HTML to debug-${category}-html.txt`);
        }
        // Extract player stats from the table - with special handling for PGA Tour site
        const players = await page.evaluate((params) => {
            const { statsCategory, lastUpdated } = params;
            console.log("Starting page evaluation...");
            const players = []; // Use any[] initially, will be cast to PlayerStats[] later
            function logDebug(message) {
                console.log(`[Browser Debug] ${message}`);
            }
            // Define generatePlayerIdFromName in the browser context
            function generatePlayerIdFromName(name) {
                if (!name)
                    return '';
                // Remove non-alphanumeric characters and convert to lowercase
                const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                // Remove consecutive underscores
                const normalized = cleaned.replace(/_+/g, '_');
                // Trim underscores from start and end
                return normalized.replace(/^_|_$/g, '');
            }
            // First look for stats tables specific to PGA Tour format
            logDebug("Looking for PGA Tour stats tables...");
            // Try different selectors for the stats table
            const statSelectors = [
                // Selector for stats tables on the PGA Tour site
                '.table-styled',
                // For stat detail pages
                '.table-content table',
                // General tables
                'table.stats-table',
                // PGA Tour tables
                '.golf-table',
                // Generic table selector
                'table'
            ];
            let table = null;
            // Try each selector until we find a table
            for (const selector of statSelectors) {
                logDebug(`Trying selector: ${selector}`);
                const possibleTables = document.querySelectorAll(selector);
                logDebug(`Found ${possibleTables.length} tables with selector ${selector}`);
                if (possibleTables.length > 0) {
                    // Find the first table that looks like it has player data
                    Array.from(possibleTables).forEach((t) => {
                        if (!table) {
                            // Check if it's a stats table (has header row with "PLAYER" or "NAME")
                            const headerText = t.textContent || '';
                            if (headerText.includes('PLAYER') ||
                                headerText.includes('NAME') ||
                                headerText.toUpperCase().includes('RANK')) {
                                table = t;
                                logDebug(`Found stats table with heading: ${headerText.substring(0, 50)}...`);
                            }
                        }
                    });
                }
                if (table)
                    break;
            }
            // Special case: Find table after "All Players" text
            if (!table) {
                logDebug("Looking for table after 'All Players' text");
                let allPlayersElement = null;
                const allPlayersTexts = [
                    'All Players',
                    'All players',
                    'TOTAL STATISTICS',
                    'TOTAL STATS'
                ];
                // Try to find elements with text mentioning players
                document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span').forEach((element) => {
                    if (!allPlayersElement && element.textContent) {
                        for (const text of allPlayersTexts) {
                            if (element.textContent.includes(text)) {
                                allPlayersElement = element;
                                logDebug(`Found element with text: ${text}`);
                                break;
                            }
                        }
                    }
                });
                if (allPlayersElement) {
                    logDebug("Found 'All Players' element, now looking for the next table");
                    // Find all tables on the page
                    const allTables = document.querySelectorAll('table');
                    logDebug(`Found ${allTables.length} tables on the page`);
                    // Look for the first table that appears after the "All Players" element in the DOM
                    let targetTable = null;
                    // First attempt: direct sibling approach
                    let nextElement = allPlayersElement.nextElementSibling;
                    let count = 0;
                    const MAX_ELEMENTS = 10; // Don't go too far
                    // Try to find a table among siblings
                    while (nextElement && nextElement.tagName !== 'TABLE' && count < MAX_ELEMENTS) {
                        // Also check if the element contains a table
                        if (nextElement.querySelector('table')) {
                            targetTable = nextElement.querySelector('table');
                            logDebug(`Found table inside element ${count} elements after "All Players"`);
                            break;
                        }
                        nextElement = nextElement.nextElementSibling;
                        count++;
                    }
                    if (nextElement && nextElement.tagName === 'TABLE') {
                        targetTable = nextElement;
                        logDebug(`Found table ${count} elements after "All Players"`);
                    }
                    // Second attempt: if no table found, find tables that appear later in DOM
                    if (!targetTable) {
                        logDebug("No table found as direct sibling, trying DOM position comparison");
                        // Get the position of the "All Players" element in the DOM
                        const allNodes = Array.from(document.querySelectorAll('*'));
                        const allPlayersIndex = allNodes.indexOf(allPlayersElement);
                        if (allPlayersIndex !== -1) {
                            // Find the first table that comes after the "All Players" element
                            Array.from(allTables).forEach((tbl) => {
                                const tableIndex = allNodes.indexOf(tbl);
                                if (tableIndex > allPlayersIndex && !targetTable) {
                                    targetTable = tbl;
                                    logDebug(`Found table after "All Players" element using DOM position comparison`);
                                }
                            });
                        }
                    }
                    // Use the found table
                    if (targetTable) {
                        table = targetTable;
                        logDebug(`Using table found after "All Players" element`);
                    }
                }
            }
            if (!table) {
                console.error("Could not find stats table on the page");
                return players;
            }
            logDebug(`Found table: ${table.outerHTML.substring(0, 200)}...`);
            // Try to determine what type of table this is
            const tableText = table.textContent || '';
            // Get all header cells to understand column structure
            const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
            const headers = [];
            headerCells.forEach((cell) => {
                headers.push((cell.textContent || '').trim());
            });
            logDebug(`Table headers: ${headers.join(', ')}`);
            // Examine table structure in detail
            logDebug(`Table HTML structure: ${table.outerHTML.substring(0, 500)}...`);
            // DYNAMIC HEADER ANALYSIS: Determine column indexes for player names and values
            let nameColumnIndex = -1;
            let valueColumnIndex = -1;
            let rankColumnIndex = -1;
            // Common header names for player name column
            const nameHeaderPatterns = [
                'PLAYER', 'NAME', 'GOLFER', 'PLAYERS', 'TOURNAMENT PLAYERS'
            ];
            // Common header names for stat value column - based on the current category
            const valueHeaderPatterns = [
                'SG', 'STROKES GAINED', 'AVG', 'AVERAGE', 'TOTAL', 'VALUE', 'STAT'
            ];
            // Add category-specific patterns based on the stats category
            switch (statsCategory) {
                case 'SG_TOTAL':
                    valueHeaderPatterns.push('TOTAL', 'SG:TOTAL', 'SG: TOT', 'SG TOT');
                    break;
                case 'SG_OTT':
                    valueHeaderPatterns.push('OTT', 'SG:OTT', 'SG: OTT', 'SG OTT', 'OFF-THE-TEE', 'OFF THE TEE');
                    break;
                case 'SG_APP':
                    valueHeaderPatterns.push('APP', 'SG:APP', 'SG: APP', 'SG APP', 'APPROACH', 'APPROACH-THE-GREEN', 'APPROACH THE GREEN');
                    break;
                case 'SG_ARG':
                    valueHeaderPatterns.push('ARG', 'SG:ARG', 'SG: ARG', 'SG ARG', 'AROUND', 'AROUND-THE-GREEN', 'AROUND THE GREEN');
                    break;
                case 'SG_PUTT':
                    valueHeaderPatterns.push('PUTT', 'SG:PUTT', 'SG: PUTT', 'SG PUTT', 'PUTTING');
                    break;
                case 'DRIVING_ACCURACY':
                    valueHeaderPatterns.push('ACCURACY', 'DRIVING ACC', 'FAIRWAY', 'FAIRWAYS HIT', 'ACC', 'PERCENTAGE', '%', 'PCT', 'DRIVING ACCURACY PERCENTAGE', 'FAIRWAY PCT');
                    break;
                case 'DRIVING_DISTANCE':
                    valueHeaderPatterns.push('DISTANCE', 'DRIVING DIST', 'DRIVE DIST', 'DIST', 'YARDS');
                    break;
            }
            // Common header names for rank column
            const rankHeaderPatterns = [
                'RANK', 'POS', 'POSITION', '#'
            ];
            // Try to identify columns by header
            headers.forEach((header, index) => {
                const headerUpper = header.toUpperCase();
                // Check for player name column
                if (nameColumnIndex === -1) {
                    const isNameColumn = nameHeaderPatterns.some(pattern => headerUpper.includes(pattern));
                    if (isNameColumn) {
                        nameColumnIndex = index;
                        logDebug(`Found player name column at index ${index} with header "${header}"`);
                    }
                }
                // Check for value column - especially considering the stats category
                if (valueColumnIndex === -1) {
                    const isValueColumn = valueHeaderPatterns.some(pattern => headerUpper.includes(pattern));
                    if (isValueColumn) {
                        valueColumnIndex = index;
                        logDebug(`Found ${statsCategory} value column at index ${index} with header "${header}"`);
                    }
                }
                // Check for rank column
                if (rankColumnIndex === -1) {
                    const isRankColumn = rankHeaderPatterns.some(pattern => headerUpper.includes(pattern));
                    if (isRankColumn) {
                        rankColumnIndex = index;
                        logDebug(`Found rank column at index ${index} with header "${header}"`);
                    }
                }
            });
            // If we couldn't find columns by header, make smart assumptions based on column positions
            if (nameColumnIndex === -1 || valueColumnIndex === -1) {
                logDebug("Could not identify columns by header, using positional heuristics");
                // Analyze first data row to see if it contains a player name and number pattern
                // This handles tables where headers might be missing or unclear
                const firstDataRow = table.querySelector('tr:nth-child(2)');
                if (firstDataRow) {
                    const dataCells = firstDataRow.querySelectorAll('td');
                    // Check if we have enough cells
                    if (dataCells.length >= 4) {
                        // Look for cells that match patterns for each column type
                        Array.from(dataCells).forEach((cell, idx) => {
                            const cellText = cell.textContent?.trim() || '';
                            // Player name patterns: typically contains spaces and no numbers
                            if (nameColumnIndex === -1 &&
                                cellText.includes(' ') &&
                                !/^\d+$/.test(cellText) &&
                                cellText !== '-') {
                                nameColumnIndex = idx;
                                logDebug(`Inferred player name column at index ${idx} with sample "${cellText}"`);
                            }
                            // Value patterns: typically a number with decimal
                            if (valueColumnIndex === -1 &&
                                /^-?\d+(\.\d+)?$/.test(cellText)) {
                                valueColumnIndex = idx;
                                logDebug(`Inferred value column at index ${idx} with sample "${cellText}"`);
                            }
                            // Rank patterns: typically just a number
                            if (rankColumnIndex === -1 &&
                                /^\d+$/.test(cellText)) {
                                rankColumnIndex = idx;
                                logDebug(`Inferred rank column at index ${idx} with sample "${cellText}"`);
                            }
                        });
                    }
                }
            }
            // If we still couldn't find the columns, fall back to default positions
            if (nameColumnIndex === -1) {
                nameColumnIndex = 2; // Default: name is consistently in 3rd column (index 2)
                logDebug(`Falling back to default name column index: ${nameColumnIndex}`);
            }
            if (valueColumnIndex === -1) {
                valueColumnIndex = 3; // Default: value is in 4th column (index 3)
                logDebug(`Falling back to default value column index: ${valueColumnIndex}`);
            }
            // Process all rows in the table
            const rows = table.querySelectorAll('tr');
            logDebug(`Found ${rows.length} total rows in the table`);
            // Process each row that has player data (skip header rows)
            Array.from(rows).forEach((row, rowIndex) => {
                // Skip the first row which is likely the header
                if (rowIndex === 0) {
                    logDebug("Skipping header row");
                    return;
                }
                // Get all cells in the row
                const cells = row.querySelectorAll('td');
                if (cells.length < Math.max(nameColumnIndex, valueColumnIndex) + 1) {
                    logDebug(`Row ${rowIndex} has insufficient cells (${cells.length}), skipping`);
                    return;
                }
                // Log a sample of the row for debugging
                if (rowIndex < 3) {
                    logDebug(`Sample row ${rowIndex}: ${row.outerHTML.substring(0, 200)}...`);
                }
                // Extract player name and SG value using the dynamically determined columns
                let playerName = '';
                let statValue = null;
                // Add detailed cell debugging for the first few rows
                if (rowIndex < 3) {
                    for (let i = 0; i < cells.length; i++) {
                        logDebug(`  Row ${rowIndex}, Cell ${i}: "${cells[i]?.textContent?.trim()}"`);
                    }
                }
                // Use the dynamically determined column indexes
                let nameCell = cells[nameColumnIndex];
                let statCell = cells[valueColumnIndex];
                // For debugging the specific cells we're trying to extract
                if (rowIndex < 3) {
                    logDebug(`Trying to extract from nameCell(${nameColumnIndex}): "${nameCell?.textContent?.trim()}" and statCell(${valueColumnIndex}): "${statCell?.textContent?.trim()}"`);
                }
                if (!nameCell || !statCell) {
                    logDebug(`Row ${rowIndex} missing name or stat cell, skipping`);
                    return;
                }
                playerName = nameCell.textContent?.trim() || '';
                // Skip rows with no player name or that show special labels like "Measured Rounds" or "Tour Average"
                if (!playerName ||
                    playerName === 'Measured Rounds' ||
                    playerName === '-' ||
                    playerName === 'Tour Average' ||
                    playerName.includes('Average')) {
                    logDebug(`Row ${rowIndex} has no valid player name or is an average/special row (${playerName}), skipping`);
                    return;
                }
                // Extract the SG value
                const statText = statCell.textContent?.trim() || '';
                // Check if the stat value is a valid number
                if (statText && !isNaN(parseFloat(statText))) {
                    statValue = parseFloat(statText);
                }
                else {
                    // For some tables, we might need to look at a different cell if the value isn't in the expected format
                    // Try to find a cell with a valid number format
                    let foundValidStat = false;
                    // Check a few cells after the name cell for valid number formats
                    for (let i = valueColumnIndex + 1; i < Math.min(valueColumnIndex + 3, cells.length); i++) {
                        const altStatText = cells[i]?.textContent?.trim() || '';
                        if (altStatText && !isNaN(parseFloat(altStatText))) {
                            statValue = parseFloat(altStatText);
                            logDebug(`Found alternative stat value at column ${i}: ${statValue}`);
                            foundValidStat = true;
                            break;
                        }
                    }
                    if (!foundValidStat) {
                        logDebug(`Row ${rowIndex} has no valid stat value in expected columns, skipping`);
                        return;
                    }
                }
                logDebug(`Found player: ${playerName} with ${statsCategory} value: ${statValue} (from columns: name=${nameColumnIndex}, value=${valueColumnIndex})`);
                // Create player object
                const player = {
                    playerId: generatePlayerIdFromName(playerName),
                    playerName,
                    country: '',
                    sgTotal: null,
                    sgOtt: null,
                    sgApp: null,
                    sgArg: null,
                    sgPutt: null,
                    drivingAccuracy: null,
                    drivingDistance: null,
                    lastUpdated
                };
                // Set the appropriate stat based on category
                switch (statsCategory) {
                    case 'SG_TOTAL':
                        player.sgTotal = statValue;
                        break;
                    case 'SG_OTT':
                        player.sgOtt = statValue;
                        break;
                    case 'SG_APP':
                        player.sgApp = statValue;
                        break;
                    case 'SG_ARG':
                        player.sgArg = statValue;
                        break;
                    case 'SG_PUTT':
                        player.sgPutt = statValue;
                        break;
                    case 'DRIVING_ACCURACY':
                        // PGA Tour driving accuracy should be a percentage (e.g., 64.52%, 73.43%)
                        logDebug(`Processing DRIVING_ACCURACY for ${playerName}: raw value = "${statValue}" (type: ${typeof statValue})`);
                        if (typeof statValue === 'string' && statValue.includes('%')) {
                            // For percentage format (e.g., "73.43%"), remove % and convert to decimal
                            const percentageValue = parseFloat(statValue.replace('%', ''));
                            player.drivingAccuracy = percentageValue / 100; // Convert to decimal (0.7343)
                            logDebug(`Converted percentage string "${statValue}" to decimal: ${player.drivingAccuracy}`);
                        }
                        else if (typeof statValue === 'number') {
                            if (statValue > 1.0 && statValue <= 100) {
                                // If it's a number between 1-100, treat as percentage and convert to decimal
                                player.drivingAccuracy = statValue / 100;
                                logDebug(`Converted percentage number ${statValue} to decimal: ${player.drivingAccuracy}`);
                            }
                            else if (statValue > 0 && statValue <= 1.0) {
                                // If it's already a decimal between 0-1, use as is
                                player.drivingAccuracy = statValue;
                                logDebug(`Using decimal value as-is: ${player.drivingAccuracy}`);
                            }
                            else {
                                // Unexpected value - might be wrong column
                                logDebug(`Unexpected driving accuracy value: ${statValue} - might be wrong column`);
                                player.drivingAccuracy = null;
                            }
                        }
                        else {
                            logDebug(`Could not parse driving accuracy value: ${statValue}`);
                            player.drivingAccuracy = null;
                        }
                        break;
                    case 'DRIVING_DISTANCE':
                        player.drivingDistance = statValue;
                        break;
                }
                players.push(player);
            });
            return players;
        }, { statsCategory: category, lastUpdated });
        console.log(`Scraped ${players.length} players for ${category}`);
        return players;
    }
    catch (error) {
        console.error(`Error scraping ${category}:`, error);
        return [];
    }
    finally {
        await browser.close();
    }
}
/**
 * Scrapes all stats categories and combines the data
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @returns Combined player stats across all categories
 */
async function scrapeAllStats(debugMode = false) {
    try {
        // When debugging, run sequentially to see each page
        if (debugMode) {
            console.log("Running in debug mode - processing sequentially");
            const results = [];
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.SG_TOTAL, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.SG_OTT, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.SG_APP, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.SG_ARG, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.SG_PUTT, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.DRIVING_ACCURACY, debugMode));
            results.push(await scrapeStatsCategory(stats_1.StatsCategory.DRIVING_DISTANCE, debugMode));
            return results.flat();
        }
        // Normal mode - run in parallel
        const allCategoryResults = await Promise.all([
            scrapeStatsCategory(stats_1.StatsCategory.SG_TOTAL, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.SG_OTT, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.SG_APP, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.SG_ARG, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.SG_PUTT, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.DRIVING_ACCURACY, debugMode),
            scrapeStatsCategory(stats_1.StatsCategory.DRIVING_DISTANCE, debugMode)
        ]);
        // Create map of player data using player ID as key
        const playerMap = new Map();
        // Process each category's results
        allCategoryResults.forEach((categoryPlayers, index) => {
            const category = Object.values(stats_1.StatsCategory)[index];
            categoryPlayers.forEach(player => {
                if (!player.playerId)
                    return; // Skip players without ID
                // If player already exists in map, merge the stats
                if (playerMap.has(player.playerId)) {
                    const existingPlayer = playerMap.get(player.playerId);
                    // Merge stats based on category
                    switch (category) {
                        case stats_1.StatsCategory.SG_TOTAL:
                            existingPlayer.sgTotal = player.sgTotal;
                            break;
                        case stats_1.StatsCategory.SG_OTT:
                            existingPlayer.sgOtt = player.sgOtt;
                            break;
                        case stats_1.StatsCategory.SG_APP:
                            existingPlayer.sgApp = player.sgApp;
                            break;
                        case stats_1.StatsCategory.SG_ARG:
                            existingPlayer.sgArg = player.sgArg;
                            break;
                        case stats_1.StatsCategory.SG_PUTT:
                            existingPlayer.sgPutt = player.sgPutt;
                            break;
                        case stats_1.StatsCategory.DRIVING_ACCURACY:
                            existingPlayer.drivingAccuracy = player.drivingAccuracy;
                            break;
                        case stats_1.StatsCategory.DRIVING_DISTANCE:
                            existingPlayer.drivingDistance = player.drivingDistance;
                            break;
                    }
                }
                else {
                    // Add new player to map
                    playerMap.set(player.playerId, player);
                }
            });
        });
        // Convert map values to array
        return Array.from(playerMap.values());
    }
    catch (error) {
        console.error('Error scraping all stats:', error);
        return [];
    }
}
/**
 * Scrapes course information from PGA Tour tournament pages
 * @param tournamentUrl URL to tournament page (e.g., https://www.pgatour.com/tournaments/2025/the-open-championship/R2025100/course-stats)
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @returns Course information extracted from the tournament page
 */
async function scrapeCourseInfo(tournamentUrl, debugMode = false) {
    console.log(`Starting to scrape course info from ${tournamentUrl}`);
    const browser = await playwright_1.chromium.launch({
        headless: !debugMode,
        slowMo: debugMode ? 1000 : 0,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
            '--no-sandbox',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
        ]
    });
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
            hasTouch: false
        });
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        const page = await context.newPage();
        console.log(`Navigating to ${tournamentUrl}...`);
        await page.goto(tournamentUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Wait for page to load and scroll to trigger any lazy loading
        await page.waitForTimeout(2000);
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(1000);
        if (debugMode) {
            await page.screenshot({ path: 'debug-course-info.png' });
            console.log('Screenshot saved to debug-course-info.png');
        }
        // Extract course information from the page
        const courseInfo = await page.evaluate(() => {
            console.log('[Browser] Starting course info extraction...');
            // Helper functions
            function getTextContent(selector) {
                const element = document.querySelector(selector);
                return element?.textContent?.trim() || null;
            }
            function getTextContentFromMultipleSelectors(selectors) {
                for (const selector of selectors) {
                    const text = getTextContent(selector);
                    if (text)
                        return text;
                }
                return null;
            }
            function extractNumberFromText(text) {
                if (!text)
                    return null;
                const match = text.match(/[\d,]+/);
                return match ? parseInt(match[0].replace(/,/g, ''), 10) : null;
            }
            // Extract course name - look for the specific course name pattern
            let courseName = null;
            // First try to get course name from the tournament data structure
            const bodyText = document.body.textContent || '';
            // Look for course name in JSON data structure (most reliable)
            const courseNameJSONMatch = bodyText.match(/"courseName":"([^"]+)"/);
            if (courseNameJSONMatch) {
                courseName = courseNameJSONMatch[1];
            }
            // If not found in JSON, try alternative methods
            if (!courseName) {
                // Try course name patterns that exclude tournament and status text
                const courseNamePatterns = [
                    /Royal\s+Portrush\s+Golf\s+Club/g,
                    /([A-Z][a-zA-Z\s]+Golf\s+Club)(?!\s*(In\s+Progress|The\s+Open))/g,
                    /([A-Z][a-zA-Z\s]+Country\s+Club)(?!\s*(In\s+Progress|The\s+Open))/g,
                    /([A-Z][a-zA-Z\s]+Golf\s+Course)(?!\s*(In\s+Progress|The\s+Open))/g,
                    /(Royal\s+[A-Z][a-zA-Z\s]+)(?!\s*(In\s+Progress|The\s+Open))/g
                ];
                for (const pattern of courseNamePatterns) {
                    const matches = bodyText.match(pattern);
                    if (matches && matches.length > 0) {
                        courseName = matches[0].trim();
                        break;
                    }
                }
            }
            // Clean up the course name if it contains unwanted text
            if (courseName) {
                courseName = courseName
                    .replace(/^In\s+Progress\s*/i, '')
                    .replace(/^The\s+Open\s+Championship\s*/i, '')
                    .replace(/^.*Tournament\s*/i, '')
                    .trim();
            }
            // Extract location - based on the format "PORTRUSH • NIR"
            let location = null;
            let country = 'United States'; // Default
            // First try to get location from tournament data structure
            const tournamentLocationMatch = bodyText.match(/"tournamentLocation":"([^"]+)"/);
            const tournamentCountryMatch = bodyText.match(/"country":"([^"]+)"/);
            const cityMatch = bodyText.match(/"city":"([^"]+)"/);
            if (tournamentLocationMatch) {
                location = tournamentLocationMatch[1];
            }
            else if (cityMatch) {
                location = cityMatch[1];
            }
            // Map country codes to full names
            const countryMap = {
                'USA': 'United States',
                'US': 'United States',
                'UK': 'United Kingdom',
                'GB': 'United Kingdom',
                'NIR': 'Northern Ireland',
                'SCO': 'Scotland',
                'ENG': 'England',
                'WAL': 'Wales',
                'IRE': 'Ireland',
                'CAN': 'Canada',
                'AUS': 'Australia',
                'RSA': 'South Africa',
                'JPN': 'Japan',
                'KOR': 'South Korea',
                'MEX': 'Mexico',
                'GER': 'Germany',
                'FRA': 'France',
                'ESP': 'Spain',
                'ITA': 'Italy',
                'NED': 'Netherlands',
                'BEL': 'Belgium',
                'SWE': 'Sweden',
                'DEN': 'Denmark',
                'NOR': 'Norway',
                'SUI': 'Switzerland',
                'AUT': 'Austria',
                'POR': 'Portugal',
                'CZE': 'Czech Republic',
                'POL': 'Poland',
                'HUN': 'Hungary',
                'CRO': 'Croatia',
                'SVK': 'Slovakia',
                'SVN': 'Slovenia',
                'BGR': 'Bulgaria',
                'ROU': 'Romania',
                'GRC': 'Greece',
                'TUR': 'Turkey',
                'CHN': 'China',
                'IND': 'India',
                'THA': 'Thailand',
                'MYS': 'Malaysia',
                'SGP': 'Singapore',
                'IDN': 'Indonesia',
                'PHL': 'Philippines',
                'VNM': 'Vietnam',
                'NZL': 'New Zealand',
                'FJI': 'Fiji',
                'BRA': 'Brazil',
                'ARG': 'Argentina',
                'CHL': 'Chile',
                'COL': 'Colombia',
                'PER': 'Peru',
                'URY': 'Uruguay',
                'VEN': 'Venezuela',
                'ECU': 'Ecuador',
                'BOL': 'Bolivia',
                'PRY': 'Paraguay',
                'PAN': 'Panama',
                'CRI': 'Costa Rica',
                'GTM': 'Guatemala',
                'HND': 'Honduras',
                'NIC': 'Nicaragua',
                'SLV': 'El Salvador',
                'BLZ': 'Belize',
                'JAM': 'Jamaica',
                'TTO': 'Trinidad and Tobago',
                'BHS': 'Bahamas',
                'BRB': 'Barbados',
                'DOM': 'Dominican Republic',
                'PRI': 'Puerto Rico',
                'CUB': 'Cuba',
                'HTI': 'Haiti',
                'GUY': 'Guyana',
                'SUR': 'Suriname',
                'GUF': 'French Guiana',
                'MAR': 'Morocco',
                'TUN': 'Tunisia',
                'DZA': 'Algeria',
                'EGY': 'Egypt',
                'LBY': 'Libya',
                'KEN': 'Kenya',
                'TZA': 'Tanzania',
                'UGA': 'Uganda',
                'RWA': 'Rwanda',
                'BDI': 'Burundi',
                'ETH': 'Ethiopia',
                'SOM': 'Somalia',
                'DJI': 'Djibouti',
                'ERI': 'Eritrea',
                'SDN': 'Sudan',
                'SSD': 'South Sudan',
                'TCD': 'Chad',
                'CAF': 'Central African Republic',
                'CMR': 'Cameroon',
                'GNQ': 'Equatorial Guinea',
                'GAB': 'Gabon',
                'COG': 'Republic of the Congo',
                'COD': 'Democratic Republic of the Congo',
                'AGO': 'Angola',
                'ZMB': 'Zambia',
                'ZWE': 'Zimbabwe',
                'BWA': 'Botswana',
                'NAM': 'Namibia',
                'SWZ': 'Eswatini',
                'LSO': 'Lesotho',
                'MDG': 'Madagascar',
                'MUS': 'Mauritius',
                'SYC': 'Seychelles',
                'COM': 'Comoros',
                'MYT': 'Mayotte',
                'REU': 'Réunion',
                'ARE': 'United Arab Emirates',
                'SAU': 'Saudi Arabia',
                'QAT': 'Qatar',
                'KWT': 'Kuwait',
                'BHR': 'Bahrain',
                'OMN': 'Oman',
                'YEM': 'Yemen',
                'JOR': 'Jordan',
                'LBN': 'Lebanon',
                'SYR': 'Syria',
                'IRQ': 'Iraq',
                'IRN': 'Iran',
                'AFG': 'Afghanistan',
                'PAK': 'Pakistan',
                'BGD': 'Bangladesh',
                'LKA': 'Sri Lanka',
                'MDV': 'Maldives',
                'BTN': 'Bhutan',
                'NPL': 'Nepal',
                'MMR': 'Myanmar',
                'LAO': 'Laos',
                'KHM': 'Cambodia',
                'MNG': 'Mongolia',
                'PRK': 'North Korea',
                'TWN': 'Taiwan',
                'HKG': 'Hong Kong',
                'MAC': 'Macao',
                'UZB': 'Uzbekistan',
                'KAZ': 'Kazakhstan',
                'KGZ': 'Kyrgyzstan',
                'TJK': 'Tajikistan',
                'TKM': 'Turkmenistan',
                'GEO': 'Georgia',
                'ARM': 'Armenia',
                'AZE': 'Azerbaijan',
                'RUS': 'Russia',
                'BLR': 'Belarus',
                'UKR': 'Ukraine',
                'MDA': 'Moldova',
                'LTU': 'Lithuania',
                'LVA': 'Latvia',
                'EST': 'Estonia',
                'FIN': 'Finland',
                'ISL': 'Iceland',
                'IRL': 'Ireland',
                'MLT': 'Malta',
                'CYP': 'Cyprus',
                'MKD': 'North Macedonia',
                'ALB': 'Albania',
                'MNE': 'Montenegro',
                'BIH': 'Bosnia and Herzegovina',
                'SRB': 'Serbia',
                'XKX': 'Kosovo',
                'LIE': 'Liechtenstein',
                'MCO': 'Monaco',
                'SMR': 'San Marino',
                'VAT': 'Vatican City',
                'AND': 'Andorra',
                'GIB': 'Gibraltar',
                'IMN': 'Isle of Man',
                'JEY': 'Jersey',
                'GGY': 'Guernsey',
                'FRO': 'Faroe Islands',
                'GRL': 'Greenland',
                'SJM': 'Svalbard and Jan Mayen',
                'ALA': 'Åland Islands'
            };
            if (tournamentCountryMatch) {
                const countryCode = tournamentCountryMatch[1];
                country = countryMap[countryCode] || countryCode;
            }
            // If location extraction failed, try fallback patterns
            if (!location) {
                // Pattern for "CITY • COUNTRY_CODE"
                const locationPattern = /([A-Z][A-Z\s]+)\s*•\s*([A-Z]{2,3})/g;
                const locationMatch = bodyText.match(locationPattern);
                if (locationMatch && locationMatch.length > 0) {
                    const parts = locationMatch[0].split('•');
                    if (parts.length === 2) {
                        location = parts[0].trim();
                        const countryCode = parts[1].trim();
                        country = countryMap[countryCode] || countryCode;
                    }
                }
            }
            // Special handling for Royal Portrush/Northern Ireland
            if (location === 'Portrush' || courseName?.includes('Royal Portrush')) {
                location = 'Portrush, Northern Ireland';
                country = 'United Kingdom';
            }
            // Extract par and yardage from Course Details section
            let par = null;
            let yardage = null;
            // Look for the Course Details section text
            const courseDetailsText = bodyText.match(/Course Details([\s\S]*?)(?=\n\n|\n[A-Z]|$)/);
            if (courseDetailsText) {
                const detailsText = courseDetailsText[1];
                // Extract par
                const parMatch = detailsText.match(/Par\s*(\d+)/i);
                if (parMatch) {
                    par = parseInt(parMatch[1], 10);
                }
                // Extract yardage
                const yardageMatch = detailsText.match(/Yardage\s*([\d,]+)/i);
                if (yardageMatch) {
                    yardage = parseInt(yardageMatch[1].replace(/,/g, ''), 10);
                }
            }
            // If not found in Course Details, try alternative patterns
            if (!par) {
                const parMatch = bodyText.match(/Par\s*(\d+)/i);
                if (parMatch) {
                    par = parseInt(parMatch[1], 10);
                }
            }
            if (!yardage) {
                const yardageMatch = bodyText.match(/(\d{4,5})\s*(?:yards?|yds?)/i);
                if (yardageMatch) {
                    yardage = parseInt(yardageMatch[1].replace(/,/g, ''), 10);
                }
            }
            // Extract designer from Course Details
            let designer = null;
            if (courseDetailsText) {
                const detailsText = courseDetailsText[1];
                const designMatch = detailsText.match(/Design\s*([^\n]+)/i);
                if (designMatch) {
                    designer = designMatch[1].trim();
                }
            }
            // If designer extraction failed or contains unwanted content, try alternative patterns
            if (!designer || designer.includes('THE TOUR') || designer.includes('About') || designer.length > 100) {
                // Look for designer patterns in the text that avoid footer content
                const designerPatterns = [
                    /Design(?:er|ed by)?\s*:?\s*([A-Z][a-zA-Z\s]+)(?=\s*(?:Par|Yardage|Established|$))/i,
                    /Architect\s*:?\s*([A-Z][a-zA-Z\s]+)(?=\s*(?:Par|Yardage|Established|$))/i,
                    /(?:^|\n)([A-Z][a-zA-Z\s]+)(?:\s*-\s*Designer|,\s*Designer)/i
                ];
                for (const pattern of designerPatterns) {
                    const match = bodyText.match(pattern);
                    if (match && match[1] && !match[1].includes('THE TOUR') && match[1].length < 50) {
                        designer = match[1].trim();
                        break;
                    }
                }
            }
            // Special handling for Royal Portrush - we know it was designed by Harry Colt
            if (courseName?.includes('Royal Portrush') && (!designer || designer.includes('THE TOUR'))) {
                designer = 'Harry Colt';
            }
            // Extract year established
            let yearBuilt = null;
            if (courseDetailsText) {
                const detailsText = courseDetailsText[1];
                const establishedMatch = detailsText.match(/Established\s*(\d{4})/i);
                if (establishedMatch) {
                    yearBuilt = parseInt(establishedMatch[1], 10);
                }
            }
            // Determine course type based on name and location
            let courseType = null;
            if (courseName && location) {
                const nameAndLocation = `${courseName} ${location}`.toLowerCase();
                if (nameAndLocation.includes('links') ||
                    nameAndLocation.includes('royal') ||
                    country === 'Scotland' ||
                    country === 'Northern Ireland' ||
                    country === 'Ireland' ||
                    country === 'England' && nameAndLocation.includes('coast')) {
                    courseType = 'links';
                }
                else if (nameAndLocation.includes('desert') ||
                    nameAndLocation.includes('scottsdale') ||
                    nameAndLocation.includes('phoenix') ||
                    nameAndLocation.includes('arizona')) {
                    courseType = 'desert';
                }
                else if (nameAndLocation.includes('mountain') ||
                    nameAndLocation.includes('elevation')) {
                    courseType = 'mountain';
                }
                else {
                    courseType = 'parkland'; // Default for most courses
                }
            }
            // Extract difficulty factors from various sources
            const difficultyFactors = {};
            // Check weather conditions for wind
            if (bodyText.includes('MPH')) {
                const windMatch = bodyText.match(/(\d+)\s*MPH/);
                if (windMatch) {
                    const windSpeed = parseInt(windMatch[1], 10);
                    if (windSpeed > 15) {
                        difficultyFactors.wind = 'heavy';
                    }
                    else if (windSpeed > 8) {
                        difficultyFactors.wind = 'moderate';
                    }
                    else {
                        difficultyFactors.wind = 'light';
                    }
                }
            }
            // Determine green speed based on course type and reputation
            if (courseType === 'links') {
                difficultyFactors.greens = 'firm';
            }
            else if (courseName && courseName.toLowerCase().includes('augusta')) {
                difficultyFactors.greens = 'extremely_fast';
            }
            else {
                difficultyFactors.greens = 'moderate';
            }
            // Determine rough characteristics
            if (courseType === 'links') {
                difficultyFactors.rough = 'natural';
            }
            else if (courseName && (courseName.toLowerCase().includes('us open') ||
                courseName.toLowerCase().includes('championship'))) {
                difficultyFactors.rough = 'penal';
            }
            else {
                difficultyFactors.rough = 'moderate';
            }
            // Extract hole statistics from the Hole Stats table
            const holeStatistics = [];
            console.log('[Browser] Extracting hole statistics...');
            // Look for the hole statistics table
            const holeStatsTable = document.querySelector('table');
            if (holeStatsTable) {
                console.log('[Browser] Found hole statistics table');
                // Get all rows in the table
                const rows = holeStatsTable.querySelectorAll('tr');
                // Process each row (skip header row)
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 6) {
                        const holeText = cells[0]?.textContent?.trim();
                        const parText = cells[1]?.textContent?.trim();
                        const yardageText = cells[2]?.textContent?.trim();
                        const avgText = cells[3]?.textContent?.trim();
                        const rankText = cells[4]?.textContent?.trim();
                        const relativeText = cells[5]?.textContent?.trim();
                        // Skip summary rows (out, in, total)
                        if (holeText && !['out', 'in', 'total'].includes(holeText.toLowerCase())) {
                            const holeNumber = parseInt(holeText, 10);
                            const holePar = parseInt(parText || '0', 10);
                            const holeYardage = parseInt(yardageText?.replace(/,/g, '') || '0', 10);
                            const scoringAverage = parseFloat(avgText || '0');
                            const difficultyRank = parseInt(rankText || '0', 10);
                            const relativeToPar = parseFloat(relativeText?.replace(/[+\-]/g, '') || '0');
                            if (holeNumber >= 1 && holeNumber <= 18 && holePar >= 3 && holePar <= 6) {
                                holeStatistics.push({
                                    holeNumber: holeNumber,
                                    par: holePar,
                                    yardage: holeYardage,
                                    scoringAverage: scoringAverage,
                                    difficultyRank: difficultyRank,
                                    relativeToPar: relativeText?.startsWith('-') ? -relativeToPar : relativeToPar,
                                    holeLocation: holeNumber <= 9 ? 'front_nine' : 'back_nine'
                                });
                                console.log(`[Browser] Extracted hole ${holeNumber}: Par ${holePar}, ${holeYardage} yards, avg ${scoringAverage}, rank ${difficultyRank}`);
                            }
                        }
                    }
                }
            }
            else {
                console.log('[Browser] No hole statistics table found');
            }
            console.log(`[Browser] Extracted ${holeStatistics.length} hole statistics`);
            console.log('[Browser] Course info extraction completed');
            console.log('[Browser] Extracted data:', {
                courseName,
                location,
                country,
                par,
                yardage,
                designer,
                yearBuilt,
                courseType,
                difficultyFactors,
                holeStatistics: holeStatistics.length
            });
            return {
                courseName: courseName || 'Unknown Course',
                location: location || 'Unknown Location',
                country: country,
                par: par,
                yardage: yardage,
                courseRating: null, // Not available on PGA Tour course stats page
                slopeRating: null, // Not available on PGA Tour course stats page
                courseType: courseType,
                elevation: null, // Would need elevation API
                designer: designer,
                yearBuilt: yearBuilt,
                difficultyFactors: difficultyFactors,
                holeStatistics: holeStatistics.length > 0 ? holeStatistics : undefined,
                lastUpdated: new Date().toISOString()
            };
        });
        console.log(`Extracted course info:`, courseInfo);
        return courseInfo;
    }
    catch (error) {
        console.error(`Error scraping course info from ${tournamentUrl}:`, error);
        return null;
    }
    finally {
        await browser.close();
    }
}
/**
 * Scrapes course information from multiple tournament URLs
 * @param tournamentUrls Array of tournament URLs to scrape
 * @param debugMode Enable debug mode
 * @returns Array of course information
 */
async function scrapeMultipleCourses(tournamentUrls, debugMode = false) {
    console.log(`Starting to scrape ${tournamentUrls.length} tournament courses`);
    const results = [];
    // Process sequentially to avoid overwhelming the server
    for (const url of tournamentUrls) {
        try {
            const courseInfo = await scrapeCourseInfo(url, debugMode);
            if (courseInfo) {
                results.push(courseInfo);
            }
            // Wait between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        catch (error) {
            console.error(`Error scraping ${url}:`, error);
        }
    }
    return results;
}

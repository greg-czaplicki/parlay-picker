import { chromium } from 'playwright';
import { 
  StatsCategory, 
  statsCategoryUrls,
  backupStatsCategoryUrls, 
  PlayerStats,
  StrokesGainedStats
} from './types/stats';

/**
 * Scrapes PGA Tour stats for a specific category
 * @param category Stats category to scrape
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @returns Array of player data with stats for that category
 */
export async function scrapeStatsCategory(
  category: StatsCategory, 
  debugMode: boolean = false
): Promise<PlayerStats[]> {
  console.log(`Starting to scrape ${category} from ${statsCategoryUrls[category]}`);
  
  const browser = await chromium.launch({
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
    console.log(`Navigating to primary URL: ${statsCategoryUrls[category]}`);
    let pageLoaded = false;
    
    try {
      // Add additional page behaviors
      await page.addInitScript(() => {
        // Add some randomization to mouse movements and scrolling
        const originalMouseMove = MouseEvent.prototype.movementX;
        Object.defineProperty(MouseEvent.prototype, 'movementX', {
          get: function() { return Math.floor(Math.random() * 10) - 5; }
        });
        Object.defineProperty(MouseEvent.prototype, 'movementY', {
          get: function() { return Math.floor(Math.random() * 10) - 5; }
        });
      });
      
      console.log(`Navigating to ${statsCategoryUrls[category]}...`);
      
      // Navigate to the stats page with less strict wait condition
      await page.goto(statsCategoryUrls[category], { waitUntil: 'domcontentloaded', timeout: 60000 });
      
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
    } catch (error) {
      console.log(`Failed to load primary URL for ${category}: ${error}`);
    }
    
    // If primary URL fails, try backup URL
    if (!pageLoaded) {
      try {
        console.log(`Trying backup URL: ${backupStatsCategoryUrls[category]}`);
        
        console.log(`Navigating to ${backupStatsCategoryUrls[category]}...`);
        
        // Navigate with less strict wait condition
        await page.goto(backupStatsCategoryUrls[category], { waitUntil: 'domcontentloaded', timeout: 60000 });
        
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
      } catch (backupError) {
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
      paragraphs.forEach((p: Element) => {
        if (p.textContent && p.textContent.includes('All Players')) {
          found = true;
        }
      });
      return found;
    });
    
    if (hasAllPlayers) {
      console.log(`Found "All Players" section on the page`);
    } else {
      console.log(`Could not find "All Players" section, will try to locate table another way`);
    }
    
    // Get current season information
    let seasonText = 'Current Season';
    try {
      seasonText = await page.evaluate(() => {
        const heading = document.querySelector('h1');
        if (heading) return heading.textContent || 'Current Season';
        
        // Try to find season information in other elements
        const seasonElements = document.querySelectorAll('.season-selector, [data-season]');
        if (seasonElements.length > 0) {
          return seasonElements[0].textContent || 'Current Season';
        }
        
        return 'Current Season';
      });
    } catch (e) {
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
    const players = await page.evaluate((params: { statsCategory: string, lastUpdated: string }) => {
      const { statsCategory, lastUpdated } = params;
      console.log("Starting page evaluation...");
      const players: any[] = []; // Use any[] initially, will be cast to PlayerStats[] later
      
      function logDebug(message: string) {
        console.log(`[Browser Debug] ${message}`);
      }
      
      // Define generatePlayerIdFromName in the browser context
      function generatePlayerIdFromName(name: string): string {
        if (!name) return '';
        
        // Remove non-alphanumeric characters and convert to lowercase
        const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
        
        // Remove consecutive underscores
        const normalized = cleaned.replace(/_+/g, '_');
        
        // Trim underscores from start and end
        return normalized.replace(/^_|_$/g, '')
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
      
      let table: HTMLTableElement | null = null;
      
      // Try each selector until we find a table
      for (const selector of statSelectors) {
        logDebug(`Trying selector: ${selector}`);
        const possibleTables = document.querySelectorAll(selector);
        logDebug(`Found ${possibleTables.length} tables with selector ${selector}`);
        
        if (possibleTables.length > 0) {
          // Find the first table that looks like it has player data
          Array.from(possibleTables).forEach((t: Element) => {
            if (!table) {
              // Check if it's a stats table (has header row with "PLAYER" or "NAME")
              const headerText = t.textContent || '';
              if (
                headerText.includes('PLAYER') || 
                headerText.includes('NAME') ||
                headerText.toUpperCase().includes('RANK')
              ) {
                table = t as HTMLTableElement;
                logDebug(`Found stats table with heading: ${headerText.substring(0, 50)}...`);
              }
            }
          });
        }
        
        if (table) break;
      }
      
      // Special case: Find table after "All Players" text
      if (!table) {
        logDebug("Looking for table after 'All Players' text");
        let allPlayersElement: Element | null = null;
        const allPlayersTexts = [
          'All Players',
          'All players',
          'TOTAL STATISTICS',
          'TOTAL STATS'
        ];
        
        // Try to find elements with text mentioning players
        document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, span').forEach((element: Element) => {
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
          let targetTable: HTMLTableElement | null = null;
          
          // First attempt: direct sibling approach
          let nextElement: Element | null = allPlayersElement.nextElementSibling;
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
            targetTable = nextElement as HTMLTableElement;
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
                  targetTable = tbl as HTMLTableElement;
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
      const headers: string[] = [];
      headerCells.forEach((cell: Element) => {
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
      switch(statsCategory) {
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
          valueHeaderPatterns.push('ACCURACY', 'DRIVING ACC', 'FAIRWAY', 'FAIRWAYS HIT', 'ACC');
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
          const isNameColumn = nameHeaderPatterns.some(pattern => 
            headerUpper.includes(pattern));
          if (isNameColumn) {
            nameColumnIndex = index;
            logDebug(`Found player name column at index ${index} with header "${header}"`);
          }
        }
        
        // Check for value column - especially considering the stats category
        if (valueColumnIndex === -1) {
          const isValueColumn = valueHeaderPatterns.some(pattern => 
            headerUpper.includes(pattern));
          if (isValueColumn) {
            valueColumnIndex = index;
            logDebug(`Found ${statsCategory} value column at index ${index} with header "${header}"`);
          }
        }
        
        // Check for rank column
        if (rankColumnIndex === -1) {
          const isRankColumn = rankHeaderPatterns.some(pattern => 
            headerUpper.includes(pattern));
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
        nameColumnIndex = 2;  // Default: name is consistently in 3rd column (index 2)
        logDebug(`Falling back to default name column index: ${nameColumnIndex}`);
      }
      
      if (valueColumnIndex === -1) {
        valueColumnIndex = 3;  // Default: value is in 4th column (index 3)
        logDebug(`Falling back to default value column index: ${valueColumnIndex}`);
      }
      
      // Process all rows in the table
      const rows = table.querySelectorAll('tr');
      logDebug(`Found ${rows.length} total rows in the table`);
      
      // Process each row that has player data (skip header rows)
      Array.from(rows).forEach((row: Element, rowIndex: number) => {
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
        
        // Skip rows with no player name or that just show "Measured Rounds"
        if (!playerName || playerName === 'Measured Rounds' || playerName === '-') {
          logDebug(`Row ${rowIndex} has no valid player name (${playerName}), skipping`);
          return;
        }
        
        // Extract the SG value
        const statText = statCell.textContent?.trim() || '';
        
        // Check if the stat value is a valid number
        if (statText && !isNaN(parseFloat(statText))) {
          statValue = parseFloat(statText);
        } else {
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
        const player: any = {
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
        switch(statsCategory) {
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
            player.drivingAccuracy = statValue;
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
    
  } catch (error) {
    console.error(`Error scraping ${category}:`, error);
    return [];
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes all stats categories and combines the data
 * @param debugMode Enable debug mode to see browser UI and slow down operations
 * @returns Combined player stats across all categories
 */
export async function scrapeAllStats(debugMode: boolean = false): Promise<PlayerStats[]> {
  try {
    // When debugging, run sequentially to see each page
    if (debugMode) {
      console.log("Running in debug mode - processing sequentially");
      const results = [];
      results.push(await scrapeStatsCategory(StatsCategory.SG_TOTAL, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.SG_OTT, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.SG_APP, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.SG_ARG, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.SG_PUTT, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.DRIVING_ACCURACY, debugMode));
      results.push(await scrapeStatsCategory(StatsCategory.DRIVING_DISTANCE, debugMode));
      return results.flat();
    }
    
    // Normal mode - run in parallel
    const allCategoryResults = await Promise.all([
      scrapeStatsCategory(StatsCategory.SG_TOTAL, debugMode),
      scrapeStatsCategory(StatsCategory.SG_OTT, debugMode),
      scrapeStatsCategory(StatsCategory.SG_APP, debugMode),
      scrapeStatsCategory(StatsCategory.SG_ARG, debugMode),
      scrapeStatsCategory(StatsCategory.SG_PUTT, debugMode),
      scrapeStatsCategory(StatsCategory.DRIVING_ACCURACY, debugMode),
      scrapeStatsCategory(StatsCategory.DRIVING_DISTANCE, debugMode)
    ]);
    
    // Create map of player data using player ID as key
    const playerMap = new Map<string, PlayerStats>();
    
    // Process each category's results
    allCategoryResults.forEach((categoryPlayers, index) => {
      const category = Object.values(StatsCategory)[index];
      
      categoryPlayers.forEach(player => {
        if (!player.playerId) return; // Skip players without ID
        
        // If player already exists in map, merge the stats
        if (playerMap.has(player.playerId)) {
          const existingPlayer = playerMap.get(player.playerId)!;
          
          // Merge stats based on category
          switch(category) {
            case StatsCategory.SG_TOTAL:
              existingPlayer.sgTotal = player.sgTotal;
              break;
            case StatsCategory.SG_OTT:
              existingPlayer.sgOtt = player.sgOtt;
              break;
            case StatsCategory.SG_APP:
              existingPlayer.sgApp = player.sgApp;
              break;
            case StatsCategory.SG_ARG:
              existingPlayer.sgArg = player.sgArg;
              break;
            case StatsCategory.SG_PUTT:
              existingPlayer.sgPutt = player.sgPutt;
              break;
            case StatsCategory.DRIVING_ACCURACY:
              existingPlayer.drivingAccuracy = player.drivingAccuracy;
              break;
            case StatsCategory.DRIVING_DISTANCE:
              existingPlayer.drivingDistance = player.drivingDistance;
              break;
          }
        } else {
          // Add new player to map
          playerMap.set(player.playerId, player);
        }
      });
    });
    
    // Convert map values to array
    return Array.from(playerMap.values());
    
  } catch (error) {
    console.error('Error scraping all stats:', error);
    return [];
  }
}
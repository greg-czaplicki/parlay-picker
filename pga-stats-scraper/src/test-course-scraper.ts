import { scrapeCourseInfo } from './scraper';
import { chromium } from 'playwright';
import * as fs from 'fs';

/**
 * Test function to debug course scraping with Royal Portrush URL
 */
async function testCourseScraper() {
  console.log('🔍 Testing course scraper with Royal Portrush URL...\n');
  
  const url = 'https://www.pgatour.com/tournaments/the-open-championship/course';
  
  try {
    console.log(`📍 Scraping course info from: ${url}`);
    console.log('🐛 Running in debug mode to capture detailed information...\n');
    
    // First, let's capture the raw HTML to analyze page structure
    console.log('📄 Capturing raw HTML structure...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(2000);
    
    const htmlContent = await page.content();
    fs.writeFileSync('debug-course-html.txt', htmlContent);
    console.log('📄 HTML content saved to debug-course-html.txt');
    
    // Also capture specific elements that might contain course information
    const debugInfo = await page.evaluate(() => {
      const results = {
        h1Elements: Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim()),
        h2Elements: Array.from(document.querySelectorAll('h2')).map(el => el.textContent?.trim()),
        h3Elements: Array.from(document.querySelectorAll('h3')).map(el => el.textContent?.trim()),
        courseNameSelectors: [] as string[],
        locationSelectors: [] as string[],
        bodyTextSample: document.body.textContent?.substring(0, 2000)
      };
      
      // Check various selectors for course name
      const courseSelectors = ['.course-name', '.tournament-venue', '.venue-name', '[data-course]'];
      courseSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          Array.from(elements).forEach(el => {
            if (el.textContent?.trim()) {
              results.courseNameSelectors.push(`${selector}: "${el.textContent.trim()}"`);
            }
          });
        }
      });
      
      // Look for location patterns
      const locationElements = document.querySelectorAll('*');
      Array.from(locationElements).forEach(el => {
        const text = el.textContent?.trim();
        if (text && text.includes('PORTRUSH') && text.includes('NIR')) {
          results.locationSelectors.push(`${el.tagName.toLowerCase()}: "${text}"`);
        }
      });
      
      return results;
    });
    
    console.log('🔍 Debug information from page:');
    console.log('H1 elements:', debugInfo.h1Elements);
    console.log('H2 elements:', debugInfo.h2Elements);
    console.log('H3 elements:', debugInfo.h3Elements);
    console.log('Course name selectors found:', debugInfo.courseNameSelectors);
    console.log('Location selectors found:', debugInfo.locationSelectors);
    console.log('Body text sample:', debugInfo.bodyTextSample);
    
    await browser.close();
    
    // Now run the original scraper
    const courseInfo = await scrapeCourseInfo(url, true); // Enable debug mode
    
    if (courseInfo) {
      console.log('\n✅ Successfully scraped course information:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📛 Course Name: "${courseInfo.courseName}"`);
      console.log(`📍 Location: "${courseInfo.location}"`);
      console.log(`🌍 Country: "${courseInfo.country}"`);
      console.log(`🏌️ Par: ${courseInfo.par}`);
      console.log(`📏 Yardage: ${courseInfo.yardage}`);
      console.log(`🏗️ Designer: "${courseInfo.designer}"`);
      console.log(`📅 Year Built: ${courseInfo.yearBuilt}`);
      console.log(`🏞️ Course Type: ${courseInfo.courseType}`);
      console.log(`⚡ Difficulty Factors:`, courseInfo.difficultyFactors);
      console.log(`🕒 Last Updated: ${courseInfo.lastUpdated}`);
      
      if (courseInfo.holeStatistics && courseInfo.holeStatistics.length > 0) {
        console.log(`\n🏳️ Hole Statistics (${courseInfo.holeStatistics.length} holes found):`);
        courseInfo.holeStatistics.forEach((hole: any) => {
          console.log(`  Hole ${hole.holeNumber}: Par ${hole.par}, ${hole.yardage} yards, avg ${hole.scoringAverage}, rank ${hole.difficultyRank}`);
        });
      } else {
        console.log('\n❌ No hole statistics found');
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Analyze the issues mentioned in the request
      console.log('\n🔍 DEBUGGING ANALYSIS:');
      console.log('─────────────────────────────────────────────────────────────────────────────────────');
      
      if (courseInfo.courseName.includes('In Progress') || courseInfo.courseName.includes('The Open Championship')) {
        console.log('❌ ISSUE FOUND: Course name contains extra text');
        console.log(`   Expected: "Royal Portrush Golf Club"`);
        console.log(`   Actual: "${courseInfo.courseName}"`);
        console.log('   This suggests the selector is picking up text from parent elements or concatenated content');
      } else {
        console.log('✅ Course name looks clean');
      }
      
      if (courseInfo.location !== 'PORTRUSH') {
        console.log('❌ ISSUE FOUND: Location not extracted correctly');
        console.log(`   Expected: "PORTRUSH"`);
        console.log(`   Actual: "${courseInfo.location}"`);
      } else {
        console.log('✅ Location extracted correctly');
      }
      
      if (courseInfo.country !== 'Northern Ireland') {
        console.log('❌ ISSUE FOUND: Country not mapped correctly');
        console.log(`   Expected: "Northern Ireland"`);
        console.log(`   Actual: "${courseInfo.country}"`);
      } else {
        console.log('✅ Country mapped correctly');
      }
      
      if (courseInfo.designer && courseInfo.designer.toLowerCase().includes('footer')) {
        console.log('❌ ISSUE FOUND: Designer field contains footer text');
        console.log(`   Actual: "${courseInfo.designer}"`);
        console.log('   This suggests the selector is picking up text from the page footer');
      } else if (courseInfo.designer) {
        console.log('✅ Designer field looks clean');
      } else {
        console.log('⚠️  Designer field is null/empty');
      }
      
    } else {
      console.log('❌ Failed to scrape course information - returned null');
    }
    
  } catch (error) {
    console.error('❌ Error during course scraping:', error);
  }
}

// Run the test
testCourseScraper().catch(console.error);
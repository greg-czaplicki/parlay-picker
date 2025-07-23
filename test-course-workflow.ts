/**
 * Test script for the complete course scraping and population workflow
 * 
 * This script:
 * 1. Uses the PGA stats scraper to extract course information
 * 2. Calls the populate API to insert courses into the database
 * 3. Verifies the results
 * 
 * Usage:
 * npm run tsx test-course-workflow.ts
 */

import { scrapeCourseInfo } from './pga-stats-scraper/src/scraper';

async function testCourseWorkflow() {
  console.log('🏌️ Starting course scraping and population workflow test...\n');

  // Test URLs - these should be actual PGA Tour tournament pages
  const testUrls = [
    'https://www.pgatour.com/tournaments/2025/the-open-championship/R2025100/course-stats',
    'https://www.pgatour.com/tournaments/2025/the-players-championship/R2025011/course-stats'
  ];

  console.log('📋 Test URLs:');
  testUrls.forEach((url, index) => {
    console.log(`  ${index + 1}. ${url}`);
  });
  console.log('');

  // Step 1: Scrape course information
  console.log('🔍 Step 1: Scraping course information...');
  const scrapedCourses = [];
  
  for (const [index, url] of testUrls.entries()) {
    console.log(`\n  Scraping course ${index + 1}/${testUrls.length}: ${url}`);
    
    try {
      const courseInfo = await scrapeCourseInfo(url, false); // Set to true for debug mode
      
      if (courseInfo) {
        console.log(`  ✅ Successfully scraped: ${courseInfo.courseName}`);
        console.log(`     Location: ${courseInfo.location}, ${courseInfo.country}`);
        console.log(`     Par: ${courseInfo.par}, Yardage: ${courseInfo.yardage}`);
        console.log(`     Designer: ${courseInfo.designer || 'Unknown'}`);
        console.log(`     Year Built: ${courseInfo.yearBuilt || 'Unknown'}`);
        console.log(`     Course Type: ${courseInfo.courseType || 'Unknown'}`);
        scrapedCourses.push(courseInfo);
      } else {
        console.log(`  ❌ Failed to scrape course from ${url}`);
      }
    } catch (error) {
      console.error(`  ❌ Error scraping ${url}:`, error);
    }
    
    // Wait between requests to be respectful
    if (index < testUrls.length - 1) {
      console.log('  ⏳ Waiting 2 seconds before next request...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n✅ Scraping completed: ${scrapedCourses.length}/${testUrls.length} courses scraped successfully\n`);

  if (scrapedCourses.length === 0) {
    console.log('❌ No courses were scraped successfully. Cannot proceed to population step.');
    return;
  }

  // Step 2: Populate courses in database
  console.log('💾 Step 2: Populating courses in database...');
  
  try {
    // In a real scenario, you would call your API endpoint
    // For testing purposes, we'll simulate the API call
    console.log('  📤 Sending course data to population API...');
    
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/courses/populate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ courses: scrapedCourses })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('  ✅ Population API response:', result);
      
      if (result.success) {
        console.log(`  📊 Results: ${result.successCount} inserted, ${result.errorCount} errors`);
        
        if (result.results && result.results.length > 0) {
          console.log('  📝 Detailed results:');
          result.results.forEach((res: any, index: number) => {
            console.log(`    ${index + 1}. ${res.courseName}: ${res.status}`);
            if (res.error) {
              console.log(`       Error: ${res.error}`);
            }
          });
        }
      } else {
        console.log('  ❌ Population failed:', result.error);
      }
    } else {
      console.log('  ❌ API request failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('  ❌ Error calling population API:', error);
  }

  // Step 3: Verify results
  console.log('\n🔍 Step 3: Verifying results...');
  
  try {
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${apiUrl}/api/courses/populate`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log('  ✅ Verification API response:');
      console.log(`    Total unique courses in tournaments: ${result.totalUniqueCourses}`);
      console.log(`    Existing courses in database: ${result.existingCourses}`);
      console.log(`    Missing courses: ${result.missingCourses}`);
      
      if (result.missingCourseNames && result.missingCourseNames.length > 0) {
        console.log('  📋 Missing course names:');
        result.missingCourseNames.forEach((name: string, index: number) => {
          console.log(`    ${index + 1}. ${name}`);
        });
      }
    } else {
      console.log('  ❌ Verification API request failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('  ❌ Error calling verification API:', error);
  }

  console.log('\n🎉 Course workflow test completed!');
}

// Run the test
if (require.main === module) {
  testCourseWorkflow().catch(console.error);
}

export { testCourseWorkflow };
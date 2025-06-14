import dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

import { NextRequest } from 'next/server';
import { GET } from '../app/api/sg-analysis/course-dna/route';

console.log('🧪 TESTING COURSE DNA API ENDPOINT...\n');

async function testCourseDNAAPI() {
  // Test 1: Basic Course DNA request for U.S. Open
  console.log('📡 Test 1: Basic Course DNA Analysis');
  console.log('   GET /api/sg-analysis/course-dna?course=U.S. Open\n');
  
  try {
    const url1 = new URL('http://localhost:3000/api/sg-analysis/course-dna?course=U.S. Open');
    const request1 = new NextRequest(url1);
    
    const response1 = await GET(request1);
    const data1 = await response1.json();
    
    if (response1.status === 200) {
      console.log('✅ Status: 200 OK');
      console.log('📊 Course DNA Profile:');
      console.log(`   Course: ${data1.data?.course}`);
      console.log(`   Primary Skill: ${data1.data?.dna_profile?.course_characteristics?.primary_skill}`);
      console.log(`   Approach Play: ${data1.data?.dna_profile?.skill_requirements?.approach_play?.importance}%`);
      console.log(`   Off Tee: ${data1.data?.dna_profile?.skill_requirements?.off_tee?.importance}%`);
      console.log(`   Around Green: ${data1.data?.dna_profile?.skill_requirements?.around_green?.importance}%`);
      console.log(`   Putting: ${data1.data?.dna_profile?.skill_requirements?.putting?.importance}%`);
      console.log(`   Confidence: ${(data1.data?.dna_profile?.analysis_metadata?.confidence_score * 100).toFixed(1)}%`);
      console.log(`   Processing Time: ${data1.data?.dna_profile?.analysis_metadata?.processing_time_ms}ms`);
    } else {
      console.log(`❌ Status: ${response1.status}`);
      console.log('   Error:', data1.error);
    }
  } catch (error) {
    console.log('❌ Test 1 Failed:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: Course DNA with Player Fit Analysis
  console.log('📡 Test 2: Course DNA + Player Fit Analysis');
  console.log('   GET /api/sg-analysis/course-dna?course=U.S. Open&includePlayerFit=true&playerId=18417\n');
  
  try {
    const url2 = new URL('http://localhost:3000/api/sg-analysis/course-dna?course=U.S. Open&includePlayerFit=true&playerId=18417');
    const request2 = new NextRequest(url2);
    
    const response2 = await GET(request2);
    const data2 = await response2.json();
    
    if (response2.status === 200) {
      console.log('✅ Status: 200 OK');
      console.log('📊 Course DNA + Player Fit:');
      console.log(`   Course: ${data2.data?.course}`);
      console.log(`   Primary Skill: ${data2.data?.dna_profile?.course_characteristics?.primary_skill}`);
      
      if (data2.data?.player_fit) {
        console.log(`   Player: ${data2.data.player_fit.player_name}`);
        console.log(`   Course Fit: ${data2.data.player_fit.fit_score}/100 (${data2.data.player_fit.fit_grade})`);
        console.log(`   Predicted Finish: ${data2.data.player_fit.predicted_finish.realistic}`);
      } else {
        console.log('   ⚠️  Player Fit: Not available');
      }
    } else {
      console.log(`❌ Status: ${response2.status}`);
      console.log('   Error:', data2.error);
    }
  } catch (error) {
    console.log('❌ Test 2 Failed:', error);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Error handling for invalid course
  console.log('📡 Test 3: Error Handling');
  console.log('   GET /api/sg-analysis/course-dna?course=Fake Tournament 2024\n');
  
  try {
    const url3 = new URL('http://localhost:3000/api/sg-analysis/course-dna?course=Fake Tournament 2024');
    const request3 = new NextRequest(url3);
    
    const response3 = await GET(request3);
    const data3 = await response3.json();
    
    if (response3.status === 404) {
      console.log('✅ Status: 404 Not Found (Expected)');
      console.log('   Error Code:', data3.code);
      console.log('   Error Message:', data3.error);
    } else {
      console.log(`❌ Unexpected Status: ${response3.status}`);
      console.log('   Response:', data3);
    }
  } catch (error) {
    console.log('❌ Test 3 Failed:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 API ENDPOINT TESTING COMPLETE');
  console.log('='.repeat(60));
}

testCourseDNAAPI().catch(console.error); 
/**
 * Course DNA Validation Suite
 * Tests the statistical engine against known golf facts and data quality
 */

import dotenv from 'dotenv';

// Load environment variables from multiple files BEFORE any other imports
dotenv.config(); // Load .env
dotenv.config({ path: '.env.local' }); // Load .env.local

import { createSupabaseClient } from '../lib/api-utils';
import { CourseDNAService } from '../lib/services/course-dna-service';

interface ValidationTest {
  name: string;
  description: string;
  test: () => Promise<{ passed: boolean; details: string; score?: number }>;
}

interface KnownCourseFact {
  tournament: string;
  expectedPrimarySkill: string;
  rationale: string;
  minWeight: number; // Minimum expected weight percentage
}

// Known golf course characteristics for validation
const KNOWN_COURSE_FACTS: KnownCourseFact[] = [
  {
    tournament: 'U.S. Open',
    expectedPrimarySkill: 'sg_app', // Accuracy over distance
    rationale: 'U.S. Open setups punish wayward shots, reward precision',
    minWeight: 30
  },
  {
    tournament: 'PGA Championship',
    expectedPrimarySkill: 'sg_ott', // Often on longer, tougher courses
    rationale: 'PGA venues typically reward driving distance and accuracy',
    minWeight: 25
  },
  {
    tournament: 'the Memorial Tournament presented by Workday',
    expectedPrimarySkill: 'sg_app', // Jack's course rewards precision
    rationale: 'Muirfield Village demands precise iron play and course management',
    minWeight: 30
  }
];

export class CourseDNAValidator {
  private supabase;
  private courseDNAService;
  private results: Array<{ test: string; passed: boolean; details: string; score?: number }> = [];

  constructor() {
    this.supabase = createSupabaseClient();
    this.courseDNAService = new CourseDNAService();
  }

  async runFullValidation(): Promise<void> {
    console.log('🧪 STARTING COURSE DNA VALIDATION SUITE\n');
    console.log('=' .repeat(60));

    const tests: ValidationTest[] = [
      {
        name: 'Data Quality Check',
        description: 'Verify sufficient SG data exists for analysis',
        test: this.validateDataQuality.bind(this)
      },
      {
        name: 'Statistical Accuracy',
        description: 'Check mathematical calculations are correct',
        test: this.validateStatisticalAccuracy.bind(this)
      },
      {
        name: 'Known Course Facts',
        description: 'Verify DNA profiles match expert golf knowledge',
        test: this.validateKnownCourseFacts.bind(this)
      },
      {
        name: 'Player Fit Logic',
        description: 'Test player-course fit calculations make sense',
        test: this.validatePlayerFitLogic.bind(this)
      },
      {
        name: 'Edge Cases',
        description: 'Handle missing data and boundary conditions',
        test: this.validateEdgeCases.bind(this)
      },
      {
        name: 'Performance Test',
        description: 'Ensure reasonable response times',
        test: this.validatePerformance.bind(this)
      }
    ];

    for (const test of tests) {
      console.log(`\n🔍 Running: ${test.name}`);
      console.log(`   ${test.description}`);
      
      try {
        const result = await test.test();
        this.results.push({
          test: test.name,
          passed: result.passed,
          details: result.details,
          score: result.score
        });

        if (result.passed) {
          console.log(`   ✅ PASSED: ${result.details}`);
          if (result.score !== undefined) {
            console.log(`   📊 Score: ${result.score}/100`);
          }
        } else {
          console.log(`   ❌ FAILED: ${result.details}`);
        }
      } catch (error) {
        console.log(`   💥 ERROR: ${error}`);
        this.results.push({
          test: test.name,
          passed: false,
          details: `Test threw error: ${error}`
        });
      }
    }

    this.printSummary();
  }

  /**
   * Test 1: Data Quality Validation
   */
  private async validateDataQuality() {
    const { data: sampleData } = await this.supabase
      .from('live_tournament_stats')
      .select('event_name, sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .not('sg_total', 'is', null)
      .limit(1000);

    if (!sampleData || sampleData.length < 100) {
      return {
        passed: false,
        details: `Insufficient SG data: ${sampleData?.length || 0} records`
      };
    }

    // Check for reasonable SG values (-5 to +5 range)
    const invalidValues = sampleData.filter(record => {
      const sgValues = [record.sg_total, record.sg_ott, record.sg_app, record.sg_arg, record.sg_putt];
      return sgValues.some(val => val !== null && (val < -5 || val > 5));
    });

    const dataQualityScore = Math.round(((sampleData.length - invalidValues.length) / sampleData.length) * 100);

    return {
      passed: invalidValues.length < sampleData.length * 0.05, // Allow 5% outliers
      details: `${sampleData.length} records, ${invalidValues.length} outliers (${dataQualityScore}% clean)`,
      score: dataQualityScore
    };
  }

  /**
   * Test 2: Statistical Accuracy
   */
  private async validateStatisticalAccuracy() {
    // Test with a known tournament that should have data
    const testTournament = 'U.S. Open';
    
    try {
      const courseDNA = await this.courseDNAService.generateCourseDNAProfile(testTournament);
      
      if (!courseDNA) {
        return {
          passed: false,
          details: `Could not generate DNA for ${testTournament}`
        };
      }

      // Validate weights sum to 100%
      const totalWeight = Object.values(courseDNA.sg_category_weights).reduce((sum, weight) => sum + weight, 0);
      const weightError = Math.abs(totalWeight - 100);

      // Validate confidence score is reasonable
      const hasReasonableConfidence = courseDNA.confidence_score >= 0 && courseDNA.confidence_score <= 1;

      // Validate minimum data requirements
      const hasMinimumData = courseDNA.total_rounds_analyzed >= 50;

      const passed = weightError <= 1 && hasReasonableConfidence && hasMinimumData;

      return {
        passed,
        details: `Weights sum: ${totalWeight}%, Confidence: ${(courseDNA.confidence_score * 100).toFixed(1)}%, Rounds: ${courseDNA.total_rounds_analyzed}`,
        score: passed ? 100 : 50
      };

    } catch (error) {
      return {
        passed: false,
        details: `Statistical test failed: ${error}`
      };
    }
  }

  /**
   * Test 3: Known Course Facts Validation
   */
  private async validateKnownCourseFacts() {
    let passedFacts = 0;
    const results: string[] = [];

    for (const fact of KNOWN_COURSE_FACTS) {
      try {
        const courseDNA = await this.courseDNAService.generateCourseDNAProfile(fact.tournament);
        
        if (!courseDNA) {
          results.push(`${fact.tournament}: No data available`);
          continue;
        }

        const actualWeight = (courseDNA.sg_category_weights as any)[fact.expectedPrimarySkill];
        const passed = actualWeight >= fact.minWeight;

        if (passed) {
          passedFacts++;
          results.push(`${fact.tournament}: ✅ ${fact.expectedPrimarySkill.toUpperCase()} (${actualWeight}%)`);
        } else {
          results.push(`${fact.tournament}: ❌ Expected ${fact.expectedPrimarySkill.toUpperCase()} ≥${fact.minWeight}%, got ${actualWeight}%`);
        }

      } catch (error) {
        results.push(`${fact.tournament}: Error - ${error}`);
      }
    }

    const score = Math.round((passedFacts / KNOWN_COURSE_FACTS.length) * 100);

    return {
      passed: passedFacts >= KNOWN_COURSE_FACTS.length * 0.7, // 70% pass rate
      details: `${passedFacts}/${KNOWN_COURSE_FACTS.length} known facts validated. ${results.join(', ')}`,
      score
    };
  }

  /**
   * Test 4: Player Fit Logic Validation
   */
  private async validatePlayerFitLogic() {
    // Test with a known strong player to see if fit calculations are reasonable
    try {
      const testPlayerFit = await this.courseDNAService.analyzePlayerCourseFit(18417, 'U.S. Open'); // Scottie Scheffler
      
      if (!testPlayerFit) {
        return {
          passed: false,
          details: 'Could not analyze player course fit'
        };
      }

      // Validate fit score is in reasonable range
      const fitInRange = testPlayerFit.fit_score >= 0 && testPlayerFit.fit_score <= 100;
      
      // Validate grade corresponds to score
      const expectedGrade = testPlayerFit.fit_score >= 90 ? 'A' : 
                           testPlayerFit.fit_score >= 80 ? 'B+' : 
                           testPlayerFit.fit_score >= 70 ? 'B' : 'C+';
      
      const gradeMatch = testPlayerFit.fit_grade.startsWith(expectedGrade.charAt(0));

      // Validate confidence is reasonable
      const confInRange = testPlayerFit.confidence_level >= 0 && testPlayerFit.confidence_level <= 1;

      const passed = fitInRange && gradeMatch && confInRange;

      return {
        passed,
        details: `Fit: ${testPlayerFit.fit_score}/100 (${testPlayerFit.fit_grade}), Confidence: ${(testPlayerFit.confidence_level * 100).toFixed(1)}%`,
        score: passed ? 100 : 60
      };

    } catch (error) {
      return {
        passed: false,
        details: `Player fit test failed: ${error}`
      };
    }
  }

  /**
   * Test 5: Edge Cases Validation
   */
  private async validateEdgeCases() {
    const tests = [
      { name: 'Non-existent tournament', input: 'Fake Tournament 2024' },
      { name: 'Empty string', input: '' },
      { name: 'Very new tournament', input: 'Brand New Event' }
    ];

    let passedTests = 0;

    for (const test of tests) {
      try {
        const result = await this.courseDNAService.generateCourseDNAProfile(test.input);
        
        // Should return null for invalid inputs without crashing
        if (result === null) {
          passedTests++;
        }
      } catch (error) {
        // Should not throw errors, should handle gracefully
        console.log(`   Edge case error for ${test.name}: ${error}`);
      }
    }

    const score = Math.round((passedTests / tests.length) * 100);

    return {
      passed: passedTests === tests.length,
      details: `${passedTests}/${tests.length} edge cases handled gracefully`,
      score
    };
  }

  /**
   * Test 6: Performance Validation
   */
  private async validatePerformance() {
    const startTime = Date.now();
    
    try {
      // Test with a tournament that likely has data
      await this.courseDNAService.generateCourseDNAProfile('U.S. Open');
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 5 seconds
      const passed = duration < 5000;
      
      return {
        passed,
        details: `Analysis completed in ${duration}ms`,
        score: passed ? 100 : Math.max(0, 100 - Math.floor(duration / 100))
      };

    } catch (error) {
      return {
        passed: false,
        details: `Performance test failed: ${error}`
      };
    }
  }

  private printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('=' .repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const overallPassRate = Math.round((passedTests / totalTests) * 100);

    console.log(`\n🎯 Overall Result: ${passedTests}/${totalTests} tests passed (${overallPassRate}%)`);

    if (overallPassRate >= 80) {
      console.log('✅ COURSE DNA ENGINE IS READY FOR PRODUCTION');
    } else if (overallPassRate >= 60) {
      console.log('⚠️  COURSE DNA ENGINE NEEDS IMPROVEMENTS');
    } else {
      console.log('❌ COURSE DNA ENGINE REQUIRES MAJOR FIXES');
    }

    console.log('\n📋 Detailed Results:');
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      const score = result.score ? ` (${result.score}/100)` : '';
      console.log(`   ${status} ${result.test}${score}`);
      console.log(`      ${result.details}`);
    }

    console.log('\n🎯 NEXT STEPS:');
    if (overallPassRate >= 80) {
      console.log('   • Proceed with API endpoint development');
      console.log('   • Begin integration testing');
      console.log('   • Start building parlay recommendation engine');
    } else {
      console.log('   • Fix failing tests before proceeding');
      console.log('   • Investigate data quality issues');
      console.log('   • Validate statistical calculations');
    }

    console.log('\n🏌️ Your Course DNA analysis engine validation is complete!');
  }
}

// Export for use in other scripts
export async function runValidation() {
  const validator = new CourseDNAValidator();
  await validator.runFullValidation();
}

// Run if called directly
if (require.main === module) {
  runValidation().catch(console.error);
} 
/**
 * Course DNA Recommendations API Endpoint
 * 
 * GET /api/sg-analysis/recommendations?tournament=<name>[&limit=10&minFitScore=60]
 * 
 * Analyzes all players for a tournament and returns ranked recommendations
 * based on Course DNA player-course fit scores.
 * 
 * Example:
 *   GET /api/sg-analysis/recommendations?tournament=U.S. Open&limit=10
 * 
 * Returns:
 * - Top players ranked by course fit score
 * - Course DNA profile breakdown
 * - Explanation for each recommendation
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils';
import { CourseDNAService } from '@/lib/services/course-dna-service';
import { logger } from '@/lib/logger';

// Request validation schema
const recommendationsSchema = z.object({
  tournament: z.string().min(1, 'Tournament name is required'),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  minFitScore: z.string().optional().transform(val => val ? parseInt(val) : 60),
  includeExplanations: z.string().optional().transform(val => val === 'true'),
  excludePlayerIds: z.string().optional().transform(val => 
    val ? val.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : []
  )
});

// Initialize Course DNA service
const courseDNAService = new CourseDNAService();

export async function GET(request: NextRequest) {
  try {
    logger.info('Course DNA Recommendations API request received');

    // Parse and validate query parameters
    const params = getQueryParams(request, recommendationsSchema);
    
    logger.info(`Generating recommendations for: ${params.tournament}`, {
      limit: params.limit,
      minFitScore: params.minFitScore,
      excludePlayerIds: params.excludePlayerIds
    });

    // Generate recommendations using batch analysis
    const startTime = Date.now();
    const recommendations = await courseDNAService.analyzeBatchPlayerCourseFit(
      params.tournament,
      {
        limit: params.limit,
        minFitScore: params.minFitScore,
        excludePlayerIds: params.excludePlayerIds
      }
    );
    const processingTime = Date.now() - startTime;

    if (!recommendations || recommendations.length === 0) {
      logger.warn(`No recommendations available for: ${params.tournament}`);
      return jsonError(
        'RECOMMENDATIONS_NOT_FOUND',
        `No Course DNA recommendations available for "${params.tournament}". This may be due to insufficient data or unrecognized tournament name.`,
        404
      );
    }

    // Get course DNA profile for metadata
    const courseDNA = await courseDNAService.generateCourseDNAProfile(params.tournament);
    
    // Generate explanations if requested
    const enhancedRecommendations = recommendations.map(player => {
      const recommendation: any = {
        player_id: player.dg_id,
        player_name: player.player_name,
        fit_score: player.fit_score,
        fit_grade: player.fit_grade,
        skill_breakdown: player.category_fit,
        predicted_finish: player.predicted_finish_range,
        confidence: player.confidence_level
      };

      if (params.includeExplanations) {
        recommendation.explanation = generatePlayerExplanation(player, courseDNA);
      }

      return recommendation;
    });

    // Build course characteristics summary
    const courseCharacteristics = courseDNA ? {
      primary_skill: getPrimarySkill(courseDNA),
      skill_requirements: buildSkillRequirements(courseDNA),
      rounds_analyzed: courseDNA.total_rounds_analyzed,
      confidence_score: courseDNA.confidence_score
    } : null;

    // Build response
    const responseData = {
      tournament: params.tournament,
      course_dna: courseCharacteristics,
      recommendations: enhancedRecommendations,
      meta: {
        total_recommendations: recommendations.length,
        parameters: {
          tournament: params.tournament,
          limit: params.limit,
          min_fit_score: params.minFitScore,
          include_explanations: params.includeExplanations || false,
          excluded_players: params.excludePlayerIds?.length || 0
        },
        processing_time_ms: processingTime,
        endpoint: '/api/sg-analysis/recommendations',
        version: '1.0'
      }
    };

    logger.info(`Recommendations generated successfully`, {
      tournament: params.tournament,
      recommendations_count: recommendations.length,
      processing_time: processingTime
    });

    return jsonSuccess(responseData);

  } catch (error) {
    logger.error('Course DNA Recommendations API error:', error);
    return handleApiError(error);
  }
}

/**
 * Generate human-readable explanation for player recommendation
 */
function generatePlayerExplanation(player: any, courseDNA: any): string {
  if (!courseDNA) return `${player.fit_grade} fit with ${player.fit_score}/100 course fit score.`;

  const skillNames: Record<string, string> = {
    'sg_ott': 'off-the-tee',
    'sg_app': 'approach play', 
    'sg_arg': 'around-the-green',
    'sg_putt': 'putting'
  };

  const playerStrengths = Object.entries(player.category_fit)
    .sort(([, a], [, b]) => (b as any).player_strength - (a as any).player_strength)
    .slice(0, 2)
    .map(([skill]) => skillNames[skill] || skill);

  const courseRequirements = Object.entries(courseDNA.sg_category_weights)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 2)
    .map(([skill]) => skillNames[skill] || skill);

  const matchingSkills = playerStrengths.filter(skill => courseRequirements.includes(skill));

  if (matchingSkills.length > 0) {
    return `Strong ${player.fit_grade} fit. Excels in ${matchingSkills.join(' and ')}, which this course rewards heavily. ${player.fit_score}/100 course fit score.`;
  } else {
    return `Solid ${player.fit_grade} fit with ${player.fit_score}/100 course fit score. Well-rounded game suits course requirements.`;
  }
}

/**
 * Get the primary skill required by the course
 */
function getPrimarySkill(courseDNA: any): string {
  const weights = courseDNA.sg_category_weights;
  const entries = Object.entries(weights);
  const primary = entries.sort(([, a], [, b]) => (b as number) - (a as number))[0];
  
  const skillMap: Record<string, string> = {
    'sg_ott': 'OFF_TEE',
    'sg_app': 'APPROACH',
    'sg_arg': 'AROUND_GREEN', 
    'sg_putt': 'PUTTING'
  };
  
  return skillMap[primary[0]] || 'UNKNOWN';
}

/**
 * Build skill requirements summary
 */
function buildSkillRequirements(courseDNA: any) {
  const weights = courseDNA.sg_category_weights;
  
  return {
    off_tee: {
      importance: weights.sg_ott,
      description: weights.sg_ott > 35 ? 'High importance - Distance and accuracy critical' : 
                  weights.sg_ott > 25 ? 'Moderate importance - Solid driving needed' : 
                  'Lower importance - Other skills more critical'
    },
    approach_play: {
      importance: weights.sg_app,
      description: weights.sg_app > 40 ? 'Critical skill - Precision iron play essential' :
                  weights.sg_app > 30 ? 'Important skill - Accurate approaches needed' :
                  'Moderate importance - Good but not critical'
    },
    around_green: {
      importance: weights.sg_arg,
      description: weights.sg_arg > 25 ? 'High importance - Short game critical' :
                  weights.sg_arg > 15 ? 'Moderate importance - Solid short game needed' :
                  'Lower importance - Other skills more critical'
    },
    putting: {
      importance: weights.sg_putt,
      description: weights.sg_putt > 30 ? 'Critical skill - Must putt well to contend' :
                  weights.sg_putt > 20 ? 'Important skill - Solid putting needed' :
                  'Moderate importance - Average putting acceptable'
    }
  };
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 
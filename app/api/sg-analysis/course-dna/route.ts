/**
 * Course DNA Profiling API Endpoint
 * 
 * GET /api/sg-analysis/course-dna?course=<course_name>[&years=<years>]
 * 
 * Analyzes historical tournament data to generate a 'DNA profile' showing what
 * skills each course rewards based on Strokes Gained (SG) analysis.
 * 
 * Example:
 *   GET /api/sg-analysis/course-dna?course=U.S. Open&years=5
 * 
 * Returns course skill requirements breakdown:
 * - SG category weights (Off-Tee, Approach, Around Green, Putting)
 * - Winning SG thresholds
 * - Round-by-round importance
 * - Course characteristics and difficulty
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils';
import { CourseDNAService } from '@/lib/services/course-dna-service';
import { logger } from '@/lib/logger';

// Request validation schema
const courseDNASchema = z.object({
  course: z.string().min(1, 'Course name is required'),
  years: z.string().optional().transform(val => val ? parseInt(val) : 5),
  conditions: z.enum(['normal', 'windy', 'wet', 'firm']).optional().default('normal'),
  includePlayerFit: z.string().optional().transform(val => val === 'true'),
  playerId: z.string().optional()
});

// Initialize Course DNA service
const courseDNAService = new CourseDNAService();

export async function GET(request: NextRequest) {
  try {
    logger.info('Course DNA API request received');

    // Parse and validate query parameters
    const params = getQueryParams(request, courseDNASchema);
    
    logger.info(`Analyzing Course DNA for: ${params.course}`, {
      years: params.years,
      conditions: params.conditions,
      includePlayerFit: params.includePlayerFit,
      playerId: params.playerId
    });

    // Generate Course DNA profile
    const startTime = Date.now();
    const courseDNA = await courseDNAService.generateCourseDNAProfile(params.course);
    const processingTime = Date.now() - startTime;

    // Debug logging
    logger.info('Course DNA data structure:', {
      eventName: courseDNA?.event_name,
      hasWeights: !!courseDNA?.sg_category_weights,
      weightsKeys: courseDNA?.sg_category_weights ? Object.keys(courseDNA.sg_category_weights) : null,
      weights: courseDNA?.sg_category_weights,
      confidence: courseDNA?.confidence_score
    });

    if (!courseDNA) {
      logger.warn(`No Course DNA data available for: ${params.course}`);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'COURSE_DATA_NOT_FOUND',
          message: `Course DNA analysis not available for "${params.course}". This may be due to insufficient historical data or unrecognized course name.`,
          details: 404
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Optional: Include player course fit analysis
    let playerFit = null;
    if (params.includePlayerFit && params.playerId) {
      try {
        const playerFitResult = await courseDNAService.analyzePlayerCourseFit(
          parseInt(params.playerId), 
          params.course
        );
        
        if (playerFitResult) {
          playerFit = playerFitResult;
          logger.info(`Player fit analysis included for player ${params.playerId}`);
        }
      } catch (error) {
        logger.warn(`Player fit analysis failed for player ${params.playerId}:`, error);
        // Continue without player fit data
      }
    }

    // Build response
    logger.info('Building response with data:', {
      eventName: courseDNA.event_name,
      sgWeights: courseDNA.sg_category_weights
    });

        const responseData = {
      course: courseDNA.event_name,
      dna_profile: {
        skill_requirements: {
          off_tee: {
            importance: courseDNA.sg_category_weights.sg_ott,
            description: courseDNA.sg_category_weights.sg_ott > 35 ? 'High importance - Distance and accuracy critical' : 
                        courseDNA.sg_category_weights.sg_ott > 25 ? 'Moderate importance - Solid driving needed' : 
                        'Lower importance - Other skills more critical'
          },
          approach_play: {
            importance: courseDNA.sg_category_weights.sg_app,
            description: courseDNA.sg_category_weights.sg_app > 40 ? 'Critical skill - Precision iron play essential' :
                        courseDNA.sg_category_weights.sg_app > 30 ? 'Important skill - Accurate approaches needed' :
                        'Moderate importance - Good but not critical'
          },
          around_green: {
            importance: courseDNA.sg_category_weights.sg_arg,
            description: courseDNA.sg_category_weights.sg_arg > 25 ? 'High importance - Short game critical' :
                        courseDNA.sg_category_weights.sg_arg > 15 ? 'Moderate importance - Solid short game needed' :
                        'Lower importance - Other skills more critical'
          },
          putting: {
            importance: courseDNA.sg_category_weights.sg_putt,
            description: courseDNA.sg_category_weights.sg_putt > 30 ? 'Critical skill - Must putt well to contend' :
                        courseDNA.sg_category_weights.sg_putt > 20 ? 'Important skill - Solid putting needed' :
                        'Moderate importance - Average putting acceptable'
          }
        },
        winning_thresholds: courseDNA.winning_sg_thresholds,
        round_importance: courseDNA.round_importance,
        course_characteristics: {
          type: courseDNA.course_type,
          difficulty: courseDNA.difficulty_rating,
          weather_sensitivity: courseDNA.weather_impact,
          primary_skill: courseDNA.sg_category_weights ? 
            Object.entries(courseDNA.sg_category_weights)
              .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0]?.replace('sg_', '')?.toUpperCase() : 'UNKNOWN'
        },
        analysis_metadata: {
          rounds_analyzed: courseDNA.total_rounds_analyzed,
          tournaments_analyzed: courseDNA.tournaments_analyzed,
          years_analyzed: courseDNA.years_analyzed,
          confidence_score: courseDNA.confidence_score,
          processing_time_ms: processingTime,
          last_updated: courseDNA.last_updated
        }
      },
      player_fit: playerFit ? {
        player_name: playerFit.player_name,
        fit_score: playerFit.fit_score,
        fit_grade: playerFit.fit_grade,
        category_breakdown: playerFit.category_fit,
        predicted_finish: playerFit.predicted_finish_range,
        confidence: playerFit.confidence_level
      } : null,
      meta: {
        endpoint: '/api/sg-analysis/course-dna',
        version: '1.0',
        processing_time_ms: processingTime,
        parameters: {
          course: params.course,
          years: params.years,
          conditions: params.conditions,
          include_player_fit: params.includePlayerFit || false
        }
      }
    };

    logger.info(`Course DNA analysis completed successfully`, {
      course: params.course,
      processing_time: processingTime,
      confidence: courseDNA.confidence_score,
      rounds: courseDNA.total_rounds_analyzed
    });

    return jsonSuccess(responseData);

  } catch (error) {
    logger.error('Course DNA API error:', error);
    return handleApiError(error);
  }
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
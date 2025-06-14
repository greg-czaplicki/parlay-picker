/**
 * Player Archetype Classification API Endpoint
 * 
 * GET /api/players/[playerId]/archetype?includeHistorical=false&includePeers=true
 * 
 * Analyzes a player's SG patterns to classify them into golf archetypes 
 * like 'bomber', 'precision player', 'scrambler', etc.
 * 
 * Example:
 *   GET /api/players/12345/archetype?includePeers=true
 * 
 * Returns player archetype classification with:
 * - Primary/secondary archetype matches
 * - SG signature analysis
 * - Performance metrics and peer comparisons
 * - Confidence scoring and match strength
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getQueryParams, handleApiError, jsonSuccess, jsonError } from '@/lib/api-utils';
import { PlayerArchetypeService } from '@/lib/services/player-archetype-service';
import { logger } from '@/lib/logger';

// Request validation schema
const playerArchetypeSchema = z.object({
  includeHistorical: z.string().optional().transform(val => val === 'true'),
  includePeers: z.string().optional().transform(val => val !== 'false'), // Default to true
  detailed: z.string().optional().transform(val => val === 'true')
});

// Initialize Player Archetype service
const playerArchetypeService = new PlayerArchetypeService();

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    logger.info('Player Archetype API request received');

    // Validate player ID
    const playerId = params.playerId;
    const dgId = parseInt(playerId);
    
    if (isNaN(dgId) || dgId <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'INVALID_PLAYER_ID',
          message: 'Invalid player ID. Must be a positive integer.',
          details: 400
        }
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate query parameters
    const queryParams = getQueryParams(request, playerArchetypeSchema);
    
    logger.info(`Analyzing player archetype for DG ID: ${dgId}`, {
      includeHistorical: queryParams.includeHistorical,
      includePeers: queryParams.includePeers,
      detailed: queryParams.detailed
    });

    // Classify player archetype
    const startTime = Date.now();
    const classification = await playerArchetypeService.classifyPlayerArchetype(dgId);
    const processingTime = Date.now() - startTime;

    if (!classification) {
      logger.warn(`No archetype classification available for player ${dgId}`);
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 'PLAYER_DATA_NOT_FOUND',
          message: `Archetype classification not available for player ID "${dgId}". This may be due to insufficient SG data or unrecognized player ID.`,
          details: 404
        }
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Filter response based on parameters
    let responseData = { ...classification };

    // Remove historical data if not requested
    if (!queryParams.includeHistorical) {
      responseData.historical_performance = {
        best_finishes: [],
        course_fit_examples: []
      };
    }

    // Remove peer comparisons if not requested
    if (!queryParams.includePeers) {
      responseData.similar_players = [];
    }

    // Simplify response if not detailed
    if (!queryParams.detailed) {
      // Keep only essential fields for basic response
      const basicResponse = {
        dg_id: responseData.dg_id,
        player_name: responseData.player_name,
        primary_archetype: responseData.primary_archetype,
        secondary_archetype: responseData.secondary_archetype,
        sg_signature: responseData.sg_signature,
        performance_metrics: {
          peak_performance_category: responseData.performance_metrics.peak_performance_category,
          weakness_category: responseData.performance_metrics.weakness_category,
          consistency_score: responseData.performance_metrics.consistency_score
        },
        analysis_metadata: {
          last_updated: responseData.analysis_metadata.last_updated,
          confidence_factors: responseData.analysis_metadata.confidence_factors
        }
      };
      responseData = basicResponse as any;
    }

    // Get available archetypes for reference
    const availableArchetypes = playerArchetypeService.getAvailableArchetypes();

    // Build final response
    const finalResponse = {
      success: true,
      data: responseData,
      available_archetypes: availableArchetypes,
      meta: {
        endpoint: '/api/players/[playerId]/archetype',
        version: '1.0',
        processing_time_ms: processingTime,
        parameters: {
          player_id: playerId,
          include_historical: queryParams.includeHistorical || false,
          include_peers: queryParams.includePeers !== false,
          detailed: queryParams.detailed || false
        }
      }
    };

    logger.info(`Player archetype classification completed successfully`, {
      playerId: dgId,
      playerName: classification.player_name,
      primaryArchetype: classification.primary_archetype.archetype_name,
      confidence: classification.primary_archetype.confidence,
      processing_time: processingTime
    });

    return jsonSuccess(finalResponse);

  } catch (error) {
    logger.error('Player Archetype API error:', error);
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
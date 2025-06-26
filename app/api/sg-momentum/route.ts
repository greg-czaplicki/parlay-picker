import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { handleApiError, jsonSuccess } from '@/lib/api-utils';
import { SGMomentumService } from '@/lib/services/sg-momentum-service';
import type { SGMomentumApiResponse } from '@/lib/types/course-dna';

/**
 * SG Momentum API
 * GET /api/sg-momentum - Live momentum analysis for tournaments
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dgId = searchParams.get('dgId');
    const eventName = searchParams.get('eventName');
    const batch = searchParams.get('batch') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    logger.info('SG Momentum API request:', { dgId, eventName, batch, limit });

    const momentumService = new SGMomentumService();

    // Single player momentum analysis
    if (dgId && eventName && !batch) {
      const momentum = await momentumService.analyzePlayerMomentum(
        parseInt(dgId), 
        eventName
      );

      if (!momentum) {
        return jsonSuccess({
          success: false,
          data: null,
          message: 'No momentum data available for this player/tournament combination'
        });
      }

      const response: SGMomentumApiResponse = {
        success: true,
        data: [momentum],
        tournament_context: {
          event_name: eventName,
          current_round: momentum.current_round,
          field_avg_momentum: 0, // TODO: Calculate field average
          hot_categories: getHotCategories([momentum]),
          cold_categories: getColdCategories([momentum])
        }
      };

      return jsonSuccess(response, `Momentum analysis complete for ${momentum.player_name}`);
    }

    // Batch momentum analysis for active tournaments
    if (batch) {
      const eventNames = eventName ? [eventName] : undefined;
      const momentumData = await momentumService.analyzeBatchMomentum(eventNames);
      
      // Apply limit
      const limitedData = momentumData.slice(0, limit);

      // Calculate tournament context
      const tournamentContext = calculateTournamentContext(limitedData);

      const response: SGMomentumApiResponse = {
        success: true,
        data: limitedData,
        tournament_context: tournamentContext
      };

      return jsonSuccess(
        response, 
        `Batch momentum analysis complete: ${limitedData.length} players analyzed`
      );
    }

    // Single tournament momentum analysis
    if (eventName && !dgId) {
      const eventMomentum = await momentumService.analyzeBatchMomentum([eventName]);
      const limitedData = eventMomentum.slice(0, limit);

      const tournamentContext = calculateTournamentContext(limitedData);

      const response: SGMomentumApiResponse = {
        success: true,
        data: limitedData,
        tournament_context: tournamentContext
      };

      return jsonSuccess(
        response,
        `Tournament momentum analysis complete for ${eventName}: ${limitedData.length} players`
      );
    }

    // Default: Get momentum for all active tournaments
    const allMomentum = await momentumService.analyzeBatchMomentum();
    const limitedData = allMomentum.slice(0, limit);

    const tournamentContext = calculateTournamentContext(limitedData);

    const response: SGMomentumApiResponse = {
      success: true,
      data: limitedData,
      tournament_context: tournamentContext
    };

    return jsonSuccess(
      response,
      `Active tournament momentum analysis: ${limitedData.length} players analyzed`
    );

  } catch (error) {
    logger.error('SG Momentum API error:', error);
    return handleApiError(error);
  }
}

/**
 * Calculate tournament-level momentum context
 */
function calculateTournamentContext(momentumData: any[]): SGMomentumApiResponse['tournament_context'] {
  if (momentumData.length === 0) {
    return {
      event_name: 'Unknown',
      current_round: 1,
      field_avg_momentum: 0,
      hot_categories: [],
      cold_categories: []
    };
  }

  // Get representative tournament info
  const firstPlayer = momentumData[0];
  const eventName = firstPlayer.event_name;
  const currentRound = Math.max(...momentumData.map(p => p.current_round));

  // Calculate field average momentum
  const fieldAvgMomentum = momentumData.reduce((sum, p) => sum + p.overall_momentum, 0) / momentumData.length;

  // Identify hot and cold categories across the field
  const hotCategories = getHotCategories(momentumData);
  const coldCategories = getColdCategories(momentumData);

  return {
    event_name: eventName,
    current_round: currentRound,
    field_avg_momentum: Math.round(fieldAvgMomentum * 100) / 100,
    hot_categories: hotCategories,
    cold_categories: coldCategories
  };
}

/**
 * Identify categories where players are trending hot
 */
function getHotCategories(momentumData: any[]): Array<'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt'> {
  const categories = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'] as const;
  const hotCategories: Array<'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt'> = [];

  for (const category of categories) {
    const hotCount = momentumData.filter(p => 
      p.momentum_indicators[category]?.current_trend === 'hot'
    ).length;
    
    const hotPercentage = hotCount / momentumData.length;
    
    // If more than 30% of players are hot in this category, consider it a hot category
    if (hotPercentage > 0.3) {
      hotCategories.push(category);
    }
  }

  return hotCategories;
}

/**
 * Identify categories where players are trending cold
 */
function getColdCategories(momentumData: any[]): Array<'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt'> {
  const categories = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'] as const;
  const coldCategories: Array<'sg_ott' | 'sg_app' | 'sg_arg' | 'sg_putt'> = [];

  for (const category of categories) {
    const coldCount = momentumData.filter(p => 
      p.momentum_indicators[category]?.current_trend === 'cold'
    ).length;
    
    const coldPercentage = coldCount / momentumData.length;
    
    // If more than 30% of players are cold in this category, consider it a cold category
    if (coldPercentage > 0.3) {
      coldCategories.push(category);
    }
  }

  return coldCategories;
} 
/**
 * Strokes Gained Calculation Service
 * Core engine for calculating strokes gained metrics
 */

import {
  SGCategory,
  LieType,
  ShotData,
  SGResult,
  SGSummary,
  SGBaseline,
  SGConfig,
  SGError,
  CourseAdjustment,
  ConditionsAdjustment
} from '../types/strokes-gained';
import { logger } from '../logger';

/**
 * Main Strokes Gained Calculation Engine
 */
export class StrokesGainedService {
  private config: SGConfig;
  private baselines: Map<string, SGBaseline>;

  constructor(config?: Partial<SGConfig>) {
    this.config = {
      baselineSource: 'pga_tour',
      useConditionsAdjustment: false,
      useCourseAdjustment: false,
      minShotsForCalculation: 1,
      roundingPrecision: 3,
      ...config
    };
    
    this.baselines = new Map();
    this.initializeBaselines();
  }

  /**
   * Calculate strokes gained for a single shot
   */
  calculateSingleShot(shotData: ShotData): SGResult | SGError {
    try {
      // Validate input data
      if (!this.isValidShotData(shotData)) {
        return {
          code: 'INVALID_SHOT_DATA',
          message: 'Invalid shot data provided',
          shotData
        };
      }

      // Determine SG category if not provided
      const category = shotData.category || this.classifyShot(shotData);
      
      // Get baseline expectations
      const startExpected = this.getExpectedStrokes(shotData.startDistance, shotData.startLie);
      const endExpected = shotData.outcome.holed ? 0 : 
        this.getExpectedStrokes(shotData.outcome.endDistance, shotData.outcome.endLie);
      
      // Calculate strokes taken (1 + any penalties)
      const shotTaken = 1 + (shotData.outcome.penalty ? 1 : 0);
      
      // Core SG calculation: Start Expected - End Expected - Strokes Taken
      const strokesGained = startExpected - endExpected - shotTaken;

      return {
        category,
        strokesGained: this.roundValue(strokesGained),
        startExpected: this.roundValue(startExpected),
        endExpected: this.roundValue(endExpected),
        shotTaken
      };

    } catch (error) {
      logger.error('[StrokesGainedService] Calculation error:', error);
      return {
        code: 'CALCULATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown calculation error',
        shotData
      };
    }
  }

  /**
   * Calculate SG Off The Tee specifically
   */
  calculateSG_OTT(distance: number, startLie: LieType, endDistance: number, endLie: LieType, holed: boolean = false): number {
    const shotData: ShotData = {
      startDistance: distance,
      startLie,
      outcome: {
        endDistance,
        endLie,
        holed,
        penalty: false
      },
      category: 'OTT'
    };

    const result = this.calculateSingleShot(shotData);
    return 'strokesGained' in result ? result.strokesGained : 0;
  }

  /**
   * Calculate SG Approach specifically  
   */
  calculateSG_APP(distance: number, startLie: LieType, endDistance: number, endLie: LieType, holed: boolean = false): number {
    const shotData: ShotData = {
      startDistance: distance,
      startLie,
      outcome: {
        endDistance,
        endLie,
        holed,
        penalty: false
      },
      category: 'APP'
    };

    const result = this.calculateSingleShot(shotData);
    return 'strokesGained' in result ? result.strokesGained : 0;
  }

  /**
   * Calculate SG Around the Green specifically
   */
  calculateSG_ARG(distance: number, startLie: LieType, endDistance: number, endLie: LieType, holed: boolean = false): number {
    const shotData: ShotData = {
      startDistance: distance,
      startLie,
      outcome: {
        endDistance,
        endLie,
        holed,
        penalty: false
      },
      category: 'ARG'
    };

    const result = this.calculateSingleShot(shotData);
    return 'strokesGained' in result ? result.strokesGained : 0;
  }

  /**
   * Calculate SG Putting specifically
   */
  calculateSG_PUTT(distance: number, holed: boolean = false): number {
    const shotData: ShotData = {
      startDistance: distance,
      startLie: 'green',
      outcome: {
        endDistance: holed ? 0 : Math.max(0, distance - 3), // Assume 3-foot improvement if not holed
        endLie: 'green',
        holed,
        penalty: false
      },
      category: 'PUTT'
    };

    const result = this.calculateSingleShot(shotData);
    return 'strokesGained' in result ? result.strokesGained : 0;
  }

  /**
   * Calculate aggregate SG summary for multiple shots
   */
  calculateSummary(shots: ShotData[]): SGSummary {
    const summary: SGSummary = {
      total: 0,
      OTT: 0,
      APP: 0,
      ARG: 0,
      PUTT: 0,
      shotsAnalyzed: 0
    };

    let validShots = 0;

    for (const shot of shots) {
      const result = this.calculateSingleShot(shot);
      
      if ('strokesGained' in result) {
        summary[result.category] += result.strokesGained;
        summary.total += result.strokesGained;
        validShots++;
      }
    }

    summary.shotsAnalyzed = validShots;
    
    // Round all values
    summary.total = this.roundValue(summary.total);
    summary.OTT = this.roundValue(summary.OTT);
    summary.APP = this.roundValue(summary.APP);
    summary.ARG = this.roundValue(summary.ARG);
    summary.PUTT = this.roundValue(summary.PUTT);

    return summary;
  }

  /**
   * Get expected strokes from a given position
   */
  private getExpectedStrokes(distance: number, lie: LieType): number {
    const key = this.getBaselineKey(distance, lie);
    const baseline = this.baselines.get(key);
    
    if (baseline) {
      return baseline.expectedStrokes;
    }

    // Fallback to interpolated baseline
    return this.interpolateBaseline(distance, lie);
  }

  /**
   * Classify shot into SG category based on distance and lie
   */
  private classifyShot(shotData: ShotData): SGCategory {
    const { startDistance, startLie } = shotData;

    // Putting: on green
    if (startLie === 'green') {
      return 'PUTT';
    }

    // Off the tee: from tee
    if (startLie === 'tee') {
      return 'OTT';
    }

    // Around the green: close to hole from off green
    if (startDistance <= 30) {
      return 'ARG';
    }

    // Everything else is approach
    return 'APP';
  }

  /**
   * Initialize baseline performance data
   * Starting with simplified PGA Tour averages
   */
  private initializeBaselines(): void {
    // Putting baselines (on green)
    const puttingDistances = [3, 5, 8, 10, 15, 20, 25, 30];
    const puttingExpected = [1.05, 1.15, 1.31, 1.41, 1.61, 1.78, 1.93, 2.07];
    
    puttingDistances.forEach((dist, i) => {
      this.baselines.set(`${dist}_green`, {
        distance: dist,
        lie: 'green',
        expectedStrokes: puttingExpected[i],
        holingPercentage: this.getPuttingHolingPercentage(dist)
      });
    });

    // Approach/ARG baselines
    const approachDistances = [0, 10, 20, 30, 40, 50, 75, 100, 125, 150, 175, 200, 225, 250];
    const fairwayExpected = [2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4];
    const roughExpected = [2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.5];

    approachDistances.forEach((dist, i) => {
      this.baselines.set(`${dist}_fairway`, {
        distance: dist,
        lie: 'fairway',
        expectedStrokes: fairwayExpected[i]
      });
      
      this.baselines.set(`${dist}_rough`, {
        distance: dist,
        lie: 'rough',
        expectedStrokes: roughExpected[i]
      });
    });

    // Tee shot baselines (longer distances)
    const teeDistances = [300, 350, 400, 450, 500, 550];
    const teeExpected = [3.8, 4.0, 4.2, 4.4, 4.6, 4.8];

    teeDistances.forEach((dist, i) => {
      this.baselines.set(`${dist}_tee`, {
        distance: dist,
        lie: 'tee',
        expectedStrokes: teeExpected[i]
      });
    });

    logger.info(`[StrokesGainedService] Initialized ${this.baselines.size} baseline data points`);
  }

  /**
   * Get putting holing percentage by distance
   */
  private getPuttingHolingPercentage(distance: number): number {
    if (distance <= 3) return 0.95;
    if (distance <= 5) return 0.75;
    if (distance <= 8) return 0.50;
    if (distance <= 10) return 0.35;
    if (distance <= 15) return 0.20;
    if (distance <= 20) return 0.12;
    if (distance <= 25) return 0.08;
    return 0.05;
  }

  /**
   * Interpolate baseline when exact distance/lie not found
   */
  private interpolateBaseline(distance: number, lie: LieType): number {
    // Simple fallback based on lie type and distance
    switch (lie) {
      case 'green':
        return 1.0 + (distance / 30) * 1.2; // Putting formula
      case 'tee':
        return 3.5 + (distance / 100) * 0.5; // Tee shot formula
      case 'fairway':
        return 2.0 + (distance / 100) * 0.8; // Fairway formula  
      case 'rough':
        return 2.1 + (distance / 100) * 0.9; // Rough penalty
      case 'bunker':
        return 2.3 + (distance / 100) * 1.0; // Bunker penalty
      case 'fringe':
        return 1.8 + (distance / 50) * 0.7;  // Fringe formula
      default:
        return 2.5 + (distance / 100) * 1.0; // Default fallback
    }
  }

  /**
   * Generate key for baseline lookup
   */
  private getBaselineKey(distance: number, lie: LieType): string {
    // Round distance to nearest baseline point
    const roundedDistance = this.roundToNearestBaseline(distance);
    return `${roundedDistance}_${lie}`;
  }

  /**
   * Round distance to nearest baseline point
   */
  private roundToNearestBaseline(distance: number): number {
    if (distance <= 30) return Math.round(distance / 5) * 5;  // 5-yard increments up to 30
    if (distance <= 100) return Math.round(distance / 10) * 10; // 10-yard increments to 100
    if (distance <= 250) return Math.round(distance / 25) * 25; // 25-yard increments to 250
    return Math.round(distance / 50) * 50; // 50-yard increments beyond
  }

  /**
   * Validate shot data
   */
  private isValidShotData(shotData: ShotData): boolean {
    return shotData.startDistance >= 0 && 
           shotData.outcome.endDistance >= 0 &&
           shotData.startDistance >= shotData.outcome.endDistance;
  }

  /**
   * Round value to configured precision
   */
  private roundValue(value: number): number {
    return Number(value.toFixed(this.config.roundingPrecision));
  }
}

// Export singleton instance
export const strokesGainedService = new StrokesGainedService(); 
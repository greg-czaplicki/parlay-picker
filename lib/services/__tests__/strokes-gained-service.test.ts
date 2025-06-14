/**
 * Tests for Strokes Gained Calculation Service
 */

import { StrokesGainedService } from '../strokes-gained-service';
import { ShotData, SGResult } from '../../types/strokes-gained';

describe('StrokesGainedService', () => {
  let service: StrokesGainedService;

  beforeEach(() => {
    service = new StrokesGainedService();
  });

  describe('Core SG Calculations', () => {
    test('should calculate SG for a good putting performance', () => {
      // 10-foot putt that goes in
      const result = service.calculateSG_PUTT(10, true);
      
      // Should be positive (good performance)
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
    });

    test('should calculate SG for a poor putting performance', () => {
      // 5-foot putt that misses
      const result = service.calculateSG_PUTT(5, false);
      
      // Should be negative (poor performance)
      expect(result).toBeLessThan(0);
      expect(typeof result).toBe('number');
    });

    test('should calculate SG_OTT for a good drive', () => {
      // 400-yard tee shot that ends up 150 yards in fairway
      const result = service.calculateSG_OTT(400, 'tee', 150, 'fairway', false);
      
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0); // Good drive should be positive
    });

    test('should calculate SG_APP for approach shot', () => {
      // 150-yard approach from fairway to 15 feet
      const result = service.calculateSG_APP(150, 'fairway', 15, 'green', false);
      
      expect(typeof result).toBe('number');
      // Good approach should be positive
    });

    test('should calculate SG_ARG for chip shot', () => {
      // 20-yard chip from rough to 5 feet
      const result = service.calculateSG_ARG(20, 'rough', 5, 'green', false);
      
      expect(typeof result).toBe('number');
    });
  });

  describe('Shot Classification', () => {
    test('should classify putting correctly', () => {
      const shotData: ShotData = {
        startDistance: 10,
        startLie: 'green',
        outcome: {
          endDistance: 0,
          endLie: 'green',
          holed: true,
          penalty: false
        }
      };

      const result = service.calculateSingleShot(shotData) as SGResult;
      expect(result.category).toBe('PUTT');
    });

    test('should classify tee shots correctly', () => {
      const shotData: ShotData = {
        startDistance: 400,
        startLie: 'tee',
        outcome: {
          endDistance: 150,
          endLie: 'fairway',
          holed: false,
          penalty: false
        }
      };

      const result = service.calculateSingleShot(shotData) as SGResult;
      expect(result.category).toBe('OTT');
    });

    test('should classify approach shots correctly', () => {
      const shotData: ShotData = {
        startDistance: 150,
        startLie: 'fairway',
        outcome: {
          endDistance: 15,
          endLie: 'green',
          holed: false,
          penalty: false
        }
      };

      const result = service.calculateSingleShot(shotData) as SGResult;
      expect(result.category).toBe('APP');
    });

    test('should classify around the green shots correctly', () => {
      const shotData: ShotData = {
        startDistance: 25,
        startLie: 'rough',
        outcome: {
          endDistance: 5,
          endLie: 'green',
          holed: false,
          penalty: false
        }
      };

      const result = service.calculateSingleShot(shotData) as SGResult;
      expect(result.category).toBe('ARG');
    });
  });

  describe('Summary Calculations', () => {
    test('should calculate round summary correctly', () => {
      const shots: ShotData[] = [
        // Tee shot
        {
          startDistance: 400,
          startLie: 'tee',
          outcome: { endDistance: 150, endLie: 'fairway', holed: false, penalty: false }
        },
        // Approach
        {
          startDistance: 150,
          startLie: 'fairway',
          outcome: { endDistance: 10, endLie: 'green', holed: false, penalty: false }
        },
        // Putt
        {
          startDistance: 10,
          startLie: 'green',
          outcome: { endDistance: 0, endLie: 'green', holed: true, penalty: false }
        }
      ];

      const summary = service.calculateSummary(shots);
      
      expect(summary.shotsAnalyzed).toBe(3);
      expect(summary.total).toBe(summary.OTT + summary.APP + summary.ARG + summary.PUTT);
      expect(typeof summary.OTT).toBe('number');
      expect(typeof summary.APP).toBe('number');
      expect(typeof summary.PUTT).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid shot data', () => {
      const invalidShot: ShotData = {
        startDistance: -10, // Invalid negative distance
        startLie: 'fairway',
        outcome: { endDistance: 0, endLie: 'green', holed: false, penalty: false }
      };

      const result = service.calculateSingleShot(invalidShot);
      expect('code' in result).toBe(true);
      expect((result as any).code).toBe('INVALID_SHOT_DATA');
    });

    test('should handle impossible shot data', () => {
      const impossibleShot: ShotData = {
        startDistance: 100,
        startLie: 'fairway',
        outcome: { 
          endDistance: 200, // Can't end up farther from hole
          endLie: 'rough', 
          holed: false, 
          penalty: false 
        }
      };

      const result = service.calculateSingleShot(impossibleShot);
      expect('code' in result).toBe(true);
    });
  });
}); 
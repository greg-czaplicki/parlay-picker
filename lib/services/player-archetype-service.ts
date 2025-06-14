/**
 * Player Archetype Classification Service
 * Analyzes player SG patterns to classify them into golf archetypes
 */

import { createSupabaseClient } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { 
  PlayerArchetypeClassification, 
  ArchetypeTemplate, 
  SGCategory 
} from '../types/player-archetype';

export class PlayerArchetypeService {
  private _supabase: any = null;
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * 🎯 CORE: Classify Player Archetype
   * Analyzes player's SG patterns and classifies into primary/secondary archetypes
   */
  async classifyPlayerArchetype(dgId: number): Promise<PlayerArchetypeClassification | null> {
    logger.info(`Classifying player archetype for DG ID: ${dgId}`);

    try {
      // Get player's SG data
      const playerData = await this.getPlayerSGData(dgId);
      if (!playerData) {
        logger.warn(`No SG data found for player ${dgId}`);
        return null;
      }

      // Get tour averages for relative comparison
      const tourAverages = await this.getTourAverages();
      
      // Calculate relative SG scores (z-scores)
      const relativeScores = await this.calculateRelativeScores(playerData, tourAverages);
      
      // Classify against all archetype templates
      const archetypeTemplates = this.getArchetypeTemplates();
      const classifications = this.classifyAgainstArchetypes(playerData, relativeScores, archetypeTemplates);
      
      // Find best and secondary matches
      const sortedClassifications = classifications.sort((a, b) => b.fit_score - a.fit_score);
      const primaryArchetype = sortedClassifications[0];
      const secondaryArchetype = sortedClassifications[1]?.fit_score > 60 ? sortedClassifications[1] : undefined;

      // Get performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(playerData);
      
      // Find similar players
      const similarPlayers = await this.findSimilarPlayers(dgId, playerData);

      return {
        dg_id: dgId,
        player_name: playerData.player_name,
        primary_archetype: {
          archetype_id: primaryArchetype.archetype_id,
          archetype_name: primaryArchetype.archetype_name,
          confidence: primaryArchetype.confidence,
          fit_score: primaryArchetype.fit_score,
          match_strength: this.getMatchStrength(primaryArchetype.fit_score)
        },
        secondary_archetype: secondaryArchetype ? {
          archetype_id: secondaryArchetype.archetype_id,
          archetype_name: secondaryArchetype.archetype_name,
          confidence: secondaryArchetype.confidence,
          fit_score: secondaryArchetype.fit_score,
          match_strength: this.getMatchStrength(secondaryArchetype.fit_score)
        } : undefined,
        sg_signature: {
          sg_ott: playerData.sg_ott,
          sg_app: playerData.sg_app,
          sg_arg: playerData.sg_arg,
          sg_putt: playerData.sg_putt,
          sg_total: playerData.sg_total
        },
        sg_relative_to_tour: relativeScores,
        performance_metrics: performanceMetrics,
        similar_players: similarPlayers,
        historical_performance: {
          best_finishes: [],
          course_fit_examples: []
        },
        analysis_metadata: {
          rounds_analyzed: 0,
          tournaments_analyzed: 0,
          years_analyzed: 2,
          data_freshness: 'fresh',
          last_updated: new Date().toISOString(),
          confidence_factors: this.getConfidenceFactors(playerData, primaryArchetype.fit_score)
        }
      };

    } catch (error) {
      logger.error(`Error classifying player archetype for ${dgId}:`, error);
      return null;
    }
  }

  /**
   * 📊 Get Player SG Data
   */
  private async getPlayerSGData(dgId: number) {
    const { data, error } = await this.supabase
      .from('player_skill_ratings')
      .select(`
        dg_id, player_name, 
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        updated_at
      `)
      .eq('dg_id', dgId)
      .single();

    if (error) {
      logger.error(`Error fetching player data for ${dgId}:`, error);
      return null;
    }

    return data;
  }

  /**
   * 📊 Get Tour Averages for Relative Scoring
   */
  private async getTourAverages() {
    const { data, error } = await this.supabase
      .from('player_skill_ratings')
      .select('sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .not('sg_total', 'is', null)
      .not('sg_ott', 'is', null)
      .not('sg_app', 'is', null)
      .not('sg_arg', 'is', null)
      .not('sg_putt', 'is', null);

    if (error || !data || data.length === 0) {
      // Fallback to reasonable tour averages
      return {
        sg_total: 0,
        sg_ott: 0,
        sg_app: 0,
        sg_arg: 0,
        sg_putt: 0
      };
    }

    // Calculate actual tour averages
    const avg = (arr: number[]) => arr.reduce((sum, val) => sum + val, 0) / arr.length;
    
    return {
      sg_total: avg(data.map((d: any) => d.sg_total)),
      sg_ott: avg(data.map((d: any) => d.sg_ott)),
      sg_app: avg(data.map((d: any) => d.sg_app)),
      sg_arg: avg(data.map((d: any) => d.sg_arg)),
      sg_putt: avg(data.map((d: any) => d.sg_putt))
    };
  }

  /**
   * 📊 Calculate Standard Deviations for Z-Score Calculation
   */
  private async getTourStandardDeviations() {
    const { data, error } = await this.supabase
      .from('player_skill_ratings')
      .select('sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .not('sg_total', 'is', null)
      .not('sg_ott', 'is', null)
      .not('sg_app', 'is', null)
      .not('sg_arg', 'is', null)
      .not('sg_putt', 'is', null);

    if (error || !data || data.length === 0) {
      // Fallback standard deviations
      return {
        sg_total: 0.8,
        sg_ott: 0.6,
        sg_app: 0.6,
        sg_arg: 0.5,
        sg_putt: 0.7
      };
    }

    const calculateStdDev = (values: number[], mean: number): number => {
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      return Math.sqrt(variance);
    };

    const tourAverages = await this.getTourAverages();

    return {
      sg_total: calculateStdDev(data.map((d: any) => d.sg_total), tourAverages.sg_total),
      sg_ott: calculateStdDev(data.map((d: any) => d.sg_ott), tourAverages.sg_ott),
      sg_app: calculateStdDev(data.map((d: any) => d.sg_app), tourAverages.sg_app),
      sg_arg: calculateStdDev(data.map((d: any) => d.sg_arg), tourAverages.sg_arg),
      sg_putt: calculateStdDev(data.map((d: any) => d.sg_putt), tourAverages.sg_putt)
    };
  }

  /**
   * 📊 Calculate Relative Scores (Z-Scores)
   */
  private async calculateRelativeScores(playerData: any, tourAverages: any) {
    const stdDeviations = await this.getTourStandardDeviations();

    return {
      sg_total: (playerData.sg_total - tourAverages.sg_total) / stdDeviations.sg_total,
      sg_ott: (playerData.sg_ott - tourAverages.sg_ott) / stdDeviations.sg_ott,
      sg_app: (playerData.sg_app - tourAverages.sg_app) / stdDeviations.sg_app,
      sg_arg: (playerData.sg_arg - tourAverages.sg_arg) / stdDeviations.sg_arg,
      sg_putt: (playerData.sg_putt - tourAverages.sg_putt) / stdDeviations.sg_putt
    };
  }

  /**
   * 🏷️ Get Archetype Templates
   */
  private getArchetypeTemplates(): ArchetypeTemplate[] {
    return [
      {
        archetype_id: 'bomber',
        name: 'Bomber',
        description: 'Distance-focused player who excels off the tee and relies on length advantage',
        key_characteristics: ['Exceptional driving distance', 'Aggressive course management', 'Power-based approach'],
        sg_requirements: {
          sg_ott: { min: 0.3, importance: 80 },
          sg_app: { importance: 40 },
          sg_arg: { importance: 30 },
          sg_putt: { importance: 50 }
        },
        example_players: ['Bryson DeChambeau', 'Cameron Champ', 'Rory McIlroy'],
        typical_course_success: ['Long courses', 'Wide fairways', 'Firm conditions']
      },
      {
        archetype_id: 'precision_player',
        name: 'Precision Player',
        description: 'Accurate iron player who excels at approach shots and course management',
        key_characteristics: ['Exceptional iron accuracy', 'Strategic course management', 'Consistent ball-striking'],
        sg_requirements: {
          sg_ott: { importance: 30 },
          sg_app: { min: 0.4, importance: 85 },
          sg_arg: { importance: 50 },
          sg_putt: { importance: 40 }
        },
        example_players: ['Collin Morikawa', 'Justin Thomas', 'Paul Casey'],
        typical_course_success: ['Tight layouts', 'Premium on accuracy', 'Firm greens']
      },
      {
        archetype_id: 'scrambler',
        name: 'Scrambler',
        description: 'Short game specialist who excels around the greens and in recovery situations',
        key_characteristics: ['Exceptional short game', 'Creative shot-making', 'Up-and-down conversion'],
        sg_requirements: {
          sg_ott: { importance: 20 },
          sg_app: { importance: 40 },
          sg_arg: { min: 0.4, importance: 90 },
          sg_putt: { importance: 60 }
        },
        example_players: ['Jordan Spieth', 'Jason Day', 'Phil Mickelson'],
        typical_course_success: ['Rough penalties', 'Challenging pin positions', 'Undulating greens']
      },
      {
        archetype_id: 'putting_wizard',
        name: 'Putting Wizard',
        description: 'Exceptional putter who gains significant strokes on the greens',
        key_characteristics: ['Elite putting performance', 'Green reading ability', 'Clutch putting'],
        sg_requirements: {
          sg_ott: { importance: 30 },
          sg_app: { importance: 40 },
          sg_arg: { importance: 40 },
          sg_putt: { min: 0.5, importance: 85 }
        },
        example_players: ['Justin Rose', 'Adam Scott', 'Brandt Snedeker'],
        typical_course_success: ['Fast greens', 'Subtle breaks', 'Pressure situations']
      },
      {
        archetype_id: 'all_around_elite',
        name: 'All-Around Elite',
        description: 'Elite player who excels in all areas with no significant weaknesses',
        key_characteristics: ['No significant weaknesses', 'Consistent excellence', 'Adaptable game'],
        sg_requirements: {
          sg_ott: { min: 0.2, importance: 70 },
          sg_app: { min: 0.2, importance: 70 },
          sg_arg: { min: 0.1, importance: 60 },
          sg_putt: { min: 0.1, importance: 60 }
        },
        example_players: ['Scottie Scheffler', 'Jon Rahm', 'Dustin Johnson'],
        typical_course_success: ['Major championships', 'Varied course types', 'High-pressure events']
      },
      {
        archetype_id: 'steady_eddie',
        name: 'Steady Eddie',
        description: 'Consistent player who avoids big mistakes and excels in course management',
        key_characteristics: ['High consistency', 'Avoid big numbers', 'Strategic approach'],
        sg_requirements: {
          sg_ott: { min: -0.2, max: 0.3, importance: 50 },
          sg_app: { min: -0.1, max: 0.4, importance: 60 },
          sg_arg: { min: -0.1, max: 0.3, importance: 50 },
          sg_putt: { min: -0.1, max: 0.4, importance: 60 }
        },
        example_players: ['Webb Simpson', 'Kevin Kisner', 'Brian Harman'],
        typical_course_success: ['Consistent conditions', 'Strategic layouts', 'Endurance events']
      }
    ];
  }

  /**
   * 🔍 Classify Against All Archetypes
   */
  private classifyAgainstArchetypes(playerData: any, relativeScores: any, templates: ArchetypeTemplate[]) {
    const classifications = [];

    for (const template of templates) {
      const fitScore = this.calculateArchetypeFitScore(playerData, relativeScores, template);
      const confidence = this.calculateConfidence(relativeScores, template, fitScore);

      classifications.push({
        archetype_id: template.archetype_id,
        archetype_name: template.name,
        fit_score: fitScore,
        confidence: confidence,
        template: template
      });
    }

    return classifications;
  }

  /**
   * 📊 Calculate Archetype Fit Score
   */
  private calculateArchetypeFitScore(playerData: any, relativeScores: any, template: ArchetypeTemplate): number {
    let totalScore = 0;
    let totalWeight = 0;

    const categories = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'] as const;

    for (const category of categories) {
      const requirement = template.sg_requirements[category];
      const playerScore = relativeScores[category];
      const importance = requirement.importance / 100;

      let categoryScore = 50; // Base score

      // Check minimum requirements
      if (requirement.min !== undefined) {
        if (playerScore >= requirement.min) {
          categoryScore += Math.min(30, (playerScore - requirement.min) * 15);
        } else {
          categoryScore -= (requirement.min - playerScore) * 20;
        }
      }

      // Check maximum requirements (for balanced archetypes)
      if (requirement.max !== undefined) {
        if (playerScore <= requirement.max) {
          categoryScore += 20;
        } else {
          categoryScore -= (playerScore - requirement.max) * 10;
        }
      }

      // Reward strength in important categories
      if (playerScore > 0.5 && importance > 0.7) {
        categoryScore += 20;
      }

      totalScore += categoryScore * importance;
      totalWeight += importance;
    }

    return Math.max(0, Math.min(100, Math.round(totalScore / totalWeight)));
  }

  /**
   * 📊 Calculate Classification Confidence
   */
  private calculateConfidence(relativeScores: any, template: ArchetypeTemplate, fitScore: number): number {
    let confidence = fitScore * 0.8; // Base confidence from fit score

    // Boost confidence for clear strengths/weaknesses alignment
    const categories: SGCategory[] = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    
    for (const category of categories) {
      const requirement = template.sg_requirements[category];
      const playerScore = relativeScores[category];
      
      if (requirement.importance > 70) {
        if (requirement.min && playerScore >= requirement.min + 0.3) {
          confidence += 10; // Clear strength in important category
        }
        if (requirement.min && playerScore < requirement.min - 0.3) {
          confidence -= 15; // Clear weakness in important category
        }
      }
    }

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * 📊 Calculate Performance Metrics
   */
  private calculatePerformanceMetrics(playerData: any) {
    const categories: SGCategory[] = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    
    // Find peak and weakness categories
    const categoryScores = categories.map(cat => ({
      category: cat,
      score: playerData[cat]
    }));
    
    const peakCategory = categoryScores.reduce((a, b) => a.score > b.score ? a : b).category;
    const weaknessCategory = categoryScores.reduce((a, b) => a.score < b.score ? a : b).category;

    // Calculate consistency score (inverse of coefficient of variation)
    const scores = categories.map(cat => playerData[cat]).filter(score => score !== null);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, Math.min(100, Math.round((1 - (stdDev / Math.abs(mean))) * 100)));

    return {
      consistency_score: consistencyScore,
      volatility_score: Math.round(stdDev * 50), // Convert to 0-100 scale
      improvement_trend: 'stable' as const, // TODO: Calculate from historical data
      peak_performance_category: peakCategory,
      weakness_category: weaknessCategory
    };
  }

  /**
   * 👥 Find Similar Players
   */
  private async findSimilarPlayers(dgId: number, playerData: any) {
    const { data, error } = await this.supabase
      .from('player_skill_ratings')
      .select('dg_id, player_name, sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .neq('dg_id', dgId)
      .not('sg_total', 'is', null)
      .not('sg_ott', 'is', null)
      .not('sg_app', 'is', null)
      .not('sg_arg', 'is', null)
      .not('sg_putt', 'is', null)
      .limit(50);

    if (error || !data) {
      return [];
    }

    // Calculate similarity scores
    const similarities = data.map(player => {
      const similarity = this.calculateSimilarityScore(playerData, player);
      return {
        dg_id: player.dg_id,
        player_name: player.player_name,
        similarity_score: similarity,
        shared_archetype: 'Unknown' // TODO: Classify these players too
      };
    });

    // Return top 5 most similar players
    return similarities
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 5);
  }

  /**
   * 📊 Calculate Similarity Score Between Players
   */
  private calculateSimilarityScore(player1: any, player2: any): number {
    const categories: SGCategory[] = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    
    let totalDifference = 0;
    let validComparisons = 0;

    for (const category of categories) {
      if (player1[category] !== null && player2[category] !== null) {
        const difference = Math.abs(player1[category] - player2[category]);
        totalDifference += difference;
        validComparisons++;
      }
    }

    if (validComparisons === 0) return 0;

    // Convert average difference to similarity score (0-100)
    const avgDifference = totalDifference / validComparisons;
    const similarity = Math.max(0, Math.min(100, Math.round((2 - avgDifference) * 50)));
    
    return similarity;
  }

  /**
   * 🎯 Helper Methods
   */
  private getMatchStrength(fitScore: number): 'strong' | 'moderate' | 'weak' {
    if (fitScore >= 80) return 'strong';
    if (fitScore >= 60) return 'moderate';
    return 'weak';
  }

  private getConfidenceFactors(playerData: any, fitScore: number): string[] {
    const factors = [];
    
    if (playerData.sg_total > 1) factors.push('Elite overall performance');
    if (fitScore > 85) factors.push('Strong archetype match');
    if (playerData.updated_at) factors.push('Recent data available');
    
    return factors;
  }

  /**
   * 📊 Get Available Archetypes
   */
  getAvailableArchetypes() {
    return this.getArchetypeTemplates().map(template => ({
      archetype_id: template.archetype_id,
      archetype_name: template.name,
      description: template.description,
      example_players: template.example_players
    }));
  }
}

export const playerArchetypeService = new PlayerArchetypeService(); 
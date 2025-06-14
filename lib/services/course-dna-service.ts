/**
 * Course DNA Analysis Service
 * Analyzes historical SG data to determine what skills each course rewards
 */

import { createSupabaseClient } from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { CourseDNAProfile, PlayerCourseFit } from '../types/course-dna';

export class CourseDNAService {
  private _supabase: any = null;
  
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createSupabaseClient();
    }
    return this._supabase;
  }

  /**
   * 🎯 CORE: Generate Course DNA Profile
   * "What SG categories separate winners from field at this course?"
   */
  async generateCourseDNAProfile(eventName: string): Promise<CourseDNAProfile | null> {
    logger.info(`Analyzing Course DNA for ${eventName}`);

    try {
      // Get historical data
      const data = await this.getHistoricalSGData(eventName);
      
      if (data.length < 100) {
        logger.warn(`Insufficient data for ${eventName} analysis`);
        return null;
      }

      // Analyze winners vs field
      const analysis = this.analyzeWinnerPatterns(data);
      
      // Calculate category weights
      const weights = this.calculateCategoryWeights(analysis);
      
             return {
         event_name: eventName,
         sg_category_weights: weights,
         total_rounds_analyzed: data.length,
         tournaments_analyzed: new Set(data.map((d: any) => this.getYear(d))).size,
         years_analyzed: 5,
         confidence_score: 0.8,
         winning_sg_thresholds: {
           sg_ott: analysis.winnerAvg.sg_ott || 0,
           sg_app: analysis.winnerAvg.sg_app || 0,
           sg_arg: analysis.winnerAvg.sg_arg || 0,
           sg_putt: analysis.winnerAvg.sg_putt || 0,
           sg_total: analysis.winnerAvg.sg_total || 0
         },
         round_importance: { round1: 20, round2: 30, round3: 25, round4: 25 },
         course_type: 'unknown',
         difficulty_rating: 5,
         weather_impact: 'medium',
         last_updated: new Date().toISOString(),
         created_at: new Date().toISOString()
       };

    } catch (error) {
      logger.error(`Error generating Course DNA for ${eventName}:`, error);
      return null;
    }
  }

  /**
   * 📊 Get Historical SG Data
   */
  private async getHistoricalSGData(eventName: string) {
    const { data } = await this.supabase
      .from('live_tournament_stats')
      .select(`
        event_name, dg_id, player_name, position,
        sg_total, sg_ott, sg_app, sg_arg, sg_putt,
        data_golf_updated_at
      `)
      .eq('event_name', eventName)
      .not('sg_total', 'is', null)
      .order('data_golf_updated_at', { ascending: false })
      .limit(500);

    return data || [];
  }

  /**
   * 🏆 Analyze Winner vs Field Patterns
   */
  private analyzeWinnerPatterns(data: any[]) {
    // Group by year and get winners
    const tournaments = this.groupByYear(data);
    const winners: any[] = [];
    const field: any[] = [];

         for (const tournament of tournaments) {
       const sorted = tournament.sort((a: any, b: any) => this.parsePosition(a.position) - this.parsePosition(b.position));
       
       if (sorted.length > 20) {
         const winner = sorted[0];
         if (this.hasValidSG(winner)) {
           winners.push(winner);
         }
         
         field.push(...sorted.filter((p: any) => this.hasValidSG(p)));
       }
    }

    const winnerAvg = this.calculateAverages(winners);
    const fieldAvg = this.calculateAverages(field);

    return { winners, field, winnerAvg, fieldAvg };
  }

  /**
   * ⚖️ Calculate SG Category Weights
   * "Convert winner advantages into percentage importance"
   */
  private calculateCategoryWeights(analysis: any) {
    const categories = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    const edges: Record<string, number> = {};
    let totalEdge = 0;

    // Calculate winner edge over field
    for (const cat of categories) {
      const edge = Math.max(0, (analysis.winnerAvg[cat] || 0) - (analysis.fieldAvg[cat] || 0));
      edges[cat] = edge;
      totalEdge += edge;
    }

    // Convert to percentages
    const weights = { sg_ott: 25, sg_app: 25, sg_arg: 25, sg_putt: 25 };
    
    if (totalEdge > 0) {
      weights.sg_ott = Math.round((edges.sg_ott / totalEdge) * 100);
      weights.sg_app = Math.round((edges.sg_app / totalEdge) * 100);
      weights.sg_arg = Math.round((edges.sg_arg / totalEdge) * 100);
      weights.sg_putt = Math.round((edges.sg_putt / totalEdge) * 100);
    }

    logger.info(`Course DNA weights calculated:`, weights);
    return weights;
  }

  /**
   * 🎯 Player Course Fit Analysis
   */
  async analyzePlayerCourseFit(dgId: number, eventName: string): Promise<PlayerCourseFit | null> {
    try {
      const courseDNA = await this.generateCourseDNAProfile(eventName);
      const playerSG = await this.getPlayerSG(dgId);
      
      if (!courseDNA || !playerSG) return null;

      const fitScore = this.calculateFitScore(playerSG, courseDNA);
      
      return {
        dg_id: dgId,
        player_name: playerSG.player_name,
        event_name: eventName,
        fit_score: fitScore.overall,
        fit_grade: this.scoreToGrade(fitScore.overall),
        category_fit: fitScore.breakdown,
        historical_results: [],
        predicted_finish_range: {
          optimistic: Math.max(1, Math.round(120 - fitScore.overall)),
          realistic: Math.max(1, Math.round(140 - fitScore.overall)),
          pessimistic: Math.max(1, Math.round(160 - fitScore.overall))
        },
        confidence_level: 0.7
      };

    } catch (error) {
      logger.error(`Error analyzing course fit:`, error);
      return null;
    }
  }

  // Helper Methods
  private groupByYear(data: any[]) {
    const groups = new Map();
    for (const record of data) {
      const year = this.getYear(record);
      if (!groups.has(year)) groups.set(year, []);
      groups.get(year).push(record);
    }
    return Array.from(groups.values());
  }

  private getYear(record: any): number {
    return new Date(record.data_golf_updated_at).getFullYear();
  }

  private parsePosition(pos: string | null): number {
    if (!pos || pos === 'CUT' || pos === 'WD') return 999;
    const match = pos.match(/\d+/);
    return match ? parseInt(match[0]) : 999;
  }

  private hasValidSG(player: any): boolean {
    return player.sg_total !== null && player.sg_ott !== null && 
           player.sg_app !== null && player.sg_arg !== null && player.sg_putt !== null;
  }

  private calculateAverages(players: any[]) {
    const cats = ['sg_total', 'sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    const avg: Record<string, number> = {};
    
    for (const cat of cats) {
      const values = players.map(p => p[cat]).filter(v => v !== null);
      avg[cat] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    return avg;
  }

  private async getPlayerSG(dgId: number) {
    const { data } = await this.supabase
      .from('player_skill_ratings')
      .select('player_name, sg_total, sg_ott, sg_app, sg_arg, sg_putt')
      .eq('dg_id', dgId)
      .single();

    return data;
  }

  private calculateFitScore(playerSG: any, courseDNA: CourseDNAProfile) {
    const categories = ['sg_ott', 'sg_app', 'sg_arg', 'sg_putt'];
    let totalScore = 0;
    const breakdown: any = {};

         for (const cat of categories) {
       const playerStrength = playerSG[cat] || 0;
       const courseImportance = (courseDNA.sg_category_weights as any)[cat] / 100;
       const contribution = playerStrength * courseImportance * 25; // Scale factor
       
       totalScore += contribution;
       breakdown[cat] = {
         player_strength: playerStrength,
         course_importance: courseImportance,
         fit_contribution: contribution
       };
     }

    return {
      overall: Math.max(0, Math.min(100, Math.round(totalScore + 50))),
      breakdown
    };
  }

  private scoreToGrade(score: number): PlayerCourseFit['fit_grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    return 'D';
  }
}

export const courseDNAService = new CourseDNAService(); 
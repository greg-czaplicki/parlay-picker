import { RoundCompletionDetector } from './round-completion-detector';
import { MatchupResultProcessor } from './matchup-result-processor';
import { MatchupFilterPerformanceEngine } from './matchup-filter-performance-engine';
import { FilterPreset } from '@/types/matchup-filters';

export interface PipelineConfig {
  enabled: boolean;
  checkIntervalMinutes: number;
  minCompletionPercentage: number;
  processOnlyNewRounds: boolean;
  enableHistoricalUpdate: boolean;
  notificationWebhookUrl?: string;
}

export interface PipelineRunResult {
  runId: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  error?: string;
  
  // Stats
  roundsChecked: number;
  roundsCompleted: number;
  roundsProcessed: number;
  roundsSkipped: number;
  resultsIngested: number;
  performanceSnapshotsCreated: number;
  
  // Details
  processedRounds: Array<{
    eventId: number;
    roundNum: number;
    success: boolean;
    error?: string;
    resultsCount: number;
    snapshotsCount: number;
  }>;
  
  // Performance summary
  filterPerformanceUpdates: Array<{
    filterPreset: FilterPreset;
    newEdge: number;
    confidenceChange: number;
  }>;
}

export class AutomatedPerformancePipeline {
  private supabaseClient: any;
  private config: PipelineConfig;
  private isRunning: boolean = false;
  private lastRunTime: Date | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(supabaseClient: any, config: Partial<PipelineConfig> = {}) {
    this.supabaseClient = supabaseClient;
    this.config = {
      enabled: config.enabled ?? true,
      checkIntervalMinutes: config.checkIntervalMinutes ?? 60, // Check every hour
      minCompletionPercentage: config.minCompletionPercentage ?? 80,
      processOnlyNewRounds: config.processOnlyNewRounds ?? true,
      enableHistoricalUpdate: config.enableHistoricalUpdate ?? true,
      notificationWebhookUrl: config.notificationWebhookUrl,
      ...config
    };
  }

  /**
   * Start the automated pipeline
   */
  start(): void {
    if (!this.config.enabled || this.intervalId) {
      console.log('Pipeline already running or disabled');
      return;
    }

    console.log(`Starting automated performance pipeline (check every ${this.config.checkIntervalMinutes} minutes)`);
    
    // Run immediately on start
    this.runPipeline();
    
    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runPipeline();
    }, this.config.checkIntervalMinutes * 60 * 1000);
  }

  /**
   * Stop the automated pipeline
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Automated performance pipeline stopped');
    }
  }

  /**
   * Run the complete pipeline once
   */
  async runPipeline(): Promise<PipelineRunResult> {
    const runId = `run-${Date.now()}`;
    const startTime = new Date();
    
    console.log(`🚀 Starting pipeline run ${runId}`);

    if (this.isRunning) {
      const result: PipelineRunResult = {
        runId,
        startTime,
        endTime: new Date(),
        success: false,
        error: 'Pipeline already running',
        roundsChecked: 0,
        roundsCompleted: 0,
        roundsProcessed: 0,
        roundsSkipped: 0,
        resultsIngested: 0,
        performanceSnapshotsCreated: 0,
        processedRounds: [],
        filterPerformanceUpdates: []
      };
      return result;
    }

    this.isRunning = true;

    try {
      // Step 1: Check for completed rounds
      console.log('📊 Checking for completed rounds...');
      const detector = new RoundCompletionDetector(this.supabaseClient, {
        minCompletionPercentage: this.config.minCompletionPercentage
      });

      const allRounds = await detector.checkAllActiveRounds();
      const completedRounds = allRounds.filter(r => r.isComplete);
      
      console.log(`Found ${completedRounds.length} completed rounds out of ${allRounds.length} total`);

      const processedRounds: PipelineRunResult['processedRounds'] = [];
      let totalResultsIngested = 0;
      let totalSnapshotsCreated = 0;

      // Step 2: Process each completed round
      for (const round of completedRounds) {
        try {
          // Check if we should skip this round
          if (this.config.processOnlyNewRounds) {
            const { data: existingResults } = await this.supabaseClient
              .from('matchup_results')
              .select('id')
              .eq('event_id', round.eventId)
              .eq('round_num', round.roundNum)
              .limit(1);

            if (existingResults && existingResults.length > 0) {
              console.log(`Skipping round ${round.roundNum} for event ${round.eventId} - already processed`);
              processedRounds.push({
                eventId: round.eventId,
                roundNum: round.roundNum,
                success: true,
                resultsCount: 0,
                snapshotsCount: 0
              });
              continue;
            }
          }

          console.log(`🔄 Processing round ${round.roundNum} for event ${round.eventId}`);

          // Step 2a: Ingest matchup results
          const processor = new MatchupResultProcessor(this.supabaseClient);
          const ingestionResult = await processor.ingestEventRoundResults(round.eventId, round.roundNum);

          if (ingestionResult.saved === 0) {
            console.log(`No results to ingest for round ${round.roundNum}, event ${round.eventId}`);
            processedRounds.push({
              eventId: round.eventId,
              roundNum: round.roundNum,
              success: true,
              resultsCount: 0,
              snapshotsCount: 0
            });
            continue;
          }

          // Step 2b: Run filter performance analysis
          const analysisResult = await this.analyzeFilterPerformance(round.eventId, round.roundNum);

          processedRounds.push({
            eventId: round.eventId,
            roundNum: round.roundNum,
            success: true,
            resultsCount: ingestionResult.saved,
            snapshotsCount: analysisResult.snapshotsCreated
          });

          totalResultsIngested += ingestionResult.saved;
          totalSnapshotsCreated += analysisResult.snapshotsCreated;

        } catch (error) {
          console.error(`Error processing round ${round.roundNum} for event ${round.eventId}:`, error);
          processedRounds.push({
            eventId: round.eventId,
            roundNum: round.roundNum,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            resultsCount: 0,
            snapshotsCount: 0
          });
        }
      }

      // Step 3: Update historical performance data
      let filterPerformanceUpdates: PipelineRunResult['filterPerformanceUpdates'] = [];
      if (this.config.enableHistoricalUpdate && totalSnapshotsCreated > 0) {
        console.log('📈 Updating historical performance data...');
        filterPerformanceUpdates = await this.updateHistoricalPerformance();
      }

      const endTime = new Date();
      const result: PipelineRunResult = {
        runId,
        startTime,
        endTime,
        success: true,
        roundsChecked: allRounds.length,
        roundsCompleted: completedRounds.length,
        roundsProcessed: processedRounds.filter(r => r.success).length,
        roundsSkipped: processedRounds.filter(r => r.resultsCount === 0).length,
        resultsIngested: totalResultsIngested,
        performanceSnapshotsCreated: totalSnapshotsCreated,
        processedRounds,
        filterPerformanceUpdates
      };

      this.lastRunTime = endTime;
      
      console.log(`✅ Pipeline run ${runId} completed successfully`);
      console.log(`   - Processed: ${result.roundsProcessed}/${result.roundsCompleted} rounds`);
      console.log(`   - Results ingested: ${result.resultsIngested}`);
      console.log(`   - Performance snapshots: ${result.performanceSnapshotsCreated}`);

      // Send notification if configured
      if (this.config.notificationWebhookUrl && (result.resultsIngested > 0 || result.performanceSnapshotsCreated > 0)) {
        await this.sendNotification(result);
      }

      return result;

    } catch (error) {
      console.error(`❌ Pipeline run ${runId} failed:`, error);
      
      const result: PipelineRunResult = {
        runId,
        startTime,
        endTime: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        roundsChecked: 0,
        roundsCompleted: 0,
        roundsProcessed: 0,
        roundsSkipped: 0,
        resultsIngested: 0,
        performanceSnapshotsCreated: 0,
        processedRounds: [],
        filterPerformanceUpdates: []
      };

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Analyze filter performance for a specific event/round
   */
  private async analyzeFilterPerformance(eventId: number, roundNum: number): Promise<{
    snapshotsCreated: number;
  }> {
    try {
      // This would typically call the filter analysis API endpoint
      const response = await fetch(`/api/filter-analysis/${eventId}/${roundNum}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReanalysis: false })
      });

      if (!response.ok) {
        throw new Error(`Filter analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        snapshotsCreated: result.snapshotsCreated || 0
      };

    } catch (error) {
      console.error('Error in filter performance analysis:', error);
      return { snapshotsCreated: 0 };
    }
  }

  /**
   * Update historical performance data across all filters
   */
  private async updateHistoricalPerformance(): Promise<Array<{
    filterPreset: FilterPreset;
    newEdge: number;
    confidenceChange: number;
  }>> {
    try {
      const filterPresets: FilterPreset[] = ['fade-chalk', 'stat-dom', 'form-play', 'value', 'data-intel'];
      const updates: Array<{ filterPreset: FilterPreset; newEdge: number; confidenceChange: number }> = [];

      for (const preset of filterPresets) {
        // Get current historical data
        const { data: currentHistorical } = await this.supabaseClient
          .from('filter_historical_performance')
          .select('*')
          .eq('filter_preset', preset)
          .eq('analysis_period', 'last_30_days')
          .single();

        // Calculate new metrics from recent snapshots
        const { data: recentSnapshots } = await this.supabaseClient
          .from('filter_performance_snapshots')
          .select('*')
          .eq('filter_preset', preset)
          .gte('analysis_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('analysis_timestamp', { ascending: false });

        if (recentSnapshots && recentSnapshots.length > 0) {
          // Calculate aggregated metrics
          const totalFlagged = recentSnapshots.reduce((sum, s) => sum + s.matchups_flagged_by_filter, 0);
          const totalWon = recentSnapshots.reduce((sum, s) => sum + s.flagged_matchups_won, 0);
          const avgEdge = recentSnapshots.reduce((sum, s) => sum + (s.edge_detected || 0), 0) / recentSnapshots.length;
          const avgWinRate = recentSnapshots.reduce((sum, s) => sum + (s.win_rate || 0), 0) / recentSnapshots.length;
          
          // Calculate confidence score based on sample size and consistency
          const sampleSizeScore = Math.min(1, totalFlagged / 100);
          const edgeConsistency = this.calculateConsistency(recentSnapshots.map(s => s.edge_detected || 0));
          const confidenceScore = (sampleSizeScore * 0.7) + ((1 - edgeConsistency) * 0.3);

          // Determine trend
          const recentEdges = recentSnapshots.slice(0, 10).map(s => s.edge_detected || 0);
          const olderEdges = recentSnapshots.slice(-10).map(s => s.edge_detected || 0);
          const recentAvg = recentEdges.reduce((sum, e) => sum + e, 0) / recentEdges.length;
          const olderAvg = olderEdges.reduce((sum, e) => sum + e, 0) / olderEdges.length;
          
          let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
          if (recentAvg > olderAvg + 0.02) trendDirection = 'improving';
          else if (recentAvg < olderAvg - 0.02) trendDirection = 'declining';

          // Update or insert historical record
          const historicalRecord = {
            filter_preset: preset,
            analysis_period: 'last_30_days',
            start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            total_events_analyzed: new Set(recentSnapshots.map(s => s.event_id)).size,
            total_rounds_analyzed: recentSnapshots.length,
            total_matchups_analyzed: recentSnapshots.reduce((sum, s) => sum + s.total_matchups_analyzed, 0),
            total_matchups_flagged: totalFlagged,
            total_flagged_wins: totalWon,
            overall_win_rate: avgWinRate,
            overall_expected_win_rate: 0.5, // Simplified
            overall_edge: avgEdge,
            overall_roi: recentSnapshots.reduce((sum, s) => sum + (s.roi_percentage || 0), 0) / recentSnapshots.length,
            confidence_score: confidenceScore,
            consistency_score: 1 - edgeConsistency,
            trend_direction: trendDirection,
            trend_strength: Math.abs(recentAvg - olderAvg),
            last_updated: new Date().toISOString()
          };

          await this.supabaseClient
            .from('filter_historical_performance')
            .upsert(historicalRecord, {
              onConflict: 'filter_preset,analysis_period'
            });

          updates.push({
            filterPreset: preset,
            newEdge: avgEdge,
            confidenceChange: confidenceScore - (currentHistorical?.confidence_score || 0)
          });
        }
      }

      return updates;

    } catch (error) {
      console.error('Error updating historical performance:', error);
      return [];
    }
  }

  /**
   * Calculate consistency (variance) of a series of values
   */
  private calculateConsistency(values: number[]): number {
    if (values.length <= 1) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance); // Standard deviation as consistency measure
  }

  /**
   * Send notification about pipeline results
   */
  private async sendNotification(result: PipelineRunResult): Promise<void> {
    if (!this.config.notificationWebhookUrl) return;

    try {
      const payload = {
        text: `🏌️ Filter Performance Pipeline Update`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Pipeline Run Completed*\n` +
                   `• Rounds processed: ${result.roundsProcessed}\n` +
                   `• Results ingested: ${result.resultsIngested}\n` +
                   `• Performance snapshots: ${result.performanceSnapshotsCreated}\n` +
                   `• Duration: ${Math.round((result.endTime.getTime() - result.startTime.getTime()) / 1000)}s`
            }
          }
        ]
      };

      await fetch(this.config.notificationWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    isRunning: boolean;
    isEnabled: boolean;
    lastRunTime: Date | null;
    nextRunTime: Date | null;
    config: PipelineConfig;
  } {
    const nextRunTime = this.lastRunTime && this.intervalId
      ? new Date(this.lastRunTime.getTime() + (this.config.checkIntervalMinutes * 60 * 1000))
      : null;

    return {
      isRunning: this.isRunning,
      isEnabled: this.config.enabled,
      lastRunTime: this.lastRunTime,
      nextRunTime,
      config: this.config
    };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<PipelineConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    // Restart if enabling or interval changed
    if (!wasEnabled && this.config.enabled) {
      this.start();
    } else if (wasEnabled && !this.config.enabled) {
      this.stop();
    } else if (this.intervalId && newConfig.checkIntervalMinutes) {
      this.stop();
      this.start();
    }
  }
}
import { LiveTournamentStat } from '@/types/definitions';

export interface RoundCompletionStatus {
  eventId: number;
  eventName: string;
  roundNum: number;
  isComplete: boolean;
  completionPercentage: number;
  totalPlayers: number;
  completedPlayers: number;
  inProgressPlayers: number;
  notStartedPlayers: number;
  estimatedCompletionTime?: Date;
  lastUpdated: Date;
}

export interface RoundCompletionCriteria {
  minCompletionPercentage?: number; // Default: 80% of players must finish
  minPlayersRequired?: number; // Default: 50 players minimum in field
  holesRequiredForCompletion?: number; // Default: 18 holes
  considerWithdrawnComplete?: boolean; // Default: true - count WD/CUT as "complete"
  roundStartThresholdHours?: number; // Default: 6 hours - how long to wait after round starts
}

export class RoundCompletionDetector {
  private supabaseClient: any;
  private criteria: Required<RoundCompletionCriteria>;

  constructor(supabaseClient: any, criteria: RoundCompletionCriteria = {}) {
    this.supabaseClient = supabaseClient;
    this.criteria = {
      minCompletionPercentage: criteria.minCompletionPercentage ?? 80,
      minPlayersRequired: criteria.minPlayersRequired ?? 50,
      holesRequiredForCompletion: criteria.holesRequiredForCompletion ?? 18,
      considerWithdrawnComplete: criteria.considerWithdrawnComplete ?? true,
      roundStartThresholdHours: criteria.roundStartThresholdHours ?? 6,
      ...criteria
    };
  }

  /**
   * Check if a specific round is complete for an event
   */
  async checkRoundCompletion(eventId: number, roundNum: number): Promise<RoundCompletionStatus> {
    try {
      // Get tournament info
      const { data: tournament } = await this.supabaseClient
        .from('tournaments')
        .select('name')
        .eq('dg_id', eventId)
        .single();

      const eventName = tournament?.name || `Event ${eventId}`;

      // Get all player stats for this event/round
      const { data: playerStats, error } = await this.supabaseClient
        .from('tournament_round_snapshots')
        .select('*')
        .eq('event_id', eventId)
        .eq('round_num', roundNum.toString())
        .order('snapshot_timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      if (!playerStats || playerStats.length === 0) {
        return {
          eventId,
          eventName,
          roundNum,
          isComplete: false,
          completionPercentage: 0,
          totalPlayers: 0,
          completedPlayers: 0,
          inProgressPlayers: 0,
          notStartedPlayers: 0,
          lastUpdated: new Date()
        };
      }

      // Get latest stats per player (in case of multiple snapshots)
      const latestPlayerStats = this.getLatestStatsPerPlayer(playerStats);
      
      // Analyze completion status
      const analysis = this.analyzePlayerCompletion(latestPlayerStats);
      
      // Determine if round is complete based on criteria
      const isComplete = this.isRoundComplete(analysis);
      
      // Estimate completion time if not complete
      const estimatedCompletionTime = isComplete ? undefined : this.estimateCompletionTime(analysis);

      return {
        eventId,
        eventName,
        roundNum,
        isComplete,
        completionPercentage: analysis.completionPercentage,
        totalPlayers: analysis.totalPlayers,
        completedPlayers: analysis.completedPlayers,
        inProgressPlayers: analysis.inProgressPlayers,
        notStartedPlayers: analysis.notStartedPlayers,
        estimatedCompletionTime,
        lastUpdated: new Date()
      };

    } catch (error) {
      console.error('Error checking round completion:', error);
      throw error;
    }
  }

  /**
   * Check completion status for all active rounds across all events
   */
  async checkAllActiveRounds(): Promise<RoundCompletionStatus[]> {
    try {
      // Get all recent tournament snapshots (last 3 days)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data: recentSnapshots, error } = await this.supabaseClient
        .from('tournament_round_snapshots')
        .select('event_id, round_num')
        .gte('snapshot_timestamp', threeDaysAgo.toISOString())
        .order('snapshot_timestamp', { ascending: false });

      if (error) {
        throw error;
      }

      // Get unique event/round combinations
      const uniqueRounds = new Map<string, { eventId: number; roundNum: number }>();
      
      recentSnapshots.forEach((snapshot: any) => {
        const key = `${snapshot.event_id}-${snapshot.round_num}`;
        if (!uniqueRounds.has(key)) {
          uniqueRounds.set(key, {
            eventId: snapshot.event_id,
            roundNum: parseInt(snapshot.round_num)
          });
        }
      });

      // Check completion for each unique round
      const completionStatuses: RoundCompletionStatus[] = [];
      
      for (const { eventId, roundNum } of uniqueRounds.values()) {
        try {
          const status = await this.checkRoundCompletion(eventId, roundNum);
          completionStatuses.push(status);
        } catch (error) {
          console.error(`Error checking completion for event ${eventId}, round ${roundNum}:`, error);
          // Continue with other rounds
        }
      }

      return completionStatuses;

    } catch (error) {
      console.error('Error checking all active rounds:', error);
      throw error;
    }
  }

  /**
   * Get the latest stats per player (handle multiple snapshots)
   */
  private getLatestStatsPerPlayer(playerStats: any[]): any[] {
    const latestStats = new Map<number, any>();
    
    playerStats.forEach(stat => {
      const dgId = stat.dg_id;
      const existing = latestStats.get(dgId);
      
      if (!existing || new Date(stat.snapshot_timestamp) > new Date(existing.snapshot_timestamp)) {
        latestStats.set(dgId, stat);
      }
    });

    return Array.from(latestStats.values());
  }

  /**
   * Analyze player completion status
   */
  private analyzePlayerCompletion(playerStats: any[]): {
    totalPlayers: number;
    completedPlayers: number;
    inProgressPlayers: number;
    notStartedPlayers: number;
    completionPercentage: number;
    averageHolesCompleted: number;
  } {
    
    let completedPlayers = 0;
    let inProgressPlayers = 0;
    let notStartedPlayers = 0;
    let totalHoles = 0;

    playerStats.forEach(stat => {
      const thru = stat.thru || 0;
      const position = stat.position || '';
      
      // Consider player complete if:
      // 1. They completed all holes (thru >= required holes)
      // 2. They withdrew/cut/disqualified and we consider that complete
      // 3. They have a final position and no "thru" value (indicating round done)
      
      const hasCompletedAllHoles = thru >= this.criteria.holesRequiredForCompletion;
      const isWithdrawn = this.criteria.considerWithdrawnComplete && 
                         position.match(/^(CUT|WD|DQ|DNS)/);
      const hasFinalPosition = position && !position.includes('T') && thru === 0;
      
      if (hasCompletedAllHoles || isWithdrawn || hasFinalPosition) {
        completedPlayers++;
      } else if (thru > 0) {
        inProgressPlayers++;
      } else {
        notStartedPlayers++;
      }
      
      totalHoles += thru;
    });

    const totalPlayers = playerStats.length;
    const completionPercentage = totalPlayers > 0 ? (completedPlayers / totalPlayers) * 100 : 0;
    const averageHolesCompleted = totalPlayers > 0 ? totalHoles / totalPlayers : 0;

    return {
      totalPlayers,
      completedPlayers,
      inProgressPlayers,
      notStartedPlayers,
      completionPercentage,
      averageHolesCompleted
    };
  }

  /**
   * Determine if round meets completion criteria
   */
  private isRoundComplete(analysis: {
    totalPlayers: number;
    completedPlayers: number;
    completionPercentage: number;
  }): boolean {
    
    // Must have minimum number of players
    if (analysis.totalPlayers < this.criteria.minPlayersRequired) {
      return false;
    }

    // Must meet completion percentage threshold
    if (analysis.completionPercentage < this.criteria.minCompletionPercentage) {
      return false;
    }

    return true;
  }

  /**
   * Estimate when round will be complete (if not already complete)
   */
  private estimateCompletionTime(analysis: {
    totalPlayers: number;
    inProgressPlayers: number;
    averageHolesCompleted: number;
  }): Date | undefined {
    
    if (analysis.inProgressPlayers === 0) {
      return undefined; // No players in progress
    }

    // Rough estimate: assume 12 minutes per hole for remaining holes
    const minutesPerHole = 12;
    const averageRemainingHoles = this.criteria.holesRequiredForCompletion - analysis.averageHolesCompleted;
    const estimatedMinutesRemaining = Math.max(0, averageRemainingHoles * minutesPerHole);

    const estimatedCompletion = new Date();
    estimatedCompletion.setMinutes(estimatedCompletion.getMinutes() + estimatedMinutesRemaining);

    return estimatedCompletion;
  }

  /**
   * Get rounds that recently completed (for triggering analysis)
   */
  async getRecentlyCompletedRounds(
    hoursBack: number = 6
  ): Promise<Array<{ eventId: number; roundNum: number; completedAt: Date }>> {
    
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    try {
      // This would ideally use a "round completion events" table
      // For now, we'll check current completion status and compare with previous checks
      const activeRounds = await this.checkAllActiveRounds();
      
      const recentlyCompleted: Array<{ eventId: number; roundNum: number; completedAt: Date }> = [];
      
      for (const round of activeRounds) {
        if (round.isComplete && round.completionPercentage >= this.criteria.minCompletionPercentage) {
          // Check if we already processed results for this round
          const { data: existingResults } = await this.supabaseClient
            .from('matchup_results')
            .select('id')
            .eq('event_id', round.eventId)
            .eq('round_num', round.roundNum)
            .limit(1);

          // If no results exist, this round recently completed
          if (!existingResults || existingResults.length === 0) {
            recentlyCompleted.push({
              eventId: round.eventId,
              roundNum: round.roundNum,
              completedAt: round.lastUpdated
            });
          }
        }
      }

      return recentlyCompleted;

    } catch (error) {
      console.error('Error getting recently completed rounds:', error);
      return [];
    }
  }

  /**
   * Monitor and process newly completed rounds
   */
  async processNewlyCompletedRounds(): Promise<{
    processed: number;
    results: Array<{
      eventId: number;
      roundNum: number;
      success: boolean;
      error?: string;
    }>;
  }> {
    
    try {
      const recentlyCompleted = await this.getRecentlyCompletedRounds();
      const results: Array<{ eventId: number; roundNum: number; success: boolean; error?: string }> = [];

      for (const round of recentlyCompleted) {
        try {
          // Trigger result ingestion for this round
          const response = await fetch('/api/ingest-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: round.eventId,
              roundNum: round.roundNum,
              forceReprocess: false
            })
          });

          if (response.ok) {
            results.push({
              eventId: round.eventId,
              roundNum: round.roundNum,
              success: true
            });
          } else {
            const errorData = await response.json();
            results.push({
              eventId: round.eventId,
              roundNum: round.roundNum,
              success: false,
              error: errorData.error || 'Unknown error'
            });
          }

        } catch (error) {
          results.push({
            eventId: round.eventId,
            roundNum: round.roundNum,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {
        processed: recentlyCompleted.length,
        results
      };

    } catch (error) {
      console.error('Error processing newly completed rounds:', error);
      return {
        processed: 0,
        results: []
      };
    }
  }
}
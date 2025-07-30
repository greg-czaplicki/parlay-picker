import { MatchupRow } from '@/types/matchups';
import { LiveTournamentStat } from '@/types/definitions';

export interface ProcessedMatchupResult {
  matchupId: number;
  eventId: number;
  eventName: string;
  roundNum: number;
  matchupType: '2ball' | '3ball';
  
  // Player data
  players: {
    player1: {
      dgId: number;
      name: string;
      odds: number | null;
      dgOdds: number | null;
      score: number | null;
      totalScore: number | null;
      position: number | null;
    };
    player2: {
      dgId: number;
      name: string;
      odds: number | null;
      dgOdds: number | null;
      score: number | null;
      totalScore: number | null;
      position: number | null;
    };
    player3?: {
      dgId: number;
      name: string;
      odds: number | null;
      dgOdds: number | null;
      score: number | null;
      totalScore: number | null;
      position: number | null;
    };
  };
  
  // Result
  winnerDgId: number;
  winnerName: string;
  winMethod: 'score' | 'position' | 'manual'; // How winner was determined
  confidence: 'high' | 'medium' | 'low'; // Confidence in result
  
  resultDeterminedAt: Date;
}

export interface MatchupResultIngestionOptions {
  roundCompletionThreshold?: number; // Holes completed to consider round done (default: 18)
  fallbackToPosition?: boolean; // Use leaderboard position if scores unavailable (default: true)
  requireCompleteRound?: boolean; // Only process if all players completed round (default: false)
}

export class MatchupResultProcessor {
  private supabaseClient: any;
  private options: Required<MatchupResultIngestionOptions>;

  constructor(supabaseClient: any, options: MatchupResultIngestionOptions = {}) {
    this.supabaseClient = supabaseClient;
    this.options = {
      roundCompletionThreshold: options.roundCompletionThreshold ?? 18,
      fallbackToPosition: options.fallbackToPosition ?? true,
      requireCompleteRound: options.requireCompleteRound ?? false,
      ...options
    };
  }

  /**
   * Process matchup results for a specific event and round
   */
  async processEventRoundResults(
    eventId: number, 
    roundNum: number
  ): Promise<ProcessedMatchupResult[]> {
    try {
      // Fetch matchups for this event/round
      const matchupsResponse = await fetch(`/api/matchups?eventId=${eventId}&roundNum=${roundNum}`);
      if (!matchupsResponse.ok) {
        throw new Error('Failed to fetch matchups');
      }
      
      const { matchups } = await matchupsResponse.json();
      
      if (!matchups || matchups.length === 0) {
        console.log(`No matchups found for event ${eventId}, round ${roundNum}`);
        return [];
      }

      // Fetch tournament stats for all players
      const { data: tournamentStats, error: statsError } = await this.supabaseClient
        .from('tournament_round_snapshots')
        .select('*')
        .eq('event_id', eventId)
        .eq('round_num', roundNum.toString());

      if (statsError) {
        throw statsError;
      }

      // Get event name
      const { data: eventData } = await this.supabaseClient
        .from('tournaments')
        .select('name')
        .eq('dg_id', eventId)
        .single();

      const eventName = eventData?.name || `Event ${eventId}`;

      // Process each matchup
      const results: ProcessedMatchupResult[] = [];
      
      for (const matchup of matchups) {
        try {
          const result = await this.processMatchupResult(
            matchup, 
            tournamentStats || [], 
            eventName
          );
          
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.error(`Error processing matchup ${matchup.id}:`, error);
          // Continue processing other matchups even if one fails
        }
      }

      return results;

    } catch (error) {
      console.error('Error processing event round results:', error);
      throw error;
    }
  }

  /**
   * Process a single matchup result
   */
  async processMatchupResult(
    matchup: MatchupRow,
    tournamentStats: LiveTournamentStat[],
    eventName: string
  ): Promise<ProcessedMatchupResult | null> {
    
    // Extract player data
    const players = this.extractPlayersFromMatchup(matchup, tournamentStats);
    
    // Determine winner
    const winnerResult = this.determineWinner(players, matchup.type as '2ball' | '3ball');
    
    if (!winnerResult) {
      console.log(`Could not determine winner for matchup ${matchup.id}`);
      return null;
    }

    // Check if we should process this result based on our criteria
    if (!this.shouldProcessResult(players, winnerResult)) {
      console.log(`Skipping matchup ${matchup.id} - does not meet processing criteria`);
      return null;
    }

    return {
      matchupId: matchup.id,
      eventId: matchup.event_id,
      eventName,
      roundNum: matchup.round_num,
      matchupType: matchup.type as '2ball' | '3ball',
      players,
      winnerDgId: winnerResult.dgId,
      winnerName: winnerResult.name,
      winMethod: winnerResult.method,
      confidence: winnerResult.confidence,
      resultDeterminedAt: new Date()
    };
  }

  /**
   * Extract player data from matchup and tournament stats
   */
  private extractPlayersFromMatchup(
    matchup: MatchupRow,
    tournamentStats: LiveTournamentStat[]
  ) {
    const getPlayerStats = (dgId: number) => {
      return tournamentStats.find(stat => Number(stat.dg_id) === dgId);
    };

    const createPlayerData = (dgId: number, name: string, odds: number | null, dgOdds: number | null) => {
      const stats = getPlayerStats(dgId);
      return {
        dgId,
        name,
        odds,
        dgOdds,
        score: stats?.today || null,
        totalScore: stats?.total || null,
        position: stats?.position ? this.parsePosition(stats.position) : null
      };
    };

    const players: any = {
      player1: createPlayerData(
        matchup.player1_dg_id, 
        matchup.player1_name, 
        matchup.odds1, 
        matchup.dg_odds1
      ),
      player2: createPlayerData(
        matchup.player2_dg_id, 
        matchup.player2_name, 
        matchup.odds2, 
        matchup.dg_odds2
      )
    };

    // Add third player for 3ball matchups
    if (matchup.type === '3ball' && matchup.player3_dg_id && matchup.player3_name) {
      players.player3 = createPlayerData(
        matchup.player3_dg_id,
        matchup.player3_name,
        (matchup as any).odds3,
        (matchup as any).dg_odds3
      );
    }

    return players;
  }

  /**
   * Determine the winner of a matchup
   */
  private determineWinner(
    players: any,
    matchupType: '2ball' | '3ball'
  ): {
    dgId: number;
    name: string;
    method: 'score' | 'position' | 'manual';
    confidence: 'high' | 'medium' | 'low';
  } | null {
    
    const playerList = [players.player1, players.player2];
    if (matchupType === '3ball' && players.player3) {
      playerList.push(players.player3);
    }

    // Method 1: Use round scores (most reliable)
    const playersWithScores = playerList.filter(p => p.score !== null);
    if (playersWithScores.length === playerList.length) {
      // All players have scores - determine winner by best (lowest) score
      const winner = playersWithScores.reduce((best, current) => 
        (current.score! < best.score!) ? current : best
      );
      
      // Check for ties
      const minScore = Math.min(...playersWithScores.map(p => p.score!));
      const playersWithMinScore = playersWithScores.filter(p => p.score === minScore);
      
      if (playersWithMinScore.length === 1) {
        return {
          dgId: winner.dgId,
          name: winner.name,
          method: 'score',
          confidence: 'high'
        };
      }
      
      // Handle tie by looking at total score or position
      if (this.options.fallbackToPosition) {
        return this.determineWinnerByPosition(playersWithMinScore);
      }
    }

    // Method 2: Use leaderboard positions (fallback)
    if (this.options.fallbackToPosition) {
      const playersWithPositions = playerList.filter(p => p.position !== null);
      if (playersWithPositions.length >= 2) {
        return this.determineWinnerByPosition(playersWithPositions);
      }
    }

    // Method 3: Use total scores (last resort)
    const playersWithTotalScores = playerList.filter(p => p.totalScore !== null);
    if (playersWithTotalScores.length === playerList.length) {
      const winner = playersWithTotalScores.reduce((best, current) => 
        (current.totalScore! < best.totalScore!) ? current : best
      );
      
      return {
        dgId: winner.dgId,
        name: winner.name,
        method: 'score',
        confidence: 'low'
      };
    }

    return null; // Cannot determine winner
  }

  /**
   * Determine winner by leaderboard position
   */
  private determineWinnerByPosition(players: any[]): {
    dgId: number;
    name: string;
    method: 'position';
    confidence: 'medium' | 'low';
  } | null {
    
    const playersWithPositions = players.filter(p => p.position !== null);
    if (playersWithPositions.length === 0) return null;

    const winner = playersWithPositions.reduce((best, current) => 
      (current.position! < best.position!) ? current : best
    );

    // Check for position ties
    const bestPosition = Math.min(...playersWithPositions.map(p => p.position!));
    const playersWithBestPosition = playersWithPositions.filter(p => p.position === bestPosition);

    return {
      dgId: winner.dgId,
      name: winner.name,
      method: 'position',
      confidence: playersWithBestPosition.length === 1 ? 'medium' : 'low'
    };
  }

  /**
   * Check if we should process this result based on our criteria
   */
  private shouldProcessResult(players: any, winnerResult: any): boolean {
    const playerList = [players.player1, players.player2];
    if (players.player3) playerList.push(players.player3);

    // If requiring complete round, check that all players have scores
    if (this.options.requireCompleteRound) {
      const playersWithScores = playerList.filter(p => p.score !== null);
      if (playersWithScores.length !== playerList.length) {
        return false;
      }
    }

    // Always process if we have high confidence
    if (winnerResult.confidence === 'high') {
      return true;
    }

    // Process medium confidence if we have position data
    if (winnerResult.confidence === 'medium' && winnerResult.method === 'position') {
      return true;
    }

    // Skip low confidence results unless specifically allowed
    return winnerResult.confidence !== 'low';
  }

  /**
   * Parse position string to numeric value
   */
  private parsePosition(position: string): number | null {
    if (!position) return null;
    
    // Handle 'CUT', 'WD', 'DQ' etc.
    if (position.match(/^(CUT|WD|DQ|DNS)/)) {
      return 999; // Large number for non-finishing positions
    }
    
    // Extract number from 'T1', '1', 'T15', etc.
    const match = position.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  /**
   * Save processed results to database
   */
  async saveResults(results: ProcessedMatchupResult[]): Promise<void> {
    if (results.length === 0) return;

    const records = results.map(result => ({
      matchup_id: result.matchupId,
      event_id: result.eventId,
      event_name: result.eventName,
      round_num: result.roundNum,
      matchup_type: result.matchupType,
      
      // Player data
      player1_dg_id: result.players.player1.dgId,
      player1_name: result.players.player1.name,
      player2_dg_id: result.players.player2.dgId,
      player2_name: result.players.player2.name,
      player3_dg_id: result.players.player3?.dgId || null,
      player3_name: result.players.player3?.name || null,
      
      // Odds
      player1_odds: result.players.player1.odds,
      player2_odds: result.players.player2.odds,
      player3_odds: result.players.player3?.odds || null,
      player1_dg_odds: result.players.player1.dgOdds,
      player2_dg_odds: result.players.player2.dgOdds,
      player3_dg_odds: result.players.player3?.dgOdds || null,
      
      // Results
      winner_dg_id: result.winnerDgId,
      winner_name: result.winnerName,
      player1_score: result.players.player1.score,
      player2_score: result.players.player2.score,
      player3_score: result.players.player3?.score || null,
      player1_total_score: result.players.player1.totalScore,
      player2_total_score: result.players.player2.totalScore,
      player3_total_score: result.players.player3?.totalScore || null,
      
      result_determined_at: result.resultDeterminedAt.toISOString()
    }));

    const { error } = await this.supabaseClient
      .from('matchup_results')
      .upsert(records, {
        onConflict: 'matchup_id,event_id,round_num',
        ignoreDuplicates: false
      });

    if (error) {
      throw error;
    }

    console.log(`Successfully saved ${records.length} matchup results`);
  }

  /**
   * Process and save results for an event/round in one operation
   */
  async ingestEventRoundResults(eventId: number, roundNum: number): Promise<{
    processed: number;
    saved: number;
    skipped: number;
    errors: string[];
  }> {
    try {
      const results = await this.processEventRoundResults(eventId, roundNum);
      const processed = results.length;
      
      await this.saveResults(results);
      
      return {
        processed,
        saved: results.length,
        skipped: 0, // Would need to track this in processing
        errors: []
      };
      
    } catch (error) {
      console.error('Error ingesting event round results:', error);
      return {
        processed: 0,
        saved: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}
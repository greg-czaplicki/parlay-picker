/**
 * Parlay Confidence Score Calculator
 * Analyzes live golf data to predict the probability of a parlay hitting
 */

export interface PickConfidence {
  pickIndex: number;
  playerName: string;
  status: 'won' | 'lost' | 'push' | 'void' | 'leading' | 'trailing' | 'tied' | 'pending';
  confidence: number; // 0-100%
  holesRemaining: number;
  scoreDifferential: number; // vs best opponent
  reasoning: string;
}

export interface ParlayConfidence {
  overallConfidence: number; // 0-100%
  isAlive: boolean; // false if any pick is already lost
  picksAnalysis: PickConfidence[];
  summary: {
    won: number;
    lost: number;
    leading: number;
    trailing: number;
    tied: number;
    pending: number;
  };
  riskFactors: string[];
}

export function calculateParlayConfidence(parlay: any): ParlayConfidence {
  if (!parlay.picks || parlay.picks.length === 0) {
    return {
      overallConfidence: 0,
      isAlive: false,
      picksAnalysis: [],
      summary: { won: 0, lost: 0, leading: 0, trailing: 0, tied: 0, pending: 0 },
      riskFactors: ['No picks available']
    };
  }

  const picksAnalysis: PickConfidence[] = [];
  const summary = { won: 0, lost: 0, leading: 0, trailing: 0, tied: 0, pending: 0 };
  const riskFactors: string[] = [];
  let isAlive = true;

  // Analyze each pick
  for (let i = 0; i < parlay.picks.length; i++) {
    const pick = parlay.picks[i];
    const analysis = analyzePickConfidence(pick, i);
    picksAnalysis.push(analysis);

    // Update summary
    if (analysis.status === 'won') summary.won++;
    else if (analysis.status === 'lost') {
      summary.lost++;
      isAlive = false; // One loss kills the parlay
    }
    else if (analysis.status === 'leading') summary.leading++;
    else if (analysis.status === 'trailing') summary.trailing++;
    else if (analysis.status === 'tied') summary.tied++;
    else summary.pending++;

    // Collect risk factors
    if (analysis.confidence < 30 && analysis.status !== 'won' && analysis.status !== 'lost') {
      riskFactors.push(`${analysis.playerName}: ${analysis.reasoning}`);
    }
  }

  // Calculate overall confidence
  let overallConfidence = 0;
  if (!isAlive) {
    overallConfidence = 0; // Dead parlay
  } else {
    // Calculate probability that ALL remaining picks will hit
    const activePickConfidences = picksAnalysis
      .filter(p => p.status !== 'won' && p.status !== 'lost')
      .map(p => p.confidence / 100);

    if (activePickConfidences.length === 0) {
      // All picks are settled and we haven't lost yet, so we won
      overallConfidence = 100;
    } else {
      // Multiply probabilities (all must hit)
      overallConfidence = activePickConfidences.reduce((acc, conf) => acc * conf, 1) * 100;
    }
  }

  return {
    overallConfidence: Math.round(overallConfidence),
    isAlive,
    picksAnalysis,
    summary,
    riskFactors
  };
}

function analyzePickConfidence(pick: any, pickIndex: number): PickConfidence {
  const userPick = pick.players?.find((p: any) => p.isUserPick);
  
  if (!userPick || !pick.players) {
    return {
      pickIndex,
      playerName: 'Unknown',
      status: 'pending',
      confidence: 0,
      holesRemaining: 18,
      scoreDifferential: 0,
      reasoning: 'No player data available'
    };
  }

  // Check if officially settled
  if (pick.pick_outcome && ['win', 'loss', 'push', 'void'].includes(pick.pick_outcome)) {
    return {
      pickIndex,
      playerName: userPick.name,
      status: pick.pick_outcome as any,
      confidence: pick.pick_outcome === 'win' ? 100 : pick.pick_outcome === 'loss' ? 0 : 50,
      holesRemaining: 0,
      scoreDifferential: 0,
      reasoning: `Officially settled: ${pick.pick_outcome}`
    };
  }

  const userScore = userPick.roundScore || 0;
  const holesPlayed = userPick.holesPlayed || 0;
  const holesRemaining = Math.max(0, 18 - holesPlayed);
  
  // Filter out withdrawn players
  const activePlayers = pick.players.filter((p: any) => p.currentPosition !== 'WD');
  const otherPlayers = activePlayers.filter((p: any) => !p.isUserPick);
  
  if (otherPlayers.length === 0) {
    return {
      pickIndex,
      playerName: userPick.name,
      status: holesRemaining > 0 ? 'leading' : 'won',
      confidence: 95, // Very high but not 100% until official
      holesRemaining,
      scoreDifferential: -999, // Huge advantage
      reasoning: 'All opponents withdrew'
    };
  }

  const bestOpponentScore = Math.min(...otherPlayers.map((p: any) => p.roundScore || 0));
  const scoreDifferential = userScore - bestOpponentScore; // Negative = leading

  // Determine current status
  let status: PickConfidence['status'];
  if (holesRemaining === 0) {
    if (scoreDifferential < 0) status = 'won';
    else if (scoreDifferential > 0) status = 'lost';
    else status = 'push';
  } else {
    if (scoreDifferential < 0) status = 'leading';
    else if (scoreDifferential > 0) status = 'trailing';
    else status = 'tied';
  }

  // Calculate confidence based on current position and holes remaining
  const confidence = calculatePickProbability(scoreDifferential, holesRemaining, status);
  
  // Generate reasoning
  const reasoning = generateReasoning(scoreDifferential, holesRemaining, status, otherPlayers.length);

  return {
    pickIndex,
    playerName: userPick.name,
    status,
    confidence,
    holesRemaining,
    scoreDifferential,
    reasoning
  };
}

function calculatePickProbability(scoreDiff: number, holesRemaining: number, status: string): number {
  // If round is complete, confidence is binary
  if (holesRemaining === 0) {
    if (status === 'won') return 100;
    if (status === 'lost') return 0;
    return 50; // push
  }

  // Base probability lookup table based on score differential and holes remaining
  const probabilities: { [key: string]: number } = {
    // Leading by X strokes with Y holes remaining
    '-4_18': 85, '-4_9': 95, '-4_3': 98,
    '-3_18': 75, '-3_9': 90, '-3_3': 95,
    '-2_18': 65, '-2_9': 80, '-2_3': 90,
    '-1_18': 55, '-1_9': 65, '-1_3': 75,
    
    // Tied
    '0_18': 45, '0_9': 45, '0_3': 45,
    
    // Trailing by X strokes with Y holes remaining
    '1_18': 35, '1_9': 25, '1_3': 15,
    '2_18': 25, '2_9': 15, '2_3': 8,
    '3_18': 15, '3_9': 8, '3_3': 3,
    '4_18': 10, '4_9': 5, '4_3': 1,
  };

  // Determine holes category
  const holeCategory = holesRemaining >= 15 ? 18 : holesRemaining >= 6 ? 9 : 3;
  
  // Cap score differential for lookup
  const cappedDiff = Math.max(-4, Math.min(4, scoreDiff));
  
  const key = `${cappedDiff}_${holeCategory}`;
  return probabilities[key] || (scoreDiff < 0 ? 60 : 30); // Default fallback
}

function generateReasoning(scoreDiff: number, holesRemaining: number, status: string, opponentCount: number): string {
  if (holesRemaining === 0) {
    if (status === 'won') return `Won by ${Math.abs(scoreDiff)} stroke${Math.abs(scoreDiff) !== 1 ? 's' : ''}`;
    if (status === 'lost') return `Lost by ${Math.abs(scoreDiff)} stroke${Math.abs(scoreDiff) !== 1 ? 's' : ''}`;
    return 'Tied - push result';
  }

  const strokeDesc = Math.abs(scoreDiff) === 1 ? 'stroke' : 'strokes';
  const opponentDesc = opponentCount === 1 ? 'opponent' : 'opponents';
  
  if (scoreDiff < 0) {
    const lead = Math.abs(scoreDiff);
    if (holesRemaining >= 10) {
      return `Leading by ${lead} ${strokeDesc}, ${holesRemaining} holes left - good position`;
    } else if (holesRemaining >= 5) {
      return `Leading by ${lead} ${strokeDesc}, ${holesRemaining} holes left - strong position`;
    } else {
      return `Leading by ${lead} ${strokeDesc}, only ${holesRemaining} holes left - very strong`;
    }
  } else if (scoreDiff > 0) {
    const deficit = scoreDiff;
    if (holesRemaining >= 10) {
      return `Trailing by ${deficit} ${strokeDesc}, ${holesRemaining} holes left - can recover`;
    } else if (holesRemaining >= 5) {
      return `Trailing by ${deficit} ${strokeDesc}, ${holesRemaining} holes left - needs strong finish`;
    } else {
      return `Trailing by ${deficit} ${strokeDesc}, only ${holesRemaining} holes left - very difficult`;
    }
  } else {
    return `Tied with ${opponentDesc}, ${holesRemaining} holes left - anyone's game`;
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-green-400';
  if (confidence >= 60) return 'text-yellow-400';
  if (confidence >= 30) return 'text-orange-400';
  return 'text-red-400';
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Excellent';
  if (confidence >= 75) return 'Very Good';
  if (confidence >= 60) return 'Good';
  if (confidence >= 40) return 'Fair';
  if (confidence >= 20) return 'Poor';
  return 'Very Poor';
}
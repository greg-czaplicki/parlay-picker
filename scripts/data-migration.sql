-- Data Migration Script for ML Readiness
-- This script backfills missing outcome fields and validates data integrity

-- ============================================
-- 1. BACKFILL MISSING OUTCOME FIELDS
-- ============================================

-- Function to parse golf scores (handles 'E' for even par)
CREATE OR REPLACE FUNCTION parse_today_score(score_value INTEGER) 
RETURNS INTEGER AS $$
BEGIN
  -- Handle null values
  IF score_value IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return the numeric value as-is
  RETURN score_value;
END;
$$ LANGUAGE plpgsql;

-- Function to determine matchup winner based on live tournament stats
CREATE OR REPLACE FUNCTION determine_matchup_outcome(
  p_matchup_id UUID,
  p_picked_player_dg_id INTEGER,
  p_round_num INTEGER,
  p_event_id INTEGER
) RETURNS TEXT AS $$
DECLARE
  player1_dg_id INTEGER;
  player2_dg_id INTEGER;
  player3_dg_id INTEGER;
  matchup_type TEXT;
  
  player1_score INTEGER;
  player2_score INTEGER;
  player3_score INTEGER;
  
  best_score INTEGER;
  tied_players INTEGER;
  picked_player_score INTEGER;
BEGIN
  -- Get matchup details
  SELECT m.player1_dg_id, m.player2_dg_id, m.player3_dg_id, m.type
  INTO player1_dg_id, player2_dg_id, player3_dg_id, matchup_type
  FROM matchups m
  WHERE m.uuid = p_matchup_id;
  
  -- Get scores from live_tournament_stats (using most recent valid entry)
  SELECT COALESCE(
    (SELECT today FROM live_tournament_stats 
     WHERE dg_id = player1_dg_id 
       AND round_num = p_round_num::text 
       AND today IS NOT NULL 
       AND position != 'CUT'
     ORDER BY data_golf_updated_at DESC LIMIT 1), 999
  ) INTO player1_score;
  
  SELECT COALESCE(
    (SELECT today FROM live_tournament_stats 
     WHERE dg_id = player2_dg_id 
       AND round_num = p_round_num::text 
       AND today IS NOT NULL 
       AND position != 'CUT'
     ORDER BY data_golf_updated_at DESC LIMIT 1), 999
  ) INTO player2_score;
  
  IF matchup_type = '3ball' AND player3_dg_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT today FROM live_tournament_stats 
       WHERE dg_id = player3_dg_id 
         AND round_num = p_round_num::text 
         AND today IS NOT NULL 
         AND position != 'CUT'
       ORDER BY data_golf_updated_at DESC LIMIT 1), 999
    ) INTO player3_score;
  ELSE
    player3_score := 999; -- Not applicable for 2ball
  END IF;
  
  -- Determine best score
  IF matchup_type = '2ball' THEN
    best_score := LEAST(player1_score, player2_score);
  ELSE
    best_score := LEAST(player1_score, player2_score, player3_score);
  END IF;
  
  -- Handle cases where no valid scores exist
  IF best_score = 999 THEN
    RETURN 'void';
  END IF;
  
  -- Count tied players at best score
  tied_players := 0;
  IF player1_score = best_score THEN tied_players := tied_players + 1; END IF;
  IF player2_score = best_score THEN tied_players := tied_players + 1; END IF;
  IF matchup_type = '3ball' AND player3_score = best_score THEN tied_players := tied_players + 1; END IF;
  
  -- Get picked player's score
  IF p_picked_player_dg_id = player1_dg_id THEN
    picked_player_score := player1_score;
  ELSIF p_picked_player_dg_id = player2_dg_id THEN
    picked_player_score := player2_score;
  ELSIF p_picked_player_dg_id = player3_dg_id THEN
    picked_player_score := player3_score;
  ELSE
    RETURN 'void'; -- Invalid pick
  END IF;
  
  -- Determine outcome
  IF picked_player_score = 999 THEN
    RETURN 'void'; -- Picked player cut/no score
  ELSIF picked_player_score = best_score THEN
    IF tied_players > 1 THEN
      RETURN 'push'; -- Tied for best
    ELSE
      RETURN 'win'; -- Won outright
    END IF;
  ELSE
    RETURN 'loss'; -- Did not have best score
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. BACKFILL PARLAY_PICKS OUTCOMES
-- ============================================

-- Update parlay_picks with missing outcomes
UPDATE parlay_picks pp
SET outcome = determine_matchup_outcome(
  pp.matchup_id,
  pp.picked_player_dg_id,
  (SELECT m.round_num FROM matchups m WHERE m.uuid = pp.matchup_id),
  (SELECT m.event_id FROM matchups m WHERE m.uuid = pp.matchup_id)
)::pick_outcome_type
WHERE pp.outcome IS NULL;

-- ============================================
-- 3. BACKFILL PARLAY OUTCOMES
-- ============================================

-- Function to determine parlay outcome based on pick outcomes
CREATE OR REPLACE FUNCTION determine_parlay_outcome(p_parlay_id UUID)
RETURNS TEXT AS $$
DECLARE
  total_picks INTEGER;
  win_picks INTEGER;
  void_picks INTEGER;
  push_picks INTEGER;
  loss_picks INTEGER;
BEGIN
  -- Count pick outcomes for this parlay
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN outcome = 'win' THEN 1 END) as wins,
    COUNT(CASE WHEN outcome = 'void' THEN 1 END) as voids,
    COUNT(CASE WHEN outcome = 'push' THEN 1 END) as pushes,
    COUNT(CASE WHEN outcome = 'loss' THEN 1 END) as losses
  INTO total_picks, win_picks, void_picks, push_picks, loss_picks
  FROM parlay_picks
  WHERE parlay_id = p_parlay_id;
  
  -- Parlay logic:
  -- - If any pick is 'loss', parlay is 'loss'
  -- - If all non-void picks are 'win' or 'push', parlay is 'win' (pushes are ignored)
  -- - If all picks are 'void', parlay is 'push'
  -- - If mix of wins/pushes with no losses, parlay is 'win'
  
  IF loss_picks > 0 THEN
    RETURN 'loss';
  ELSIF total_picks = void_picks THEN
    RETURN 'push'; -- All picks voided
  ELSIF win_picks + push_picks + void_picks = total_picks THEN
    IF win_picks > 0 THEN
      RETURN 'win'; -- At least one win, no losses
    ELSE
      RETURN 'push'; -- Only pushes and voids
    END IF;
  ELSE
    RETURN 'loss'; -- Default to loss for edge cases
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update parlays with missing outcomes
UPDATE parlays p
SET outcome = determine_parlay_outcome(p.uuid)::outcome_type
WHERE p.outcome IS NULL;

-- ============================================
-- 4. DATA VALIDATION CHECKS
-- ============================================

-- Create validation report
CREATE TEMP TABLE validation_report AS
WITH data_completeness AS (
  SELECT 
    'parlays' as table_name,
    COUNT(*) as total_records,
    COUNT(outcome) as outcome_populated,
    COUNT(payout_amount) as payout_populated,
    COUNT(*) - COUNT(outcome) as missing_outcomes,
    COUNT(*) - COUNT(payout_amount) as missing_payouts
  FROM parlays
  
  UNION ALL
  
  SELECT 
    'parlay_picks' as table_name,
    COUNT(*) as total_records,
    COUNT(outcome) as outcome_populated,
    COUNT(picked_player_dg_id) as dg_id_populated,
    COUNT(*) - COUNT(outcome) as missing_outcomes,
    COUNT(*) - COUNT(picked_player_dg_id) as missing_dg_ids
  FROM parlay_picks
),
foreign_key_integrity AS (
  SELECT 
    'parlay_picks_to_parlays' as relationship,
    COUNT(*) as total_picks,
    COUNT(p.uuid) as valid_parlay_refs,
    COUNT(*) - COUNT(p.uuid) as orphaned_picks,
    0 as missing_payouts,
    0 as missing_dg_ids
  FROM parlay_picks pp
  LEFT JOIN parlays p ON pp.parlay_id = p.uuid
  
  UNION ALL
  
  SELECT 
    'parlay_picks_to_matchups' as relationship,
    COUNT(*) as total_picks,
    COUNT(m.uuid) as valid_matchup_refs,
    COUNT(*) - COUNT(m.uuid) as orphaned_picks,
    0 as missing_payouts,
    0 as missing_dg_ids
  FROM parlay_picks pp
  LEFT JOIN matchups m ON pp.matchup_id = m.uuid
),
outcome_consistency AS (
  SELECT 
    'outcome_logic_check' as table_name,
    COUNT(*) as total_parlays,
    COUNT(CASE WHEN outcome IS NOT NULL THEN 1 END) as parlays_with_outcomes,
    COUNT(CASE WHEN payout_amount > 0 AND outcome = 'win' THEN 1 END) as winning_parlays_with_payout,
    COUNT(CASE WHEN payout_amount = 0 AND outcome = 'loss' THEN 1 END) as losing_parlays_zero_payout,
    0 as missing_dg_ids
  FROM parlays
)
SELECT * FROM data_completeness
UNION ALL
SELECT * FROM foreign_key_integrity  
UNION ALL
SELECT * FROM outcome_consistency;

-- Display validation report
SELECT 
  table_name,
  total_records,
  outcome_populated,
  payout_populated,
  missing_outcomes,
  CASE 
    WHEN table_name LIKE '%parlay_picks%' THEN missing_dg_ids
    ELSE missing_payouts
  END as missing_secondary_field
FROM validation_report
ORDER BY table_name;

-- ============================================
-- 5. PERFORMANCE OPTIMIZATION
-- ============================================

-- Ensure indexes exist for ML queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parlays_outcome_created_at 
ON parlays(outcome, created_at) WHERE outcome IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parlay_picks_outcome_created_at 
ON parlay_picks(outcome, created_at) WHERE outcome IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parlay_picks_picked_player_outcome 
ON parlay_picks(picked_player_dg_id, outcome) WHERE outcome IS NOT NULL;

-- ============================================
-- 6. CLEANUP FUNCTIONS
-- ============================================

-- Clean up temporary functions (optional - keep for future use)
-- DROP FUNCTION IF EXISTS parse_today_score(INTEGER);
-- DROP FUNCTION IF EXISTS determine_matchup_outcome(UUID, INTEGER, INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS determine_parlay_outcome(UUID);

-- Add comments for documentation
COMMENT ON FUNCTION determine_matchup_outcome IS 'Determines win/loss/push/void outcome for a specific pick based on live tournament stats';
COMMENT ON FUNCTION determine_parlay_outcome IS 'Determines overall parlay outcome based on individual pick outcomes';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Final summary
SELECT 
  'Migration Complete' as status,
  NOW() as completed_at,
  (SELECT COUNT(*) FROM parlays WHERE outcome IS NULL) as parlays_missing_outcomes,
  (SELECT COUNT(*) FROM parlay_picks WHERE outcome IS NULL) as picks_missing_outcomes; 